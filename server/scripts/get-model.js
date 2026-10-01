// ดาวน์โหลดโมเดลทายภาพวาด (npm run get-model) ไว้ที่ server/models/ — ไฟล์ใหญ่จึงไม่ commit
// โมเดล: VinayHajare/quickdraw-mobilevit-small-onnx (MIT) · ข้อมูลฝึก: Google Quick, Draw! (CC BY 4.0)
// ก่อนใช้ไฟล์จะเช็คสัญญาอนุญาตจาก README ของโมเดลจริงอีกรอบ ถ้าไม่ใช่ MIT = หยุดและไม่เก็บไฟล์
const fs = require("fs");
const path = require("path");

const REPO = "VinayHajare/quickdraw-mobilevit-small-onnx";
const BASE = `https://huggingface.co/${REPO}/resolve/main`;
const DIR = process.env.AI_MODEL_DIR || path.join(__dirname, "..", "models");
const FILES = ["README.md", "config.json", "model.onnx"];

async function get(file) {
  const res = await fetch(`${BASE}/${file}`, { redirect: "follow", signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`ดาวน์โหลด ${file} ไม่ได้ (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  // 1) เช็คสัญญาอนุญาตก่อนโหลดไฟล์ใหญ่
  const readme = (await get("README.md")).toString("utf8");
  const license = /^license:\s*(\S+)/m.exec(readme)?.[1];
  if (license !== "mit") {
    console.error(`หยุด: สัญญาอนุญาตของโมเดลไม่ใช่ MIT (พบ "${license}") กรุณาตรวจสอบก่อนใช้งาน`);
    process.exit(1);
  }
  console.log("สัญญาอนุญาต: MIT ✓");

  // 2) โหลดไฟล์ที่เหลือ เขียนลงไฟล์ชั่วคราวก่อนแล้วค่อยเปลี่ยนชื่อ กันไฟล์ครึ่งๆ กลางๆ
  for (const file of FILES) {
    const data = file === "README.md" ? Buffer.from(readme) : await get(file);
    const tmp = path.join(DIR, `${file}.tmp`);
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, path.join(DIR, file));
    console.log(`  ${file}  ${(data.length / 1024).toFixed(0)} KB`);
  }

  // 3) เช็คว่าไฟล์ใช้ได้จริง
  const cfg = JSON.parse(fs.readFileSync(path.join(DIR, "config.json"), "utf8"));
  console.log(`พร้อมใช้งาน: รู้ ${Object.keys(cfg.id2label).length} คำ → ${DIR}`);
}

main().catch((err) => {
  console.error("get-model ล้มเหลว:", err.message);
  process.exit(1);
});
