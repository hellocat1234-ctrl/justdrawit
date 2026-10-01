// ---------- AI ทายภาพ + กติกาด่านของโหมด Solo (ข้อ 7) ----------
// ไฟล์นี้ไม่ผูกกับ socket จึงเทสแยกได้ · key อยู่ใน server/.env เท่านั้น (index.js โหลดด้วย dotenv)
//
// AI มีสองโหมด
//   "claude" = มี ANTHROPIC_API_KEY → ส่งภาพให้ Claude ดูจริง (ไม่ส่งคำตอบไปด้วย)
//   "mock"   = ไม่มี key หรือสั่ง AI_MODE=mock → เดาสุ่มจากคลังคำ ยิ่งผ่านเวลาไปนานยิ่งมีโอกาสถูก

// AI_API_URL ไว้ให้เทสชี้ไปเซิร์ฟเวอร์ปลอม ใช้งานจริงไม่ต้องตั้ง
const API_URL = process.env.AI_API_URL || "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const API_TIMEOUT_MS = 15000;

// ด่าน 1–2 = 60 วิ easy · 3–4 = 45 วิ medium · 5+ = 30 วิ hard
function levelConfig(level) {
  if (level <= 2) return { time: 60, difficulty: "easy" };
  if (level <= 4) return { time: 45, difficulty: "medium" };
  return { time: 30, difficulty: "hard" };
}

// สุ่มคำจากระดับที่ต้องการ ไม่ซ้ำกับที่ใช้ไปแล้วในเกมนี้ (หมดแล้วอนุญาตให้ซ้ำ)
// ระดับไหนว่างให้ถอยไประดับที่มีคำ กันคลังคำสำรองที่มีแต่ easy ทำให้ล่ม
function pickWord(wordBank, difficulty, used = new Set()) {
  const order = [difficulty, "easy", "medium", "hard"];
  for (const level of order) {
    const all = (wordBank[level] || []).map((w) => w.word);
    const fresh = all.filter((w) => !used.has(w));
    const pool = fresh.length > 0 ? fresh : all;
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

// คะแนนต่อด่านที่ผ่าน: 100 พื้นฐาน + สูงสุด 400 ตามสัดส่วนเวลาที่เหลือตอน AI ทายถูก
function scoreFor(timeLeft, time) {
  const ratio = Math.max(0, Math.min(1, timeLeft / time));
  return 100 + Math.round(400 * ratio);
}

// ---------- ตัวทาย ----------
function aiMode() {
  if (process.env.AI_MODE === "mock") return "mock";
  return process.env.ANTHROPIC_API_KEY ? "claude" : "mock";
}

// โอกาสถูกของโหมดจำลอง: เริ่ม 10% ไปถึง 85% เมื่อหมดเวลา (AI_MOCK_CHANCE ตั้งค่าตายตัวไว้ให้เทส)
function mockChance(elapsed, time) {
  const fixed = Number(process.env.AI_MOCK_CHANCE);
  if (process.env.AI_MOCK_CHANCE !== undefined && process.env.AI_MOCK_CHANCE !== "" && Number.isFinite(fixed)) return fixed;
  return 0.1 + 0.75 * Math.max(0, Math.min(1, elapsed / time));
}

// โหมดจำลองต้องรู้คำจริง (มันแค่แกล้งทาย) ส่วนโหมด claude ไม่รับคำจริงเลย
function mockGuess({ word, allWords, elapsed, time, wrong }) {
  if (Math.random() < mockChance(elapsed, time)) return word;
  const others = allWords.filter((w) => w !== word && !wrong.includes(w));
  return others.length > 0 ? others[Math.floor(Math.random() * others.length)] : "ไม่รู้";
}

// แปลง data URL → { mediaType, data } (ผ่านการเช็คที่ index.js มาแล้ว แต่ตรวจซ้ำให้ฟังก์ชันนี้ปลอดภัยในตัวเอง)
function parseImage(image) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  return m ? { mediaType: m[1], data: m[2] } : null;
}

async function claudeGuess({ image, wrong }) {
  const img = parseImage(image);
  if (!img) throw new Error("ภาพไม่ถูกรูปแบบ");
  const avoid = wrong.length > 0 ? ` คำที่ทายผิดไปแล้ว (ห้ามตอบซ้ำ): ${wrong.join(", ")}` : "";
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || DEFAULT_MODEL,
      max_tokens: 30,
      system: "คุณกำลังเล่นเกมทายภาพ ผู้เล่นวาดภาพสิ่งของหนึ่งอย่าง ให้ตอบเป็นคำนาม/วลีสั้นๆ ภาษาไทยเพียงคำเดียว ไม่ต้องอธิบายและไม่ต้องมีเครื่องหมายใดๆ",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
            { type: "text", text: `ภาพนี้คือคำว่าอะไร?${avoid}` },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Claude API ตอบ ${res.status}`); // ไม่ log body เผื่อมีข้อมูลที่ไม่ควรเปิดเผย
  const body = await res.json();
  const text = body?.content?.find?.((c) => c.type === "text")?.text;
  if (typeof text !== "string") throw new Error("Claude ไม่ตอบข้อความ");
  return text.trim().split(/\s*\n\s*/)[0].slice(0, 40);
}

// เทียบคำแบบเดียวกับโหมดห้อง: ตัดช่องว่าง ไม่สนตัวพิมพ์เล็กใหญ่ (เปลี่ยนที่ index.js ถ้าเกณฑ์ห้องเปลี่ยน)
function sameWord(a, b) {
  const n = (s) => String(s).replace(/\s+/g, "").toLowerCase();
  return n(a) === n(b);
}

// ทายหนึ่งครั้ง → { guess, correct } · โหมด claude ล้มเหลวจะ throw (index.js จับแล้วส่ง AI_UNAVAILABLE)
async function guessImage({ image, word, allWords, elapsed, time, wrong }) {
  const guess =
    aiMode() === "claude"
      ? await claudeGuess({ image, wrong })
      : mockGuess({ word, allWords, elapsed, time, wrong });
  return { guess, correct: sameWord(guess, word) };
}

module.exports = { levelConfig, pickWord, scoreFor, aiMode, guessImage, mockChance, parseImage, sameWord };
