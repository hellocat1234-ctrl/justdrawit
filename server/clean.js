// ตัวช่วยทำความสะอาดข้อมูลจาก client ที่ใช้มากกว่าหนึ่งไฟล์
// (ระบบห้องใน index.js และ leaderboard.js ใช้ cleanName ตัวเดียวกัน ชื่อจึงถูกตัดด้วยกติกาเดียวกันทุกที่)

// ตัดช่องว่างหัวท้าย และยาวไม่เกิน 20 ตัวอักษร
function cleanName(name) {
  return String(name ?? "").trim().slice(0, 20);
}

module.exports = { cleanName };
