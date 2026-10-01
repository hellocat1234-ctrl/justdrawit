// ดึงภาพวาดจริงจาก Google Quick, Draw! (ไฟล์ simplified) ไว้ให้ช่วง "ดูภาพแล้วทาย" ของ Solo
// ข้อมูล: https://github.com/googlecreativelab/quickdraw-dataset สัญญาอนุญาต CC BY 4.0 (ต้องให้เครดิต ดู README)
//
// ทำอะไรบ้าง
//   1) อ่าน ai-words.json แล้วโหลดไฟล์ของแต่ละคำแบบสตรีม หยุดอ่านทันทีที่ได้ครบ ไม่ต้องโหลดไฟล์เต็ม (ไฟล์ละหลายสิบ MB)
//   2) เลือกเฉพาะภาพที่ recognized = true และไม่ซับซ้อนเกินไป (เส้น/จุดไม่เยอะ จะได้วาดจบในครึ่งเวลา)
//   3) วาดภาพลงกระดานจำลอง 512×384 แล้วให้ "โมเดลของเราเอง" ทาย เก็บเฉพาะภาพที่ทายถูกอันดับหนึ่ง
//   4) แปลงพิกัด 0–255 เป็นสัดส่วน 0–1 ตาม events.md (จัดกลางกระดาน 4:3 ไม่ให้ภาพเบี้ยว)
//   5) เขียน server/data/ai-drawings.json แบบย่อ — ตัดชื่อคำ ประเทศ เวลา ทิ้งหมด เหลือแค่พิกัดเส้น
// ต้องรัน npm run get-model ก่อน (ใช้โมเดลกรองภาพ)
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const aiModel = require("../ai-model");

const WORDS_FILE = process.env.AI_WORDS_FILE || path.join(__dirname, "..", "data", "ai-words.json");
const OUT_FILE = process.env.AI_DRAWINGS_FILE || path.join(__dirname, "..", "data", "ai-drawings.json");
const BASE = "https://storage.googleapis.com/quickdraw_dataset/full/simplified";

const PER_WORD = Number(process.env.DRAWINGS_PER_WORD) || 20; // ภาพต่อคำ
const MAX_LINES = 2500;   // อ่านไม่เกินกี่บรรทัดต่อคำ (ถ้าไม่ครบก็เก็บเท่าที่ได้)
const MAX_STROKES = 12;   // ภาพที่เส้นเยอะกว่านี้วาดไม่จบในครึ่งเวลา ข้าม
const MAX_POINTS = 250;
const PARALLEL = 6;

// กระดานเกมเป็น 4:3 · ภาพวาดสี่เหลี่ยมจัตุรัสกว้าง 60% ของความกว้าง (= 80% ของความสูง) ตรงกลาง
const SPAN_X = 0.6;
const SPAN_Y = 0.8;

// แปลงภาพหนึ่งภาพ [[xs, ys], ...] เป็นสัดส่วน 0–1 · แต่ละเส้นเป็นอาร์เรย์แบน [x0, y0, x1, y1, ...]
function normalize(drawing) {
  const xs = drawing.flatMap((s) => s[0]);
  const ys = drawing.flatMap((s) => s[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const r = (n) => Math.round(n * 1000) / 1000;
  return drawing.map(([sx, sy]) => {
    const flat = [];
    for (let i = 0; i < sx.length; i++) {
      flat.push(r(0.5 + ((sx[i] - cx) / 255) * SPAN_X), r(0.5 + ((sy[i] - cy) / 255) * SPAN_Y));
    }
    return flat;
  });
}

// วาดลงกระดานจำลองให้เหมือนที่ผู้เล่นเห็น (พื้นขาว เส้นดำ แปรง 4px) แล้วคืน data URL
async function render(strokes) {
  const W = 512, H = 384;
  const paths = strokes
    .map((s) => {
      const pts = [];
      for (let i = 0; i < s.length; i += 2) pts.push(`${(s[i] * W).toFixed(1)},${(s[i + 1] * H).toFixed(1)}`);
      return pts.length === 1 ? `<circle cx="${pts[0].split(",")[0]}" cy="${pts[0].split(",")[1]}" r="2"/>` : `<polyline points="${pts.join(" ")}"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000" stroke="#000" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill-opacity="0">${paths}</g></svg>`;
  const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
  return "data:image/jpeg;base64," + buf.toString("base64");
}

// อ่านไฟล์ ndjson แบบสตรีม ส่งทีละบรรทัดให้ onLine · onLine คืน true = พอแล้วหยุดอ่าน
async function streamLines(url, onLine) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const decoder = new TextDecoder();
  let rest = "";
  let n = 0;
  for await (const chunk of res.body) {
    rest += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = rest.indexOf("\n")) >= 0) {
      const line = rest.slice(0, nl);
      rest = rest.slice(nl + 1);
      if (line && (await onLine(line)) === true) return;
      if (++n >= MAX_LINES) return;
    }
  }
}

async function collect(en, allowed) {
  const found = [];
  await streamLines(`${BASE}/${encodeURIComponent(en)}.ndjson`, async (line) => {
    let item;
    try { item = JSON.parse(line); } catch { return false; }
    if (item.recognized !== true || !Array.isArray(item.drawing)) return false;
    const d = item.drawing;
    if (d.length === 0 || d.length > MAX_STROKES) return false;
    if (d.reduce((n, s) => n + s[0].length, 0) > MAX_POINTS) return false;
    const strokes = normalize(d); // จากนี้ไปไม่มีชื่อคำ/ประเทศติดไปด้วยอีก
    const top = await aiModel.classify(await render(strokes), { allowed, top: 1 });
    if (top && top[0]?.label === en) found.push(strokes);
    return found.length >= PER_WORD;
  });
  return found;
}

async function main() {
  if (!(await aiModel.load())) {
    console.error("โหลดโมเดลไม่ได้ — รัน npm run get-model ก่อน (ใช้โมเดลกรองภาพที่ทายไม่ออก)");
    process.exit(1);
  }
  const words = JSON.parse(fs.readFileSync(WORDS_FILE, "utf8"));
  const ens = [...new Set(Object.values(words).flat().map((w) => w.en))];
  const allowed = new Set(ens);
  const out = {};
  let next = 0;
  async function worker() {
    while (next < ens.length) {
      const en = ens[next++];
      try {
        const list = await collect(en, allowed);
        if (list.length > 0) out[en] = list;
        console.log(`  ${en}: ${list.length} ภาพ${list.length < PER_WORD ? " (น้อยกว่าเป้า)" : ""}`);
      } catch (err) {
        console.warn(`  ${en}: ข้าม (${err.message})`);
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const tmp = `${OUT_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(sorted));
  fs.renameSync(tmp, OUT_FILE); // เขียนแล้วค่อยเปลี่ยนชื่อ กันไฟล์ครึ่งๆ กลางๆ
  const total = Object.values(sorted).reduce((n, l) => n + l.length, 0);
  console.log(`เสร็จ: ${Object.keys(sorted).length}/${ens.length} คำ รวม ${total} ภาพ (${(fs.statSync(OUT_FILE).size / 1024).toFixed(0)} KB) → ${OUT_FILE}`);
  console.log("ข้อมูลภาพ: Google Quick, Draw! Dataset (CC BY 4.0)");
}

main().catch((err) => {
  console.error("get-drawings ล้มเหลว:", err.message);
  process.exit(1);
});
