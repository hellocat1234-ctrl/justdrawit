// ตัวเลือกลดภาพเคลื่อนไหว (อนิเมชัน/พลุ/ตัวเลขวิ่ง)
// ค่าเริ่มต้นตามที่ตั้งไว้ในระบบ (prefers-reduced-motion) ผู้ใช้สลับเองได้ในกล่อง ℹ️ แล้วจำไว้ในเบราว์เซอร์
// ใช้ได้สองทาง: CSS อ่านจาก <html data-motion="reduce"> · JS อ่านจาก reduceMotion()

const KEY = "jdi.reduceMotion"; // "1" = ลด · "0" = ไม่ลด · ไม่มี = ตามระบบ
const listeners = new Set();
let value = false;

function systemPrefers() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function apply() {
  document.documentElement.dataset.motion = value ? "reduce" : "full";
}

try {
  const saved = localStorage.getItem(KEY);
  value = saved === null ? systemPrefers() : saved === "1";
} catch {
  value = systemPrefers();
}
apply();

export function reduceMotion() {
  return value;
}

export function setReduceMotion(next) {
  value = Boolean(next);
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    /* จำค่าไม่ได้ก็ยังใช้ได้ในรอบนี้ */
  }
  apply();
  listeners.forEach((fn) => fn());
}

export function subscribeMotion(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// กล่องกติกา ℹ️ โชว์เองครั้งแรกที่เข้าห้อง — จำไว้ว่าเคยเห็นแล้ว (ครั้งต่อไปกดดูเองได้จากปุ่ม ℹ️)
const RULES_KEY = "jdi.rulesSeen";

export function rulesSeen() {
  try {
    return localStorage.getItem(RULES_KEY) === "1";
  } catch {
    return true; // จำไม่ได้ก็ไม่โชว์ซ้ำๆ รบกวนทุกครั้ง
  }
}

export function markRulesSeen() {
  try {
    localStorage.setItem(RULES_KEY, "1");
  } catch {
    /* ไม่เป็นไร */
  }
}
