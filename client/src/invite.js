// ลิงก์เชิญเข้าห้อง: https://เว็บ/?room=12345 — เปิดลิงก์แล้วหน้าแรกเติมรหัสให้เอง (ดู Lobby)
export function inviteUrl(code) {
  const u = new URL(window.location.href);
  u.search = "";
  u.hash = "";
  u.searchParams.set("room", code);
  return u.toString();
}

// อ่านรหัสห้องจากลิงก์ที่เปิดเข้ามา · ต้องเป็นเลข 5 หลักเท่านั้น (อย่างอื่นทิ้ง)
export function roomCodeFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get("room");
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
