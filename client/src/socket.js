import { io } from "socket.io-client";

// ── กุญแจประจำตัวผู้เล่น (playerKey) ──
// socket.id เปลี่ยนทุกครั้งที่รีเฟรชหน้า server จึงจำเราไม่ได้ว่าเป็นคนเดิม
// เราเลยสุ่ม "กุญแจลับ" เก็บไว้ในเบราว์เซอร์ แล้วส่งไปทุกครั้งที่ต่อ socket
// server แปลงกุญแจเป็น playerId (ดู server/index.js) → รีเฟรชแล้วยังเป็นผู้เล่นคนเดิม กลับเข้าห้องเดิมได้
//
// เก็บใน sessionStorage (ของแท็บนี้) ไม่ใช่ localStorage (ใช้ร่วมกันทุกแท็บ)
// เพราะถ้าใช้ร่วมกันทุกแท็บ เปิดสองแท็บในเบราว์เซอร์เดียวจะกลายเป็น "ผู้เล่นคนเดียวกัน" ทดสอบหลายคนในเครื่องเดียวไม่ได้
// sessionStorage อยู่รอดตอนรีเฟรชเหมือนกัน และแต่ละแท็บได้กุญแจของตัวเอง
const KEY_NAME = "jdi.playerKey";

function randomKey() {
  // getRandomValues ใช้ได้แม้เปิดผ่าน http ในวงแลน (randomUUID ใช้ไม่ได้ถ้าไม่ใช่ https/localhost)
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function playerKey() {
  try {
    let key = sessionStorage.getItem(KEY_NAME);
    if (!key) {
      key = randomKey();
      sessionStorage.setItem(KEY_NAME, key);
    }
    return key;
  } catch {
    return randomKey(); // เบราว์เซอร์ปิด storage: ยังเล่นได้ แค่รีเฟรชแล้วกลับเข้าห้องเดิมไม่ได้
  }
}

// socket ตัวเดียวใช้ทั้งแอป — ห้ามสร้างใหม่ในคอมโพเนนต์ ไม่งั้นจะกลายเป็นหลายการเชื่อมต่อ
//
// ไม่ระบุ URL แปลว่า "ต่อกับ origin ของหน้าเว็บเอง"
// ตอนพัฒนา Vite จะ proxy /socket.io ไปที่ server พอร์ต 3000 ให้ (ดู vite.config.js)
// ตอน build แล้วให้ server เสิร์ฟ ก็เป็น origin เดียวกันอยู่ดี โค้ดบรรทัดนี้จึงใช้ได้ทั้งสองแบบ
// auth ถูกส่งซ้ำทุกครั้งที่ต่อใหม่ (เน็ตหลุดแล้วกลับมา) จึงได้ playerId เดิมเสมอ
export const socket = io({ auth: { playerKey: playerKey() } });
