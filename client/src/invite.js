// ลิงก์เชิญเข้าห้อง: https://เว็บ/?room=12345 — เปิดลิงก์แล้วหน้าแรกเติมรหัสให้เอง (ดู Lobby)
// ใช้ origin ของเว็บ + "/" เสมอ (ไม่เอา path ปัจจุบัน เพราะตอนนี้เราอยู่ที่ /room/12345)
export function inviteUrl(code) {
  return `${window.location.origin}/?room=${code}`;
}

// อ่านรหัสห้องจาก query string เช่น "?room=12345" · ต้องเป็นเลข 5 หลักเท่านั้น (อย่างอื่นทิ้ง)
export function roomCodeFromSearch(search) {
  try {
    const code = new URLSearchParams(search).get("room");
    return /^\d{5}$/.test(code ?? "") ? code : null;
  } catch {
    return null;
  }
}

// คัดลอกข้อความ · คืน true ถ้าสำเร็จ (เบราว์เซอร์บางตัวไม่ให้ ก็ไม่ล่ม)
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
