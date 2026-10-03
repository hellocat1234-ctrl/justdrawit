// สาธิตการโจมตีที่ 1 — ยิงคำทั้งคลังใส่ event `guess` จนทายถูก
//
// แนวคิด: คนทายไม่ต้องรู้คำจริงเลย แค่ส่งคำ "ทุกคำในคลัง" รัว ๆ คำจริงก็อยู่ในนั้นแน่นอน
// ถ้า server ไม่จำกัดความถี่ สคริปต์จะทายถูกในเสี้ยววินาที = โกงได้ง่ายมาก
// หลังใส่ rate limit ที่ event guess การยิงรัวจะถูกทิ้ง ต้องใช้เวลานานขึ้นมาก (หรือไม่ทันในตา)
//
// วิธีรัน:  (เปิด server ไว้ก่อน เช่น npm start)
//   cd server && node demo-attacks/attack-guess-flood.js
//   TARGET=http://localhost:3077 node demo-attacks/attack-guess-flood.js   (ชี้ไป server อื่น)
const fs = require("fs");
const path = require("path");
const { connect, emitAck, sleep, randKey } = require("./_lib");

// อ่านคลังคำจากไฟล์จริง (ผู้โจมตีก็อ่าน words.json ของเกมโอเพนซอร์สได้เหมือนกัน)
function loadAllWords() {
  const bank = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "words.json"), "utf8"));
  const words = [];
  for (const level of ["easy", "medium", "hard"]) {
    for (const item of bank[level] || []) if (item?.word) words.push(item.word);
  }
  return words;
}

async function main() {
  const words = loadAllWords();
  console.log("══════════════════════════════════════════════════════════");
  console.log(" การโจมตีที่ 1: ยิงคำทั้งคลังใส่ guess จนทายถูก");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`เป้าหมาย: ${require("./_lib").TARGET}  ·  จำนวนคำในคลัง: ${words.length} คำ\n`);

  // ต้องมี 2 คนถึงเริ่มเกมได้: host เป็นคนวาด (ไม่ทำอะไร) · guesser คือผู้โจมตี
  const host = await connect(randKey());
  const made = await emitAck(host, "create_room", { name: "เหยื่อ-คนวาด", avatar: 0, challenge: false });
  if (!made?.ok) throw new Error("สร้างห้องไม่สำเร็จ");
  const guesser = await connect(randKey());
  await emitAck(guesser, "join_room", { code: made.code, name: "ผู้โจมตี", avatar: 1 });
  const myId = guesser.id ? null : null; // playerId ได้จาก callback ด้านบนไม่จำเป็น ใช้ event แทน

  // host (คนวาด) เลือกคำแรกที่ได้มา แล้วอยู่เฉย ๆ
  host.on("choose_word", (d) => host.emit("word_chosen", { word: d.options[0] }));

  // รอเข้าสู่ช่วงวาด
  await new Promise((resolve) => {
    guesser.on("round_start", () => resolve());
    host.emit("start_game");
  });
  await sleep(200); // ให้แน่ใจว่าอยู่ช่วง drawing แล้ว

  // เริ่มยิง: ส่งทุกคำรัว ๆ จับเวลาและนับจำนวนครั้งจนกว่าจะทายถูก
  let correct = false;
  let attempts = 0;
  guesser.on("correct_guess", () => { correct = true; });
  guesser.on("chat_message", (m) => { if (m?.correct) correct = true; });

  const start = Date.now();
  for (const word of words) {
    if (correct) break;
    attempts++;
    guesser.emit("guess", { text: word });
    await sleep(3); // เว้น 3ms พอให้ ack กลับมา (ผู้โจมตีจริงยิงเร็วกว่านี้ได้อีก)
  }
  // รอผลตกค้างอีกนิด
  for (let i = 0; i < 100 && !correct; i++) await sleep(20);
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`ผลลัพธ์:`);
  console.log(`  ยิงไป         : ${attempts} คำ`);
  console.log(`  ใช้เวลา        : ${elapsed} วินาที`);
  console.log(`  ทายถูกหรือไม่  : ${correct ? "✅ ทายถูก (โจมตีสำเร็จ)" : "❌ ทายไม่ถูกในรอบนี้ (ถูกจำกัดความถี่)"}`);
  if (correct) console.log(`  → สรุป: server ยอมให้ยิงคำรัว ๆ ได้ ผู้เล่นไม่ต้องเก่งก็ชนะทุกตา`);
  else console.log(`  → สรุป: การยิงรัวถูก server ปัดทิ้ง ไม่ทายถูกจากการสแปม`);

  host.disconnect();
  guesser.disconnect();
  await sleep(100);
  process.exit(0);
}

main().catch((e) => { console.error("สคริปต์ผิดพลาด:", e.message); process.exit(1); });
