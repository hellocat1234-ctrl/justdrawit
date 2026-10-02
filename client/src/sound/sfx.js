// เสียงเอฟเฟกต์ — สร้างสดด้วย Web Audio API ไม่มีไฟล์เสียงเลย
// ใช้คลื่นสี่เหลี่ยม/สามเหลี่ยมให้ได้เสียงแบบเกมพิกเซล (ตรงกับธีมของเรา)
//
// เรื่องที่ต้องรู้ (ไอแพด/Safari):
//   - เบราว์เซอร์ไม่ยอมให้มีเสียงจนกว่าผู้ใช้จะแตะหน้าจอสักครั้ง
//     จึงผูก pointerdown/keydown ครั้งเดียวเพื่อ resume AudioContext (ดู unlock)
//   - ถ้ายังไม่ปลดล็อก เสียงที่สั่งเล่นจะเงียบไปเฉยๆ ไม่ error และไม่ค้างคิว
//   - Safari เก่าใช้ชื่อ webkitAudioContext

const KEY = "jdi.sound"; // "off" = ปิดเสียง (ค่าเริ่มต้นคือเปิด)

let ctx = null;
let master = null;

// ให้ music.js ใช้ AudioContext/มาสเตอร์ตัวเดียวกัน (เบราว์เซอร์ควรมี context ตัวเดียว)
export function getMaster() {
  return ensureCtx() ? master : null;
}
let muted = false;
const listeners = new Set();

try {
  muted = localStorage.getItem(KEY) === "off";
} catch {
  /* เบราว์เซอร์บล็อก storage ก็ใช้ค่าเริ่มต้น */
}

export function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18; // ดังพอได้ยินแต่ไม่ตกใจ (เสียงสี่เหลี่ยมแหลมกว่าที่ตัวเลขบอก)
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

// เรียกครั้งเดียวตอนผู้ใช้แตะจอ/กดแป้นครั้งแรก
export function unlock() {
  const c = ensureCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

if (typeof window !== "undefined") {
  // Safari บนไอแพดนับ touchend/click เป็น "การกระทำของผู้ใช้" ชัวร์กว่า pointerdown จึงฟังทั้งหมด
  // ถอดตัวฟังเมื่อ context เล่นได้จริงแล้วเท่านั้น (ถ้ายัง suspended ก็รอครั้งต่อไป)
  const EVENTS = ["pointerdown", "touchend", "click", "keydown"];
  const once = () => {
    unlock();
    if (ctx && ctx.state === "running") EVENTS.forEach((n) => window.removeEventListener(n, once, true));
  };
  EVENTS.forEach((n) => window.addEventListener(n, once, true));
}

// โน้ตหนึ่งตัว: ความถี่ · เริ่มกี่วินาทีจากตอนนี้ · ยาวกี่วินาที · ชนิดคลื่น · ความดัง
function tone(freq, at, dur, type = "square", vol = 1) {
  const c = ctx;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  // ซองเสียงสั้นๆ กันเสียงดังป๊อกตอนเริ่ม/หยุด
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// ความถี่ของโน้ต (ตัวช่วยให้อ่านทำนองรู้เรื่อง)
const N = { C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568, C4: 262, G4: 392 };

const SOUNDS = {
  // คลิกปุ่ม: ติ๊กสั้นๆ เบาๆ (เบากว่าเสียงเหตุการณ์ในเกมมาก) ใช้กับทุกปุ่มทุกหน้า
  click: () => {
    tone(1100, 0, 0.03, "triangle", 0.3);
    tone(1650, 0.012, 0.025, "sine", 0.15);
  },
  // เริ่มตา: อาร์เปจโจขึ้นสามตัว
  roundStart: () => {
    tone(N.C5, 0, 0.1);
    tone(N.E5, 0.09, 0.1);
    tone(N.G5, 0.18, 0.18);
  },
  // เราทายถูก: สี่ตัวไล่ขึ้นสดใส
  selfCorrect: () => {
    tone(N.G5, 0, 0.1);
    tone(N.C6, 0.08, 0.1);
    tone(N.E6, 0.16, 0.1);
    tone(N.G6, 0.24, 0.28, "triangle", 1.2);
  },
  // คนอื่นทายถูก: ติ๊งสั้นๆ เบากว่า ไม่แย่งความสนใจจากการทาย
  otherCorrect: () => {
    tone(N.A5, 0, 0.07, "triangle", 0.8);
    tone(N.E6, 0.07, 0.12, "triangle", 0.8);
  },
  // 10 วิสุดท้าย: ติ๊กสั้น (ระดับเสียงสูงขึ้นเมื่อเหลือ ≤3 วิ ส่งผ่าน arg)
  tick: (urgent) => tone(urgent ? 1500 : 1000, 0, 0.04, "square", 0.5),
  // จบเกม: แตรสั้นๆ
  gameOver: () => {
    tone(N.C5, 0, 0.12);
    tone(N.C5, 0.14, 0.12);
    tone(N.C5, 0.28, 0.12);
    tone(N.G5, 0.42, 0.3);
    tone(N.E5, 0.76, 0.12);
    tone(N.G5, 0.9, 0.5, "triangle", 1.2);
  },
  // AI ทายถูกในโหมด Solo: ต่างจากของเราเล็กน้อยให้รู้ว่า "เครื่อง" ทายได้
  aiCorrect: () => {
    tone(N.E5, 0, 0.09);
    tone(N.G5, 0.09, 0.09);
    tone(N.B5, 0.18, 0.09);
    tone(N.E6, 0.27, 0.3, "triangle", 1.2);
  },
};

export function play(name, arg) {
  if (muted) return;
  const c = ensureCtx();
  if (!c || c.state !== "running") return; // ยังไม่ปลดล็อก = เงียบ
  try {
    SOUNDS[name]?.(arg);
  } catch {
    /* เสียงพังต้องไม่ทำให้เกมพัง */
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  try {
    localStorage.setItem(KEY, muted ? "off" : "on");
  } catch {
    /* ไม่เป็นไร จำค่าไม่ได้ในรอบหน้าเท่านั้น */
  }
  if (!muted) unlock();
  listeners.forEach((fn) => fn());
}

// ให้ React ติดตามค่า muted ผ่าน useSyncExternalStore (ปุ่มหลายที่จะตรงกันเสมอ)
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── เสียงคลิกทุกปุ่มในทุกหน้า ──
// ฟังที่ document ที่เดียว (ไม่ต้องใส่ทีละปุ่ม) จับ click ที่ตกลงบนปุ่ม/ตัวเลือก/ลิงก์ ที่ยังกดได้
// ฟัง click (ไม่ใช่ pointerdown) เพื่อให้กดด้วยแป้นพิมพ์ (Enter/Space บนปุ่ม) ก็มีเสียง และปุ่มที่ปิดอยู่ไม่ดัง
// กระดานวาดไม่ใช่ปุ่ม จึงไม่ดังตอนวาด
if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target instanceof Element ? e.target.closest('button, [role="button"], [role="radio"], a[href], input[type="checkbox"], summary') : null;
      if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
      play("click");
    },
    true,
  );
}
