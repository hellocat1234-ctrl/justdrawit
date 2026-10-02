// npm run setup — ติดตั้งทุกอย่างให้พร้อมเล่นด้วยคำสั่งเดียว
//   1) npm install ใน server/ และ client/
//   2) ดาวน์โหลดโมเดลทายภาพของโหมด Solo (ไม่ได้/ไม่มีเน็ต = ข้าม เกมยังเปิดได้ด้วยโหมดจำลอง)
//   3) build หน้าเว็บ (client/dist) ให้ server เสิร์ฟที่ http://localhost:3000
// รันซ้ำได้ปลอดภัย (ติดตั้งแล้วจะเร็ว · โมเดลมีแล้วจะข้าม)
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  console.error(`❌ ต้องใช้ Node.js เวอร์ชัน 20 ขึ้นไป (เครื่องนี้คือ ${process.versions.node}) — ดาวน์โหลดที่ https://nodejs.org`);
  process.exit(1);
}

function run(title, args, cwd, { optional = false } = {}) {
  console.log(`\n▶ ${title}`);
  const r = spawnSync(NPM, args, { cwd: path.join(ROOT, cwd), stdio: "inherit", shell: process.platform === "win32" });
  if (r.status === 0) return true;
  if (optional) return false;
  console.error(`\n❌ ขั้นตอนนี้ไม่สำเร็จ: ${title}\n   ลองรันซ้ำด้วยตัวเอง: cd ${cwd} && npm ${args.join(" ")}`);
  process.exit(1);
}

run("ติดตั้งส่วน server (npm install)", ["install", "--no-audit", "--no-fund"], "server");
run("ติดตั้งส่วนหน้าเว็บ (npm install)", ["install", "--no-audit", "--no-fund"], "client");

// โมเดล AI: มีอยู่แล้วก็ข้าม · โหลดไม่ได้ก็ไม่เป็นไร (Solo จะใช้โหมดจำลอง เดาสุ่ม)
const modelFile = path.join(ROOT, "server", "models", "model.onnx");
let modelOk = fs.existsSync(modelFile);
if (modelOk) {
  console.log("\n✓ มีโมเดล AI แล้ว (server/models/model.onnx) ข้ามการดาวน์โหลด");
} else {
  modelOk = run("ดาวน์โหลดโมเดลทายภาพ (ประมาณ 21 MB)", ["run", "get-model"], "server", { optional: true });
  if (!modelOk) {
    console.warn(
      "\n⚠️  ดาวน์โหลดโมเดลไม่ได้ (ไม่มีอินเทอร์เน็ตหรือโดนบล็อก?)\n" +
        "   ไม่เป็นไร: เกมเปิดได้ปกติ โหมด Solo จะใช้ \"โหมดจำลอง\" (AI เดาสุ่ม)\n" +
        "   ถ้าอยากได้ AI ตัวจริง ต่อเน็ตแล้วรัน: cd server && npm run get-model",
    );
  }
}

run("สร้างหน้าเว็บของเกม (client/dist)", ["run", "build"], "client");

console.log(
  "\n══════════════════════════════════════════════\n" +
    "✅ พร้อมแล้ว!\n" +
    "   เปิดเกม:             npm start   แล้วเข้า http://localhost:3000\n" +
    "   ให้เพื่อนต่างที่เล่น:  npm run share\n" +
    (modelOk ? "" : "   (Solo ใช้โหมดจำลอง เพราะยังไม่มีโมเดล)\n") +
    "══════════════════════════════════════════════",
);
