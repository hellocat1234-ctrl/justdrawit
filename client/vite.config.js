import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ให้ client คุยกับ server ผ่าน origin เดียวกัน (เบราว์เซอร์เห็นเป็น localhost:5173 ทั้งคู่)
// ข้อดีคือข้อ 8 ตอนรวมเป็นพอร์ตเดียว โค้ดฝั่ง client ไม่ต้องแก้อะไรเลย
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // ws: true สำคัญมาก — socket.io เริ่มด้วย HTTP แล้วขออัปเกรดเป็น WebSocket
      // ถ้าไม่ใส่ flag นี้การอัปเกรดจะไม่ผ่าน แล้วภาพวาดสดจะไม่ทำงาน
      "/socket.io": { target: "http://localhost:3000", ws: true },
      "/api": { target: "http://localhost:3000" },
    },
  },
});
