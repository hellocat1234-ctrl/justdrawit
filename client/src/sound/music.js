// เพลงพื้นหลัง — เล่นไฟล์เพลงจริงจากโฟลเดอร์ client/public/music/
//
// วิธีใช้: ใส่ไฟล์ .mp3 .ogg .wav .m4a ลงโฟลเดอร์นั้น แล้วรีสตาร์ท `npm run dev` (หรือ build ใหม่) — ไม่ต้องแก้โค้ด
// ตัวเสิร์ฟ (vite.config.js) สร้างรายชื่อไฟล์ให้ที่ /music/playlist.json เอง
//
// พฤติกรรม
//   - ไม่มีไฟล์เลย (หรืออ่านรายชื่อไม่ได้) → hasMusic() เป็น false → ปุ่มเพลงถูกซ่อน ไม่มี error ใดๆ
//   - เล่นต่อกันทีละเพลงแบบวนไม่รู้จบ เริ่มจากเพลงสุ่ม · ไฟล์ไหนเล่นไม่ได้ข้ามไปเพลงถัดไป · เล่นไม่ได้ทุกไฟล์ = ซ่อนปุ่ม
//   - เปิดเป็นค่าเริ่มต้น เริ่มเล่นตอนผู้เล่นคลิก/แตะ/กดแป้นครั้งแรก (เบราว์เซอร์ไม่ให้เล่นก่อนนั้น)
//     ผู้เล่นที่เคยปิดไว้ จำค่าไว้ (jdi.music) และไม่เปิดเอง
//   - เบากว่าเสียงเอฟเฟกต์ (MUSIC_VOLUME) · ไม่ผูกกับ React (hooks/usePrefs.js ห่อให้)

const MUSIC_KEY = "jdi.music"; // "off" = ปิด · ค่าเริ่มต้นคือ "เปิด"
const MUSIC_VOLUME = 0.3;
const BASE = "/music/";

let musicOn = true;
try {
  musicOn = localStorage.getItem(MUSIC_KEY) !== "off";
} catch {
  /* เบราว์เซอร์บล็อก storage ก็ใช้ค่าเริ่มต้น */
}

let files = []; // รายชื่อไฟล์ที่ใช้ได้
let ready = false; // อ่านรายชื่อเสร็จแล้วหรือยัง
let audio = null;
let index = 0;
let failures = 0; // นับไฟล์ที่เล่นไม่ได้ติดกัน
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

// มีเพลงให้เล่นไหม (ปุ่มเพลงโชว์เฉพาะตอนเป็น true)
export function hasMusic() {
  return ready && files.length > 0;
}

export function isMusicOn() {
  return musicOn;
}

function loadTrack(i) {
  index = ((i % files.length) + files.length) % files.length;
  audio.src = BASE + encodeURIComponent(files[index]);
}

function playCurrent() {
  if (!audio || !musicOn || !hasMusic()) return;
  const p = audio.play();
  // เล่นไม่ได้ (ยังไม่มีการคลิก ฯลฯ) ไม่ใช่ความผิดของไฟล์ — รอการคลิกครั้งถัดไป (ดูตัวฟังท้ายไฟล์)
  if (p && typeof p.catch === "function") p.catch(() => {});
}

function ensureAudio() {
  if (audio || !hasMusic()) return;
  audio = new Audio();
  audio.preload = "auto";
  audio.volume = MUSIC_VOLUME;
  audio.addEventListener("ended", () => {
    failures = 0;
    loadTrack(index + 1);
    playCurrent();
  });
  audio.addEventListener("error", () => {
    // ไฟล์เสีย/ชนิดที่เบราว์เซอร์เล่นไม่ได้ — ข้ามไปเพลงถัดไป ถ้าเสียหมดทุกไฟล์ซ่อนปุ่มเพลง
    failures++;
    if (failures >= files.length) {
      files = [];
      notify();
      return;
    }
    loadTrack(index + 1);
    playCurrent();
  });
  audio.loop = files.length === 1; // เพลงเดียว = วนซ้ำเนียนด้วย loop ของเบราว์เซอร์ (หลายเพลงจะเล่นต่อกันตาม ended)
  loadTrack(Math.floor(Math.random() * files.length));
}

function start() {
  ensureAudio();
  playCurrent();
}

export function setMusic(value) {
  musicOn = Boolean(value);
  try {
    localStorage.setItem(MUSIC_KEY, musicOn ? "on" : "off");
  } catch {
    /* ไม่เป็นไร */
  }
  if (musicOn) start();
  else audio?.pause();
  notify();
}

export function subscribeMusic(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// อ่านรายชื่อไฟล์ครั้งเดียวตอนโหลด · ผิดพลาดทุกกรณี (ไม่มีไฟล์ JSON พัง ถูกตอบเป็นหน้า HTML) = ไม่มีเพลง
async function loadPlaylist() {
  try {
    const res = await fetch(BASE + "playlist.json", { cache: "no-store" });
    if (!res.ok) throw new Error("no playlist");
    const list = await res.json();
    if (Array.isArray(list)) files = list.filter((n) => typeof n === "string" && n.length > 0 && n.length < 200);
  } catch {
    files = [];
  }
  ready = true;
  notify();
  // ถ้าผู้ใช้คลิกไปแล้วก่อนที่รายชื่อจะมา (เล่นไม่ทัน) เริ่มเลยตอนนี้
  if (gestured && musicOn) start();
}

// เริ่มเล่นตอนผู้ใช้คลิก/แตะ/กดแป้นครั้งแรก — ฟังหลายชนิดเพราะ Safari นับ touchend/click ชัวร์กว่า pointerdown
// ถ้าเล่นไม่ติด (ยังไม่นับเป็นการกระทำของผู้ใช้) ก็รอครั้งถัดไป
let gestured = false;
if (typeof window !== "undefined") {
  const EVENTS = ["pointerdown", "touchend", "click", "keydown"];
  const begin = () => {
    gestured = true;
    if (!musicOn) return EVENTS.forEach((n) => window.removeEventListener(n, begin, true));
    if (!hasMusic()) return; // รายชื่อยังไม่มา/ไม่มีเพลง
    start();
    if (audio && !audio.paused) EVENTS.forEach((n) => window.removeEventListener(n, begin, true));
  };
  EVENTS.forEach((n) => window.addEventListener(n, begin, true));
  loadPlaylist();
}
