// ดึงภาพวาดจริงจาก Google Quick, Draw! (ไฟล์ simplified) ไว้ให้ช่วง "ดูภาพแล้วทาย" ของ Solo
// ข้อมูล: https://github.com/googlecreativelab/quickdraw-dataset สัญญาอนุญาต CC BY 4.0 (ต้องให้เครดิต ดู README)
//
// ทำอะไรบ้าง
//   1) อ่าน ai-words.json แล้วโหลดไฟล์ของแต่ละคำแบบสตรีม หยุดอ่านทันทีที่ได้ครบ ไม่ต้องโหลดไฟล์เต็ม (ไฟล์ละหลายสิบ MB)
//   2) เก็บผู้สมัครคำละ ~300 ภาพ: recognized = true · ไม่ง่ายเกิน (เส้นน้อย/สั้นจนไม่เห็นเป็นรูป) · ไม่ยุ่งเกิน (เส้น/จุด/ความยาวเยอะ)
//   3) วาดภาพลงกระดานจำลอง 512×384 แล้วให้ "โมเดลของเราเอง" ทาย เก็บเฉพาะภาพที่ทายถูกอันดับหนึ่งและ **มั่นใจ ≥ 90%**
//      เรียงตามความมั่นใจ เลือกสูงสุด 8 ภาพต่อคำ · คำที่เหลือน้อยกว่า 3 ภาพ = ไม่ใช้ (ไม่อยู่ในไฟล์ ช่วง AI วาดจะไม่สุ่มคำนั้น)
//      (ทำไมใช้ความมั่นใจของโมเดล: ภาพที่โมเดลมั่นใจสูงคือภาพที่รูปชัด คนส่วนใหญ่ก็ดูออกเช่นกัน)
//   4) แปลงพิกัด 0–255 เป็นสัดส่วน 0–1 ตาม events.md (จัดกลางกระดาน 4:3 ไม่ให้ภาพเบี้ยว)
//   5) เขียน server/data/ai-drawings.json แบบย่อ — ตัดชื่อคำ ประเทศ เวลา ทิ้งหมด เหลือแค่พิกัดเส้น
//   6) ทำภาพรวมสุ่ม 20 ภาพเป็นตาราง (screenshots-ai/contact-sheet.png) ไว้ให้ดูก่อน commit
//      ทำเฉพาะตาราง: node scripts/get-drawings.js --sheet
// ต้องรัน npm run get-model ก่อน (ใช้โมเดลกรองภาพ)
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const aiModel = require("../ai-model");

const WORDS_FILE = process.env.AI_WORDS_FILE || path.join(__dirname, "..", "data", "ai-words.json");
const OUT_FILE = process.env.AI_DRAWINGS_FILE || path.join(__dirname, "..", "data", "ai-drawings.json");
const BASE = "https://storage.googleapis.com/quickdraw_dataset/full/simplified";

const CANDIDATES = Number(process.env.DRAWINGS_CANDIDATES) || 300; // ผู้สมัครต่อคำ (ก่อนให้โมเดลให้คะแนน)
const KEEP = Number(process.env.DRAWINGS_PER_WORD) || 8;           // เก็บสูงสุดกี่ภาพต่อคำ
const MIN_KEEP = 3;       // เหลือน้อยกว่านี้ = ไม่ใช้คำนั้นเลย
const MIN_CONF = 0.9;     // โมเดลต้องมั่นใจอย่างน้อยเท่านี้ (ความน่าจะเป็นของคำที่ถูก)
const MAX_LINES = 6000;   // อ่านไม่เกินกี่บรรทัดต่อคำ (ถ้าผู้สมัครไม่ครบก็เก็บเท่าที่ได้)
const MAX_STROKES = 10;   // เส้นเยอะกว่านี้ = ยุ่งเกิน
const MIN_POINTS = 12;    // จุดน้อยกว่านี้ = ง่ายเกิน (เกือบเป็นขีดเดียว)
const MAX_POINTS = 200;
const MIN_LENGTH = 300;   // ความยาวเส้นรวม (หน่วย 0–255 ของ Quick, Draw!) สั้นกว่านี้ = เล็ก/ง่ายเกินจนไม่เห็นเป็นรูป
const MAX_LENGTH = 2200;  // ยาวกว่านี้ = ยุ่งเกิน
const PARALLEL = 6;
const SHEET_FILE = path.join(__dirname, "..", "..", "screenshots-ai", "contact-sheet.png");

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

// ความยาวเส้นรวมของภาพดิบ (หน่วย 0–255)
function pathLength(d) {
  let sum = 0;
  for (const [xs, ys] of d) for (let i = 1; i < xs.length; i++) sum += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  return sum;
}

async function collect(en, allowed) {
  const cands = [];
  await streamLines(`${BASE}/${encodeURIComponent(en)}.ndjson`, async (line) => {
    let item;
    try { item = JSON.parse(line); } catch { return false; }
    if (item.recognized !== true || !Array.isArray(item.drawing)) return false;
    const d = item.drawing;
    if (d.length === 0 || d.length > MAX_STROKES) return false;
    const pts = d.reduce((n, s) => n + s[0].length, 0);
    if (pts < MIN_POINTS || pts > MAX_POINTS) return false;
    const len = pathLength(d);
    if (len < MIN_LENGTH || len > MAX_LENGTH) return false;
    cands.push(normalize(d)); // จากนี้ไปไม่มีชื่อคำ/ประเทศติดไปด้วยอีก
    return cands.length >= CANDIDATES;
  });
  // ให้โมเดลให้คะแนนทุกผู้สมัคร เก็บเฉพาะที่ทายถูกอันดับหนึ่งและมั่นใจพอ แล้วเอาที่มั่นใจที่สุด
  const scored = [];
  for (const strokes of cands) {
    const top = await aiModel.classify(await render(strokes), { allowed, top: 1 });
    if (top && top[0]?.label === en && top[0].prob >= MIN_CONF) scored.push({ strokes, prob: top[0].prob });
  }
  scored.sort((a, b) => b.prob - a.prob);
  return { list: scored.slice(0, KEEP).map((x) => x.strokes), candidates: cands.length, confident: scored.length };
}

// ตารางภาพรวมสุ่ม 20 ภาพจากไฟล์ที่ได้ (5×4) ไว้ให้คนดูด้วยตาก่อน commit · ใช้ป้ายภาษาอังกฤษ (ฟอนต์ระบบแสดงได้แน่)
async function makeSheet(file = OUT_FILE) {
  const bank = JSON.parse(fs.readFileSync(file, "utf8"));
  const all = Object.entries(bank).flatMap(([en, list]) => list.map((strokes) => ({ en, strokes })));
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const pick = all.slice(0, 20);
  const COLS = 5, CW = 256, CH = 192, LABEL = 26;
  const tiles = [];
  for (let i = 0; i < pick.length; i++) {
    const { en, strokes } = pick[i];
    const img = await sharp(Buffer.from((await render(strokes)).split(",")[1], "base64")).resize(CW, CH).png().toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${LABEL}"><rect width="100%" height="100%" fill="#222"/><text x="8" y="18" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#fff">${en.replace(/[<&]/g, "")}</text></svg>`);
    const x = (i % COLS) * (CW + 4), y = Math.floor(i / COLS) * (CH + LABEL + 4);
    tiles.push({ input: img, left: x, top: y }, { input: label, left: x, top: y + CH });
  }
  const rows = Math.ceil(pick.length / COLS);
  fs.mkdirSync(path.dirname(SHEET_FILE), { recursive: true });
  await sharp({ create: { width: COLS * (CW + 4), height: rows * (CH + LABEL + 4), channels: 3, background: "#888" } })
    .composite(tiles).png().toFile(SHEET_FILE);
  console.log(`ตารางภาพสุ่ม ${pick.length} ภาพ → ${SHEET_FILE}`);
}

async function main() {
  if (process.argv.includes("--sheet")) return makeSheet(); // ทำแค่ตาราง ไม่ดึงข้อมูลใหม่
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
        const { list, candidates, confident } = await collect(en, allowed);
        if (list.length >= MIN_KEEP) out[en] = list;
        console.log(`  ${en}: ผู้สมัคร ${candidates} · มั่นใจ ≥${MIN_CONF * 100}% ${confident} · เก็บ ${list.length}${list.length < MIN_KEEP ? " → ไม่ใช้คำนี้" : ""}`);
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
  await makeSheet();
}

main().catch((err) => {
  console.error("get-drawings ล้มเหลว:", err.message);
  process.exit(1);
});
