// ---------- ภาพวาดจริงสำหรับช่วง "ดูภาพแล้วทาย" ของ Solo ----------
// ไม่ผูกกับ socket · ข้อมูลมาจาก Google Quick, Draw! (CC BY 4.0) ผ่าน npm run get-drawings
// ต้องพูดตรงๆ: นี่คือการ "เล่นซ้ำภาพที่คนจริงเคยวาด" ไม่ใช่ AI สร้างภาพเอง
//
// รูปแบบไฟล์: { "<ชื่ออังกฤษ>": [ ภาพ, ... ] } · ภาพ = [ เส้น, ... ] · เส้น = [x0, y0, x1, y1, ...] เป็นสัดส่วน 0–1
// ชื่อคำเป็นแค่ "กุญแจค้นหาฝั่ง server" ตัวภาพไม่มีชื่อติดมา และ client ไม่เคยได้รับกุญแจนี้
const fs = require("fs");
const path = require("path");

const FILE = process.env.AI_DRAWINGS_FILE || path.join(__dirname, "data", "ai-drawings.json");
const LEVELS = ["easy", "medium", "hard"];

let bank = new Map(); // en → ภาพทั้งหมดของคำนั้น

// โหลดครั้งเดียวตอนสตาร์ท · ไฟล์ไม่มี/เสีย = ไม่มีภาพเลย (ช่วงสองถูกข้าม) ห้ามล่ม
function load() {
  bank = new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    for (const [en, list] of Object.entries(raw ?? {})) {
      const clean = (Array.isArray(list) ? list : []).map(cleanDrawing).filter(Boolean);
      if (clean.length > 0) bank.set(en, clean);
    }
    console.log(`ภาพวาดช่วง AI วาด: ${bank.size} คำ จาก ${path.basename(FILE)}`);
  } catch (err) {
    bank = new Map();
    console.warn(`อ่านภาพวาดไม่ได้ (ข้ามช่วง "ดูภาพแล้วทาย"): ${err.code === "ENOENT" ? "ไม่มีไฟล์ — รัน npm run get-drawings" : err.message}`);
  }
}

// เช็คภาพหนึ่งภาพ: ทุกเลขต้องอยู่ 0–1 และจุดเป็นคู่ · ผิดแม้เส้นเดียว = ทิ้งทั้งภาพ
function cleanDrawing(d) {
  if (!Array.isArray(d) || d.length === 0 || d.length > 40) return null;
  for (const s of d) {
    if (!Array.isArray(s) || s.length < 2 || s.length % 2 !== 0 || s.length > 2000) return null;
    if (!s.every((n) => typeof n === "number" && n >= 0 && n <= 1)) return null;
  }
  return d;
}

// ระดับนี้มีคำที่มีภาพไหม (ใช้ตัดสินตอนเริ่มด่านว่าจะมีช่วงสองหรือเปล่า)
function available(wordBank, difficulty) {
  return (wordBank[difficulty] || []).some((w) => bank.has(w.en));
}

// สุ่มคำที่มีภาพจากระดานที่ต้องการ · ไม่ซ้ำคำที่ใช้ไปแล้วในเกม (หมดแล้วยอมซ้ำ) · ไม่เจอเลยถอยไประดับอื่น
// คืน { word, en, category, strokes } หรือ null
function pick(wordBank, difficulty, used = new Set()) {
  for (const level of [difficulty, ...LEVELS.filter((l) => l !== difficulty)]) {
    const all = (wordBank[level] || []).filter((w) => bank.has(w.en));
    const fresh = all.filter((w) => !used.has(w.word));
    const pool = fresh.length > 0 ? fresh : all;
    if (pool.length === 0) continue;
    const w = pool[Math.floor(Math.random() * pool.length)];
    const list = bank.get(w.en);
    return { word: w.word, en: w.en, category: w.category || "", strokes: list[Math.floor(Math.random() * list.length)] };
  }
  return null;
}

// จัดจังหวะวาด: ภาพทั้งภาพจบภายใน budgetMs · เส้นยาวใช้เวลานานกว่า มีช่องว่างสั้นๆ ระหว่างเส้นเหมือนคนยกปากกา
// คืน [{ at, ms, points }] · at = เริ่มกี่ ms หลังเริ่มช่วง · ms = เวลาที่ใช้วาดเส้นนั้น · points = [{x, y}]
function schedule(strokes, budgetMs) {
  const len = strokes.map((s) => {
    let sum = 0;
    for (let i = 2; i < s.length; i += 2) sum += Math.hypot(s[i] - s[i - 2], s[i + 1] - s[i - 1]);
    return sum + 0.02; // เส้นสั้นมาก/จุดเดียวก็ต้องใช้เวลาหน่อย
  });
  const GAP = 0.25; // ช่องว่างระหว่างเส้น เทียบเป็นสัดส่วนของ "ความยาวเส้นเฉลี่ย"
  const avg = len.reduce((a, b) => a + b, 0) / len.length;
  const total = len.reduce((a, b) => a + b, 0) + GAP * avg * (strokes.length - 1);
  const unit = budgetMs / total; // กี่ ms ต่อหนึ่งหน่วยความยาว
  let at = 0;
  return strokes.map((s, i) => {
    const ms = Math.max(1, Math.round(len[i] * unit));
    const points = [];
    for (let k = 0; k < s.length; k += 2) points.push({ x: s[k], y: s[k + 1] });
    const item = { at: Math.round(at), ms, points };
    at += ms + GAP * avg * unit;
    return item;
  });
}

module.exports = { load, available, pick, schedule, cleanDrawing };
