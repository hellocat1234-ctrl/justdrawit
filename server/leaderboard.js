// ---------- Leaderboard (ข้อ 6) ----------
// เก็บคะแนนโหมด Solo ไว้ในไฟล์ JSON ไฟล์เดียว (ไม่ใช้ database เพื่อให้ทันเวลา)
// ไฟล์นี้ไม่ผูกกับ socket หรือ express เลย จึง require ไปใช้ได้ทั้งจาก index.js สคริปต์ seed และเทส
const fs = require("fs");
const path = require("path");
const { cleanName } = require("./clean");

// เทสตั้ง SCORES_FILE ชี้ไปไฟล์ชั่วคราว จะได้ไม่ไปทับคะแนนจริง
const SCORES_FILE = process.env.SCORES_FILE || path.join(__dirname, "data", "scores.json");
const TOP_LIMIT = 20;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/; // YYYY-MM เดือน 01-12 เท่านั้น

// แถวที่หน้าตาไม่ถูก (มีคนไปแก้ไฟล์มือ) ทิ้งไป ไม่ให้ทำให้หน้า Leaderboard พัง
function isValidRow(row) {
  return (
    typeof row?.name === "string" &&
    Number.isFinite(row.score) &&
    Number.isFinite(row.levelReached) &&
    typeof row.playedAt === "string"
  );
}

// อ่านไฟล์ทุกครั้งที่ต้องใช้ (ไฟล์เล็ก อ่านเร็ว) จะได้เห็นของล่าสุดเสมอ
// ไฟล์ยังไม่มี / JSON เสีย / ไม่ใช่ array → ถือว่ายังไม่มีคะแนน ห้ามล่ม
function loadScores() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(SCORES_FILE, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") console.warn(`อ่าน scores.json ไม่ได้ (${err.message}) — ถือว่ายังไม่มีคะแนน`);
    return [];
  }
  return Array.isArray(data) ? data.filter(isValidRow) : [];
}

// เขียนแบบปลอดภัย: เขียนลงไฟล์ชั่วคราวก่อน แล้วค่อยเปลี่ยนชื่อทับของเดิม
// การเปลี่ยนชื่อเกิดในจังหวะเดียว ถ้าไฟดับกลางทาง ไฟล์จริงยังเป็นของเดิมครบ ไม่ใช่ครึ่งๆ กลางๆ
function writeScores(rows) {
  fs.mkdirSync(path.dirname(SCORES_FILE), { recursive: true });
  const tmp = `${SCORES_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
  fs.renameSync(tmp, SCORES_FILE);
}

// ไฟล์เสียแต่ยังมีของอยู่ → เก็บสำรองไว้ก่อนเขียนทับ เผื่อต้องกู้คะแนนด้วยมือ
function backupIfBroken() {
  let text;
  try {
    text = fs.readFileSync(SCORES_FILE, "utf8");
  } catch {
    return; // ไม่มีไฟล์ ไม่มีอะไรให้สำรอง
  }
  try {
    if (Array.isArray(JSON.parse(text))) return; // ไฟล์ดี
  } catch {}
  const backup = `${SCORES_FILE}.broken-${Date.now()}`;
  fs.copyFileSync(SCORES_FILE, backup);
  console.warn(`scores.json เสีย — เก็บสำรองไว้ที่ ${path.basename(backup)} แล้วเริ่มรายการใหม่`);
}

// เวลาท้องถิ่นของ server แบบ "2026-10-05 20:14" ตาม events.md
function formatPlayedAt(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

// ตัวเลขจากภายนอก → จำนวนเต็มไม่ติดลบ (ค่าเพี้ยนเป็น 0)
function cleanCount(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// บันทึกคะแนนหนึ่งเกม — ข้อ 7 (Solo) เรียกตอนจบเกม **server เป็นคนเรียกเท่านั้น** client ส่งคะแนนเองไม่ได้
// เวลาเล่น (playedAt) server ใส่เอง ไม่รับจากข้างนอก
// คืนแถวที่บันทึก หรือ null ถ้าชื่อว่าง/บันทึกไม่สำเร็จ (ไม่ throw ให้เกมล่ม)
function saveScore({ name, score, levelReached } = {}, playedAt = new Date()) {
  const cleanedName = cleanName(name);
  if (!cleanedName) return null;
  try {
    backupIfBroken();
    const rows = loadScores();
    const row = {
      id: rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1,
      name: cleanedName,
      score: cleanCount(score),
      levelReached: cleanCount(levelReached),
      playedAt: formatPlayedAt(playedAt),
    };
    rows.push(row);
    writeScores(rows);
    return row;
  } catch (err) {
    console.warn(`บันทึกคะแนนไม่สำเร็จ (${err.message})`);
    return null;
  }
}

function isValidMonth(month) {
  return typeof month === "string" && MONTH_RE.test(month);
}

// 20 อันดับแรก · month = "YYYY-MM" หรือ null (ตลอดกาล)
// เรียง คะแนนมากก่อน → ถ้าเท่ากัน ด่านไกลกว่าก่อน → ถ้ายังเท่า คนที่ทำได้ก่อนได้อันดับดีกว่า
function getLeaderboard(month = null) {
  const rows = loadScores().filter((r) => !month || r.playedAt.startsWith(month + "-"));
  rows.sort(
    (a, b) =>
      b.score - a.score ||
      b.levelReached - a.levelReached ||
      a.playedAt.localeCompare(b.playedAt) ||
      (Number(a.id) || 0) - (Number(b.id) || 0)
  );
  return {
    month,
    // ส่งเฉพาะ 4 ช่องที่หน้าจอใช้ ไม่ส่ง id กับเวลาเล่น
    top: rows.slice(0, TOP_LIMIT).map((r, i) => ({
      rank: i + 1,
      name: r.name,
      score: r.score,
      levelReached: r.levelReached,
    })),
  };
}

module.exports = { SCORES_FILE, saveScore, getLeaderboard, isValidMonth, loadScores, writeScores, formatPlayedAt };
