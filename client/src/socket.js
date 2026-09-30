import { io } from "socket.io-client";

// socket ตัวเดียวใช้ทั้งแอป — ห้ามสร้างใหม่ในคอมโพเนนต์ ไม่งั้นจะกลายเป็นหลายการเชื่อมต่อ
//
// ไม่ระบุ URL แปลว่า "ต่อกับ origin ของหน้าเว็บเอง"
// ตอนพัฒนา Vite จะ proxy /socket.io ไปที่ server พอร์ต 3000 ให้ (ดู vite.config.js)
// ตอน build แล้วให้ server เสิร์ฟ ก็เป็น origin เดียวกันอยู่ดี โค้ดบรรทัดนี้จึงใช้ได้ทั้งสองแบบ
export const socket = io();
