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
let muted = false;
const listeners = new Set();

try {
  muted = localStorage.getItem(KEY) === "off";
} catch {
  /* เบราว์เซอร์บล็อก storage ก็ใช้ค่าเริ่มต้น */
}

function ensureCtx() {
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
  const once = () => {
    unlock();
    window.removeEventListener("pointerdown", once, true);
    window.removeEventListener("keydown", once, true);
  };
  window.addEventListener("pointerdown", once, true);
  window.addEventListener("keydown", once, true);
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

// ── เพลงพื้นหลัง (เปิด/ปิดด้วยไอคอนเพลงที่แถบบน) ──
// สร้างสดด้วย Web Audio เหมือนเอฟเฟกต์: อาร์เปจโจเพนทาโทนิกวนตามคอร์ด 4 ห้อง เบาๆ ไม่แย่งเสียงเอฟเฟกต์
// ค่าเริ่มต้น "ปิด" (ไม่มีเสียงดังขึ้นเองตอนเปิดเว็บ) จำค่าไว้ใน localStorage
const MUSIC_KEY = "jdi.music"; // "on" = เปิด
let musicOn = false;
try {
  musicOn = localStorage.getItem(MUSIC_KEY) === "on";
} catch {
  /* ใช้ค่าเริ่มต้น */
}
const musicListeners = new Set();
let musicTimer = null;
let nextBeat = 0; // เวลา (ของ AudioContext) ที่โน้ตถัดไปจะเริ่ม
let beatNo = 0;
const BEAT = 0.22;
// คอร์ด C · Am · F · G (ความถี่โน้ตของอาร์เปจโจ 4 ตัวต่อห้อง)
const CHORDS = [
  [262, 330, 392, 523],
  [220, 262, 330, 440],
  [175, 220, 262, 349],
  [196, 247, 294, 392],
];

function musicTick() {
  const c = ctx;
  if (!c || c.state !== "running") return;
  if (nextBeat < c.currentTime) nextBeat = c.currentTime + 0.05;
  // จัดคิวล่วงหน้า 0.6 วินาที เผื่อแท็บหน่วง
  while (nextBeat < c.currentTime + 0.6) {
    const chord = CHORDS[Math.floor(beatNo / 8) % CHORDS.length];
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3][beatNo % 8];
    tone(chord[pattern], nextBeat - c.currentTime, BEAT * 1.4, "triangle", 0.35);
    if (beatNo % 8 === 0) tone(chord[0] / 2, nextBeat - c.currentTime, BEAT * 3, "triangle", 0.4);
    nextBeat += BEAT;
    beatNo++;
  }
}

function startMusic() {
  if (musicTimer || !ensureCtx()) return;
  unlock();
  beatNo = 0;
  nextBeat = 0;
  musicTimer = setInterval(musicTick, 200);
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

export function isMusicOn() {
  return musicOn;
}

export function setMusic(value) {
  musicOn = Boolean(value);
  try {
    localStorage.setItem(MUSIC_KEY, musicOn ? "on" : "off");
  } catch {
    /* ไม่เป็นไร */
  }
  musicOn ? startMusic() : stopMusic();
  musicListeners.forEach((fn) => fn());
}

export function subscribeMusic(fn) {
  musicListeners.add(fn);
  return () => musicListeners.delete(fn);
}

// เปิดเว็บมาพร้อมค่า "เปิดเพลง" ที่จำไว้: เริ่มได้ต่อเมื่อผู้ใช้แตะจอครั้งแรก (เบราว์เซอร์ไม่ให้ดังก่อน)
if (typeof window !== "undefined" && musicOn) {
  const begin = () => {
    if (musicOn) startMusic();
    window.removeEventListener("pointerdown", begin, true);
    window.removeEventListener("keydown", begin, true);
  };
  window.addEventListener("pointerdown", begin, true);
  window.addEventListener("keydown", begin, true);
}
