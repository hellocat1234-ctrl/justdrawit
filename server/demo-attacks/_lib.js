// เครื่องมือร่วมของสคริปต์สาธิตการโจมตี (สำหรับนำเสนอวิชาเครือข่าย)
// ⚠️ ใช้กับ server ของเราเองบน localhost เท่านั้น เพื่อสาธิต "ก่อนแก้ vs หลังแก้"
//    ห้ามเอาไปยิงเครื่อง/บริการของคนอื่น — เป็นการโจมตีจริงและผิดกฎ
const path = require("path");

// ใช้ socket.io-client ที่ติดมากับ socket.io ใน node_modules (วิธีเดียวกับ tests/smoke.js)
const io = require(path.join(path.dirname(require.resolve("socket.io/package.json")), "client-dist", "socket.io.js"));

// ที่อยู่ server เป้าหมาย — ค่าเริ่มต้น localhost:3000 เปลี่ยนได้ด้วย env TARGET
const TARGET = process.env.TARGET || "http://localhost:3000";

// ต่อ socket หนึ่งตัว (ส่ง playerKey ได้เพื่อให้มี playerId ถาวร เหมือนหน้าเว็บจริง)
function connect(playerKey) {
  return new Promise((resolve, reject) => {
    const socket = io(TARGET, { transports: ["websocket"], auth: playerKey ? { playerKey } : undefined });
    const timer = setTimeout(() => reject(new Error(`ต่อ ${TARGET} ไม่ติดใน 8 วิ (เปิด server ไว้หรือยัง?)`)), 8000);
    socket.on("connect", () => { clearTimeout(timer); resolve(socket); });
    socket.on("connect_error", (e) => { clearTimeout(timer); reject(e); });
  });
}

// ส่ง event ที่มี callback แล้วรอผล (คืน null ถ้าไม่ตอบใน ms)
function emitAck(socket, event, data, ms = 4000) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, ms);
    socket.emit(event, data, (res) => { if (!done) { done = true; clearTimeout(timer); resolve(res); } });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randKey = () => "atk-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

module.exports = { io, TARGET, connect, emitAck, sleep, randKey };
