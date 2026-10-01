/**
 * smoke test ของ server — รันด้วย `npm test` (ในโฟลเดอร์ server)
 *
 * ไม่ต้องเปิด server ไว้ก่อน ไฟล์นี้สตาร์ท server เองและปิดเองตอนจบ
 * แต่ต้องไม่มีอะไรรันอยู่บนพอร์ต 3000 ถ้ามีจะฟ้องให้ปิดก่อน
 * (ตั้งใจแบบนี้ เพื่อให้เทส "โค้ดล่าสุด" เสมอ ไม่เผลอไปเทส server ตัวเก่าที่เปิดค้างไว้)
 *
 * เทสอะไรบ้าง: ห้อง/รหัส error · สิทธิ์หัวห้อง · ตั้งค่าห้อง · เริ่มเกม ·
 * เลือกคำ · คำใบ้ · จับเวลา · แชทกันโกง · ทายถูก-ผิด · คิดคะแนน · จบตา · จบเกม
 */
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const SERVER_DIR = path.join(__dirname, "..");
const URL = "http://localhost:3000";

// ใช้ client ของ socket.io ที่มีอยู่ใน node_modules แล้วรันบน Node ได้เลย
// ต้องอ้อมผ่าน package.json เพราะ exports map ของ socket.io ไม่เปิดให้ require "socket.io/client-dist/..." ตรงๆ
const io = require(path.join(path.dirname(require.resolve("socket.io/package.json")), "client-dist", "socket.io.js"));

// ---------- ตัวนับผล ----------
let passed = 0;
let failed = 0;
const problems = [];

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? passed++ : failed++;
  if (!ok) problems.push(label);
  console.log(`${ok ? "✅" : "❌"} ${label}${ok ? "" : `  ได้ ${JSON.stringify(actual)} คาดว่า ${JSON.stringify(expected)}`}`);
}

function checkOk(label, condition) {
  check(label, !!condition, true);
}

async function runPart(label, fn) {
  // จับเวลารายข้อไว้เสมอ ข้อไหนกินเวลาเกิน 5 วิจะขึ้นหมายเหตุ
  // (มีไว้จับว่าอะไรทำให้ชุดเทสทั้งชุดเข้าใกล้เพดาน 90 วิของ watchdog โดยไม่ต้องเดา)
  const started = Date.now();
  try {
    await fn();
  } catch (e) {
    failed++;
    problems.push(label);
    console.log(`❌ ${label} — พังกลางทาง: ${e.message}`);
  }
  const sec = (Date.now() - started) / 1000;
  if (sec >= 5) console.log(`   ⏱ ${label.slice(0, 40)} ใช้เวลา ${sec.toFixed(1)} วิ`);
}

// ---------- ตัวช่วยคุยกับ server ----------
function connect() {
  return new Promise((resolve, reject) => {
    const socket = io(URL, { transports: ["websocket"] });
    const timer = setTimeout(() => reject(new Error("ต่อ server ไม่ติด")), 8000);
    socket.on("connect", () => { clearTimeout(timer); resolve(socket); });
    socket.on("connect_error", (e) => { clearTimeout(timer); reject(e); });
  });
}

// เก็บทุก event ที่ socket นี้ได้รับไว้ดูย้อนหลัง
// ทำแบบนี้เพื่อไม่พลาด event ที่มาถึงก่อนเราจะเรียก wait (ซึ่งเกิดได้บ่อยมาก)
function track(socket) {
  const events = [];
  socket.onAny((name, ...args) => events.push({ name, args }));

  const rec = {
    socket,
    clear() { events.length = 0; },
    // predicate ส่ง null/undefined มาได้ แปลว่า "เอา event ชื่อนี้ตัวแรกก็พอ"
    wait(name, predicate, ms = 4000) {
      const match = typeof predicate === "function" ? predicate : () => true;
      return new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = setInterval(() => {
          const hit = events.find((e) => e.name === name && match(e.args[0]));
          if (hit) { clearInterval(tick); resolve(hit.args[0]); return; }
          if (Date.now() - started > ms) {
            clearInterval(tick);
            reject(new Error(`ไม่ได้รับ ${name} ภายใน ${ms} ms`));
          }
        }, 10);
      });
    },
    // เหมือน wait แต่คืน null แทนการ throw เมื่อไม่ได้รับ
    async tryWait(name, predicate, ms) {
      try { return await rec.wait(name, predicate, ms); } catch { return null; }
    },
    // รอสักพักแล้วคืนรายการ event ที่ได้รับ (ใช้เช็คว่า "ต้องไม่มีอะไรเกิดขึ้น")
    quiet(name, ms = 600) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(events.filter((e) => e.name === name)), ms);
      });
    },
  };
  return rec;
}

function clearAll(...recs) { recs.forEach((r) => r.clear()); }

function emitAck(socket, event, data, ms = 4000) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, ms);
    socket.emit(event, data, (res) => { if (!done) { done = true; clearTimeout(timer); resolve(res); } });
  });
}

// คำนวณช่องคำใบ้ตามกติกาที่เขียนไว้ใน events.md
// (สระบนล่าง ไม้ไต่คู้ การันต์ ไม่นับเป็นช่อง · ช่องที่มีวรรณยุกต์เป็น tone: true)
// เขียนซ้ำจากกติกาใน events.md โดยตั้งใจ เพื่อจับได้ถ้าวันหนึ่งมีคนแก้ makeHint แล้วพฤติกรรมเปลี่ยน
function expectedHint(word) {
  const slots = [];
  for (const ch of word) {
    if (/[่-๋]/.test(ch)) {
      if (slots.length > 0) slots[slots.length - 1].tone = true;
    } else if (/[ัิ-ฺ็์-๎]/.test(ch)) {
      // สระบนล่าง ไม้ไต่คู้ การันต์ — ไม่นับเป็นช่อง
    } else if (ch === " ") {
      slots.push({ space: true });
    } else {
      slots.push({ tone: false });
    }
  }
  return slots;
}

// 8 สีหลักที่ colour_fix สุ่มจาก (events.md หัวข้อ 5) — ต้องตรงกับ CHALLENGE_COLORS ใน index.js
// เขียนซ้ำโดยตั้งใจ แบบเดียวกับ expectedHint เพื่อจับได้ถ้ามีคนแก้ชุดสีแล้วลืมแก้เอกสาร
const MAIN_COLORS = ["#000000", "#ffffff", "#e8553f", "#ef8a2b", "#ffc81e", "#22a559", "#1e6fe8", "#7b5ce0"];

// ชื่อ event ทั้งหมดที่เกี่ยวกับการวาด — ใช้เช็คว่า "ต้องไม่มีอะไรหลุดถึงคนอื่นเลย"
const DRAW_EVENT_NAMES = ["stroke_start", "stroke_points", "stroke_end", "fill"];

// อ่านคลังคำจากไฟล์จริง มาเทียบกับที่ server รายงาน
function readWordFile() {
  return JSON.parse(fs.readFileSync(path.join(SERVER_DIR, "data", "words.json"), "utf8"));
}

// 10 คำสำรองที่ฝังใน server/index.js — ใช้เช็คว่าโหมดปกติไม่ได้ใช้ตัวสำรอง
const FALLBACK_WORDS = ["แมว", "หมา", "บ้าน", "รถไฟ", "ร่ม", "ดอกไม้", "ปลา", "ต้นไม้", "จักรยาน", "ไอศกรีม"];

// ---------- สตาร์ท/ปิด server ----------
async function serverIsUp() {
  try {
    const res = await fetch(`${URL}/test.html`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitUntilUp(ms = 10000) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    if (await serverIsUp()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

let child = null;
let serverLog = [];

async function startServer() {
  if (await serverIsUp()) {
    console.log("⚠️  มีอะไรรันอยู่บนพอร์ต 3000 แล้ว");
    console.log("   ปิดตัวนั้นก่อน (Ctrl+C) แล้วรัน npm test ใหม่");
    console.log("   เหตุผล: ต้องเทสโค้ดล่าสุด ถ้าใช้ server ตัวเก่าที่เปิดค้างอยู่ ผลเทสจะไม่น่าเชื่อถือ\n");
    process.exit(1);
  }

  child = spawn(process.execPath, ["index.js"], { cwd: SERVER_DIR, stdio: ["ignore", "pipe", "pipe"] });
  const collect = (buf) => serverLog.push(buf.toString().trimEnd());
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  if (!(await waitUntilUp())) {
    console.log("❌ สตาร์ท server ไม่สำเร็จใน 10 วินาที");
    console.log(serverLog.join("\n"));
    child.kill();
    process.exit(1);
  }
}

function stopServer() {
  if (child && !child.killed) child.kill();
  child = null;
}

// ================= เทส =================
async function main() {
  await startServer();

  // คำทุกคำที่ server สุ่มมาให้คนวาดเลือก สะสมไว้ใช้เช็คตอนท้าย (ข้อ 8)
  const drawnOptions = [];

  await runPart("0. คลังคำ — โหลดจาก words.json", async () => {
    const bank = readWordFile();
    const counts = ["easy", "medium", "hard"].map((lv) => (bank[lv] ?? []).length);
    const total = counts.reduce((a, b) => a + b, 0);

    // server พิมพ์บรรทัดสรุปตอนสตาร์ท อ่านจาก log ตรงๆ ว่ารับไฟล์ไปใช้จริงไหม
    const line = serverLog.join("\n").split("\n").find((l) => l.includes("คลังคำ:"));
    checkOk("server บอกว่าอ่านคลังคำจาก words.json (ไม่ใช่คำสำรอง)",
      !!line && line.includes("จาก words.json"));

    // เทียบตัวเลขที่ server รายงาน กับจำนวนที่มีจริงในไฟล์
    const m = /easy (\d+) \/ medium (\d+) \/ hard (\d+) \(รวม (\d+) คำ\)/.exec(line ?? "");
    check("จำนวนคำแต่ละระดับตรงกับในไฟล์", m ? [+m[1], +m[2], +m[3]] : null, counts);
    check("รวมทุกระดับตรงกับในไฟล์", m ? +m[4] : null, total);

    // คำยาวเกิน 12 ตัว: server ต้องเตือนใน log พอดีกับที่มีในไฟล์
    // (เตือนอย่างเดียว ไม่ตัดคำทิ้ง · นับเป็น "จำนวนอักขระ" ซึ่งมากกว่าตัวที่ตาเห็น
    //  เพราะสระบนล่างและวรรณยุกต์เป็นอักขระแยก เช่น "ต้นไม้" = 6)
    const longWords = ["easy", "medium", "hard"]
      .flatMap((lv) => (bank[lv] ?? []).map((it) => it.word))
      .filter((w) => [...w].length > 12);
    check(`เตือนคำยาวเกิน 12 ตัว ตรงกับในไฟล์ (ในไฟล์มี ${longWords.length} คำ)`,
      serverLog.join("\n").includes("ยาวเกิน"), longWords.length > 0);
  });

  const A = track(await connect()); // หัวห้อง
  const B = track(await connect());
  const C = track(await connect());
  const others = []; // socket ที่ใช้เทสห้องเต็ม/หัวห้องย้าย

  let code = null;
  let word = null;

  await runPart("1. สร้างห้องและเข้าห้อง", async () => {
    const res = await emitAck(A.socket, "create_room", { name: "Mew", avatar: 3 });
    check("create_room ตอบ ok", res?.ok, true);
    code = res.code;
    checkOk("รหัสห้องเป็นเลข 5 หลัก", /^\d{5}$/.test(code ?? ""));
    check("create_room คืน playerId = socket.id", res.playerId, A.socket.id);

    const room = await A.wait("room_update");
    check("ห้องใหม่ status = lobby", room.status, "lobby");
    check("คนสร้างเป็นหัวห้อง", room.hostId, A.socket.id);
    check("avatar ที่ส่งมาถูกต้อง = 3", room.players[0].avatar, 3);
    check("คะแนนเริ่มต้น = 0", room.players[0].score, 0);

    clearAll(A, B, C);
    const join = await emitAck(B.socket, "join_room", { code, name: "Tar", avatar: 99 });
    check("join_room ตอบ ok", join?.ok, true);
    const room2 = await B.wait("room_update");
    check("ในห้องมี 2 คน", room2.players.length, 2);
    check("avatar 99 (เกินช่วง) ถูกบังคับเป็น 0", room2.players.find((p) => p.name === "Tar").avatar, 0);
    check("คนเข้าทีหลังไม่ใช่หัวห้อง", room2.players.find((p) => p.name === "Tar").isHost, false);

    clearAll(A, B, C);
    const join2 = await emitAck(C.socket, "join_room", { code, name: "Joy", avatar: 5 });
    check("คนที่ 3 เข้าห้องได้", join2?.ok, true);
    check("ในห้องมี 3 คน", (await C.wait("room_update")).players.length, 3);
  });

  await runPart("2. รหัส error ตอนเข้าห้อง", async () => {
    const D = track(await connect());
    others.push(D);
    check("ชื่อว่าง -> INVALID_NAME",
      (await emitAck(D.socket, "create_room", { name: "   ", avatar: 1 }))?.error, "INVALID_NAME");
    check("ชื่อซ้ำในห้อง -> NAME_TAKEN",
      (await emitAck(D.socket, "join_room", { code, name: "Mew", avatar: 1 }))?.error, "NAME_TAKEN");
    check("รหัสห้องผิด -> ROOM_NOT_FOUND",
      (await emitAck(D.socket, "join_room", { code: "00000", name: "X", avatar: 1 }))?.error, "ROOM_NOT_FOUND");
  });

  await runPart("3. ห้องเต็ม · หัวห้องย้าย · เริ่มเกมคนเดียว", async () => {
    const host = track(await connect());
    others.push(host);
    const rH = await emitAck(host.socket, "create_room", { name: "Host", avatar: 0 });
    checkOk("สร้างห้องที่สองได้", rH?.ok && rH.code !== code);

    clearAll(host);
    host.socket.emit("start_game");
    check("กดเริ่มตอนมีคนเดียว -> NOT_ENOUGH_PLAYERS",
      (await host.tryWait("game_error", (e) => e.code === "NOT_ENOUGH_PLAYERS", 2000))?.code, "NOT_ENOUGH_PLAYERS");

    // อัดให้ครบ 8 คน (สูงสุดตาม events.md) แล้วลองคนที่ 9
    const roomMates = [];
    for (let i = 0; i < 7; i++) {
      const p = track(await connect());
      others.push(p);
      roomMates.push(p);
      await emitAck(p.socket, "join_room", { code: rH.code, name: `P${i}`, avatar: 0 });
    }
    const ninth = track(await connect());
    others.push(ninth);
    check("ห้อง 8 คนแล้ว คนที่ 9 -> ROOM_FULL",
      (await emitAck(ninth.socket, "join_room", { code: rH.code, name: "TooMany", avatar: 0 }))?.error, "ROOM_FULL");

    // หัวห้องหลุด -> คนถัดไปต้องเป็นหัวห้องแทน
    const nextUp = roomMates[0]; // P0 = คนที่เข้าห้องนี้เป็นคนที่สอง
    clearAll(nextUp);
    host.socket.disconnect();
    const after = await nextUp.wait("room_update", (r) => r.hostId !== rH.playerId, 3000);
    check("หัวห้องออกแล้ว คนถัดไปได้เป็นหัวห้อง", after.hostId, nextUp.socket.id);
    check("จำนวนคนเหลือ 7", after.players.length, 7);
  });

  await runPart("4. สิทธิ์และการตั้งค่าห้อง", async () => {
    clearAll(A, B, C);
    B.socket.emit("update_settings", { rounds: 1, drawTime: 30 });
    check("คนไม่ใช่หัวห้องแก้ตั้งค่า -> NOT_HOST",
      (await B.tryWait("game_error", (e) => e.code === "NOT_HOST", 2000))?.code, "NOT_HOST");

    clearAll(A, B, C);
    A.socket.emit("update_settings", { rounds: 1, drawTime: 30 });
    let room = await A.wait("room_update");
    check("หัวห้องตั้ง rounds = 1 ได้", room.settings.rounds, 1);
    check("หัวห้องตั้ง drawTime = 30 ได้", room.settings.drawTime, 30);

    clearAll(A, B, C);
    A.socket.emit("update_settings", { rounds: 99, drawTime: 7 });
    room = await A.wait("room_update");
    check("rounds 99 (ไม่อยู่ในลิสต์) ถูกเมิน", room.settings.rounds, 1);
    check("drawTime 7 (ไม่อยู่ในลิสต์) ถูกเมิน", room.settings.drawTime, 30);

    clearAll(A, B, C);
    B.socket.emit("start_game");
    check("คนไม่ใช่หัวห้องกดเริ่ม -> NOT_HOST",
      (await B.tryWait("game_error", (e) => e.code === "NOT_HOST", 2000))?.code, "NOT_HOST");
  });

  await runPart("5. ตาที่ 1 — เลือกคำ คำใบ้ และแชทกันโกง", async () => {
    clearAll(A, B, C);
    A.socket.emit("start_game");
    check("ทุกคนได้ game_started", (await B.wait("game_started")).mode, "classic");
    check("totalRounds ตามที่ตั้งไว้", (await C.wait("game_started")).totalRounds, 1);

    const cw = await A.wait("choose_word", null, 5000);
    check("คนวาดได้ตัวเลือก 3 คำ", cw.options.length, 3);
    checkOk("ตัวเลือกไม่ซ้ำกัน", new Set(cw.options).size === 3);
    drawnOptions.push(...cw.options);
    check("ให้เวลาเลือก 10 วินาที", cw.time, 10);

    // เลือกตัวสุดท้าย เพื่อพิสูจน์ว่า server ใช้คำที่เลือกจริง (ไม่ใช่ตัวแรกซึ่งเป็นค่าที่ server สุ่มให้เองตอนหมดเวลา)
    word = cw.options[2];
    A.socket.emit("word_chosen", { word });

    const rs = await A.wait("round_start", null, 3000);
    check("round_start บอกคนวาดถูกคน", rs.drawerId, A.socket.id);
    check("รอบที่ 1 จาก 1", [rs.round, rs.totalRounds], [1, 1]);
    check("เวลาที่เหลือ = เวลาเต็ม 30 วิ", rs.time, 30);
    check("ไม่มีคำจริงหลุดมาใน round_start", "word" in rs, false);
    // คำใบ้ขึ้นช้า: เริ่มตายังไม่เห็นช่องคำใบ้ ต้องรอถึงเวลาเหลือหนึ่งในสาม หรือให้คนวาดกดขอ
    check("คำใบ้ยังไม่เปิดตอนเริ่มตา (hint = null)", rs.hint, null);
    check("hintAt = หนึ่งในสามของเวลาเต็ม ปัดลง (30 วิ → 10)", rs.hintAt, 10);
    check("คนวาดได้คำจริงทาง your_word", (await A.wait("your_word")).word, word);
    checkOk("คนทายไม่ได้ your_word", await B.tryWait("your_word", null, 400) === null);

    // คนวาดกดขอเปิดก่อนเวลา — เป็นทางเดียวที่จะได้เห็นช่องคำใบ้ก่อนถึงกำหนด
    clearAll(A, B, C);
    A.socket.emit("request_hint");
    const hr = await B.wait("hint_reveal", null, 3000);
    check("คนวาดกดขอเปิดคำใบ้ก่อนเวลาได้", hr.by, "drawer");
    check("ช่องคำใบ้ที่เปิด ตรงกับกติกาใน events.md", hr.hint, expectedHint(word));

    const tick = await A.wait("timer", null, 2500);
    checkOk("timer วิ่งและไม่เกินเวลาเต็ม", tick.timeLeft <= 30 && tick.timeLeft >= 1);

    // ทายผิด -> ทุกคนเห็น
    clearAll(A, B, C);
    B.socket.emit("guess", { text: "zzzไม่ใช่คำตอบzzz" });
    check("ทายผิด ส่งถึงทุกคน (คนวาดเห็นด้วย)",
      (await A.wait("chat_message")).text, "zzzไม่ใช่คำตอบzzz");
    check("ทายผิด ไม่ติด correct", "correct" in (await C.wait("chat_message")), false);

    // คนวาดพิมพ์ไม่ได้
    clearAll(A, B, C);
    A.socket.emit("guess", { text: "ฉันคือคนวาด" });
    check("คนวาดพิมพ์ในแชท -> ไม่มีใครเห็น", (await B.quiet("chat_message", 600)).length, 0);
    check("คนวาดพิมพ์ในแชท -> ไม่มีใครเห็น (อีกคน)", (await C.quiet("chat_message", 100)).length, 0);

    // ทายถูก -> ตัวเองเห็นคำจริง คนอื่นเห็น ******
    clearAll(A, B, C);
    C.socket.emit("guess", { text: word });
    const mine = await C.wait("chat_message", (m) => m.correct === true);
    check("คนทายถูกเห็นคำของตัวเอง", mine.text, word);
    const masked = await A.wait("chat_message", (m) => m.correct === true);
    check("คนอื่นเห็นเป็น ****** 6 ตัว", masked.text, "******");
    check("correct_guess บอกชื่อคนทายถูก", (await A.wait("correct_guess")).name, "Joy");

    const scored = await A.wait("room_update", (r) => r.players.some((p) => p.score > 0));
    const joy = scored.players.find((p) => p.name === "Joy");
    const mew = scored.players.find((p) => p.name === "Mew");
    checkOk("คะแนนคนทาย = 50 + เวลาที่เหลือ × 5", joy.score >= 55 && joy.score <= 200 && (joy.score - 50) % 5 === 0);
    check("คนวาดได้ 50 ต่อคนที่ทายถูก", mew.score, 50);

    // คนที่ทายถูกแล้ว คุยได้แค่กับคนวาดและคนที่ทายถูกแล้ว
    clearAll(A, B, C);
    C.socket.emit("guess", { text: "คุยหลังทายถูก" });
    check("ข้อความของคนทายถูก ส่งถึงคนวาด", (await A.wait("chat_message")).text, "คุยหลังทายถูก");
    check("ข้อความของคนทายถูก ไม่ส่งถึงคนที่ยังไม่ทาย", (await B.quiet("chat_message", 600)).length, 0);

    // ทายถูกครบทุกคนแล้วต้องจบตาทันที
    clearAll(A, B, C);
    B.socket.emit("guess", { text: word });
    const re = await A.wait("round_end", null, 4000);
    check("ทายครบทุกคนแล้วจบตาทันที", re.word, word);
    check("ผลของตามีครบ 3 คน", re.results.length, 3);
    checkOk("ผลของตาเป็นตัวเลขคะแนนที่ได้", re.results.every((r) => typeof r.playerId === "string" && typeof r.gained === "number"));
  });

  await runPart("6. ตาที่ 2 และ 3 — จบครบรอบแล้วจบเกม", async () => {
    // turnOrder คือลำดับที่เข้าห้อง = Mew(A) -> Tar(B) -> Joy(C)
    const turn2 = { drawer: B, guessers: [A, C] };
    const turn3 = { drawer: C, guessers: [A, B] };

    for (const [index, t] of [turn2, turn3].entries()) {
      const label = `ตา ${index + 2}`;
      clearAll(A, B, C);
      const cw = await t.drawer.wait("choose_word", null, 7000);
      check(`${label}: คนวาดได้ตัวเลือก 3 คำ`, cw.options.length, 3);
      drawnOptions.push(...cw.options);

      const w = cw.options[2];
      t.drawer.socket.emit("word_chosen", { word: w });
      const rs = await A.wait("round_start", null, 3000);
      check(`${label}: คำใบ้ยังไม่เปิดตอนเริ่มตา`, rs.hint, null);
      check(`${label}: ไม่มีคำจริงใน round_start`, "word" in rs, false);
      check(`${label}: your_word ตรงกับคำที่เลือก`, (await t.drawer.wait("your_word")).word, w);
      t.drawer.socket.emit("request_hint");
      check(`${label}: คนวาดขอแล้วช่องคำใบ้ตรงกับกติกา`,
        (await A.wait("hint_reveal", null, 3000)).hint, expectedHint(w));

      clearAll(A, B, C);
      for (const g of t.guessers) g.socket.emit("guess", { text: w });
      const re = await A.wait("round_end", null, 5000);
      check(`${label}: จบตาด้วยคำที่ถูก`, re.word, w);
    }

    clearAll(A, B, C);
    const ge = await A.wait("game_end", null, 8000);
    check("จบเกมแล้วได้อันดับครบ 3 คน", ge.ranking.length, 3);
    checkOk("อันดับเรียงจากคะแนนมากไปน้อย",
      ge.ranking.every((p, i) => i === 0 || ge.ranking[i - 1].score >= p.score));
    checkOk("อันดับมีทั้งชื่อและคะแนน",
      ge.ranking.every((p) => typeof p.name === "string" && typeof p.score === "number"));
    check("หลังจบเกม status = ended",
      (await A.wait("room_update", (r) => r.status === "ended", 3000)).status, "ended");

    // เริ่มรอบใหม่หลังจบเกมได้ คะแนนต้องรีเซ็ต
    clearAll(A, B, C);
    A.socket.emit("start_game");
    check("จบเกมแล้วกดเริ่มใหม่ได้", (await B.wait("game_started", null, 3000)).totalRounds, 1);
    const again = await A.wait("room_update", (r) => r.players.length > 0, 3000);
    checkOk("เริ่มรอบใหม่แล้วคะแนนทุกคนกลับเป็น 0", again.players.every((p) => p.score === 0));
  });

  await runPart("8. คำที่ออกมาจริง มาจากไฟล์ ไม่ใช่คำสำรอง", async () => {
    const bank = readWordFile();
    const inFile = new Set(
      ["easy", "medium", "hard"].flatMap((lv) => (bank[lv] ?? []).map((it) => it.word))
    );

    // 3 ตา ตาละ 3 ตัวเลือก
    checkOk(`เก็บคำที่ server สุ่มมาได้ ${drawnOptions.length} คำ`, drawnOptions.length >= 9);
    checkOk("ทุกคำที่ออกมา อยู่ใน words.json", drawnOptions.every((w) => inFile.has(w)));

    // ชุดสำรอง 10 คำ ทับกับในไฟล์ 9 คำ เหลือ "รถไฟ" คำเดียวที่ไม่มีในไฟล์
    // ถ้า server เผลอใช้คำสำรอง ตัวเลือกทั้ง 9 จะมาจาก 10 คำนั้นเท่านั้น
    // การมีคำนอกชุดสำรองโผล่มา จึงพิสูจน์ว่าใช้คลังจริง (โอกาสพลาดน้อยมากจนไม่ต้องกังวล
    // ส่วนข้อ 0 ที่เช็คจาก log เป็นตัวยืนยันแบบแน่นอน 100% อยู่แล้ว)
    const outside = drawnOptions.filter((w) => !FALLBACK_WORDS.includes(w));
    checkOk(`มีคำที่ไม่อยู่ในชุดสำรอง 10 คำ (ได้ ${outside.length} คำ)`, outside.length > 0);
  });

  // ══════════════════════════════════════════════════════════════════
  // ตัวช่วยของข้อ 5 — เปิดห้องจริงหนึ่งห้อง แล้วเริ่มเกมจนถึงตาที่กำลังวาด
  //
  // ใช้ทั้งตอน "หาห้องที่ต้องการ" และตอน "สร้างห้องตัวอย่าง"
  // **ไม่มีการสั่งให้ server ออก challenge ที่ต้องการ** — challenge เป็นการสุ่มจริง
  // วิธีเดียวที่จะได้ชนิดที่ต้องการคือสร้างห้องใหม่ไปเรื่อย ๆ (ดู CHALLENGE_TRIES)
  // ══════════════════════════════════════════════════════════════════
  async function openTurn(prefix, extraGuessers = 1) {
    const recs = [track(await connect())];
    for (let i = 0; i < extraGuessers; i++) recs.push(track(await connect()));
    const [drawer, ...guessers] = recs;

    const code = (await emitAck(drawer.socket, "create_room", { name: `${prefix}Draw`, avatar: 0 })).code;
    for (const [i, g] of guessers.entries()) {
      await emitAck(g.socket, "join_room", { code, name: `${prefix}G${i + 1}`, avatar: i + 1 });
    }

    // drawTime 90 (ค่าสูงสุด) = ตาเดียวอยู่นานพอให้ตรวจหลายอย่างโดยไม่ถูกจับเวลาแทรก
    drawer.socket.emit("update_settings", { rounds: 1, drawTime: 90 });
    await drawer.tryWait("room_update", (r) => r.settings?.drawTime === 90, 3000);

    clearAll(...recs);
    drawer.socket.emit("start_game");
    const cw = await drawer.wait("choose_word", null, 3000);
    const word = cw.options[0];
    drawer.socket.emit("word_chosen", { word });

    const rs = await drawer.wait("round_start", null, 3000);
    const rsGuess = await guessers[0].wait("round_start", null, 3000);
    return {
      drawer,
      guessers,
      guesser: guessers[0],
      recs,
      code,
      word,
      rs,
      rsGuess,
      challenge: rs.challenge,
      // ปิดห้องนี้ทิ้ง (ใช้ตอนหาห้องแล้วไม่ได้ชนิดที่ต้องการ)
      close() {
        for (const r of recs) r.socket.disconnect();
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // ข้อ 4 — การวาด ย้อนกลับ ทำซ้ำ และการกันโกง
  // แยกห้องใหม่ต่างหาก เพื่อไม่ให้ปนกับห้องของข้อ 1-6 ที่จบเกมไปแล้ว
  //
  // ห้องนี้ใช้ทั้งข้อ 9-14 ซึ่งวาดหลายรูปแบบ (เทสี ย้อนกลับ ทำซ้ำ หลายเส้น)
  // แต่ challenge ถูก "สุ่มจริง" ทุกตา ถ้าตานี้ออก colour_fix สีที่เทสใช้จะถูกทิ้ง
  // และถ้าออก dont_lift_pen จะวาดได้เส้นเดียวทั้งตา → เทสชุดนี้จะผ่านบ้างไม่ผ่านบ้างตามดวง
  // จึงต้อง "หาห้องที่ตานี้ออก none" ก่อน โดยสร้างห้องจริงแล้วเริ่มเกมจริง ไม่ได้แอบสั่งให้ออก none
  // ดวง: p(none) = 0.4 → เฉลี่ย 2-3 ห้อง · โอกาสไม่เจอใน 30 ห้อง = 0.6^30 ≈ 2e-7
  // ══════════════════════════════════════════════════════════════════
  let D = null; // หัวห้อง = คนวาด
  let E = null; // คนทาย
  let F = null; // คนทายอีกคน ไว้ดูว่าทุกคนเห็นเหมือนกัน
  let dcode = null;
  let dword = null;
  let dchallenge = null;

  for (let attempt = 1; attempt <= 30 && !D; attempt++) {
    const room = await openTurn("T", 2);
    if (room.challenge?.type === "none") {
      [D, E, F] = room.recs;
      dcode = room.code;
      dword = room.word;
      dchallenge = room.challenge;
    } else {
      room.close();
      await new Promise((r) => setTimeout(r, 50)); // ให้ server เก็บห้องที่ทิ้งไปแล้วก่อน
    }
  }
  if (D) others.push(D, E, F);

  await runPart("9. การวาด — ส่งต่อให้คนอื่น และทิ้งข้อมูลที่ไม่ใช่ของคนวาด", async () => {
    checkOk("หาห้องที่ตานี้ออก Mini Challenge เป็น none เจอภายใน 30 ห้อง (เตรียมไว้ให้ข้อ 9-14)",
      D !== null);
    check("ตานี้ไม่มี Mini Challenge กวนการวาด", dchallenge?.type, "none");

    // ── เส้นหนึ่งเส้นเดินทางครบสามตอน ──
    clearAll(D, E, F);
    D.socket.emit("stroke_start", { x: 0.1, y: 0.1, color: "#000000", size: 5, tool: "pen" });
    const s1 = await E.wait("stroke_start", null, 2000);
    check("stroke_start ถึงคนอื่นครบทุกช่อง",
      [s1.x, s1.y, s1.color, s1.size, s1.tool], [0.1, 0.1, "#000000", 5, "pen"]);
    check("คนวาดไม่ได้รับ action ของตัวเองกลับมา", (await D.quiet("stroke_start", 500)).length, 0);

    clearAll(D, E, F);
    D.socket.emit("stroke_points", { points: [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }] });
    check("stroke_points ส่งถึงคนอื่นตามลำดับ",
      (await E.wait("stroke_points", null, 2000)).points, [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }]);

    // จุดที่ซ้ำกับจุดก่อนหน้าสนิท ต้องถูกกรองออก (เป็นตัวการของ "เส้นเหลี่ยม")
    clearAll(D, E, F);
    D.socket.emit("stroke_points", { points: [{ x: 0.3, y: 0.3 }, { x: 0.4, y: 0.4 }] });
    check("จุดซ้ำตำแหน่งเดิมถูกกรองทิ้ง เหลือแต่จุดใหม่",
      (await E.wait("stroke_points", (p) => p.points.some((q) => q.x === 0.4), 2000)).points,
      [{ x: 0.4, y: 0.4 }]);

    clearAll(D, E, F);
    D.socket.emit("stroke_points", { points: [{ x: 0.4, y: 0.4 }, { x: 0.4, y: 0.4 }] });
    check("ข้อความที่เป็นจุดซ้ำล้วน ไม่ถูกส่งต่อ", (await E.quiet("stroke_points", 600)).length, 0);

    clearAll(D, E, F);
    D.socket.emit("stroke_end");
    checkOk("stroke_end ถึงคนอื่น", (await E.tryWait("stroke_end", null, 2000)) !== null);

    // ── ข้อมูลที่ไม่มีเส้นรองรับ ต้องถูกทิ้ง ──
    clearAll(D, E, F);
    D.socket.emit("stroke_points", { points: [{ x: 0.5, y: 0.5 }] });
    D.socket.emit("stroke_end");
    check("จุดที่ไม่มีเส้นค้างอยู่ ถูกทิ้ง", (await E.quiet("stroke_points", 600)).length, 0);
    check("stroke_end ที่ไม่มีเส้นค้างอยู่ ถูกทิ้ง", (await E.quiet("stroke_end", 1)).length, 0);

    // ── เทสี และล้างจอ ──
    clearAll(D, E, F);
    D.socket.emit("fill", { x: 0.8, y: 0.8, color: "#22a559" });
    check("fill ถึงคนอื่น", await E.wait("fill", null, 2000), { x: 0.8, y: 0.8, color: "#22a559" });

    clearAll(D, E, F);
    D.socket.emit("clear_canvas");
    checkOk("clear_canvas ถึงคนอื่น", (await E.tryWait("clear_canvas", null, 2000)) !== null);
    checkOk("clear_canvas ถึงทุกคนในห้องพร้อมกัน", (await F.tryWait("clear_canvas", null, 500)) !== null);
  });

  await runPart("10. กันโกง — คนที่ไม่ใช่คนวาดส่งการวาดมา", async () => {
    // E กับ F เป็นคนทาย ไม่มีสิทธิ์วาด ส่งมาทุกแบบที่วาดได้
    clearAll(D, E, F);
    E.socket.emit("stroke_start", { x: 0.1, y: 0.1, color: "#000000", size: 5, tool: "pen" });
    E.socket.emit("stroke_points", { points: [{ x: 0.2, y: 0.2 }] });
    E.socket.emit("stroke_end");
    E.socket.emit("fill", { x: 0.5, y: 0.5, color: "#ff0000" });
    E.socket.emit("clear_canvas");
    E.socket.emit("undo");
    E.socket.emit("redo");
    F.socket.emit("stroke_start", { x: 0.9, y: 0.9, color: "#000000", size: 5, tool: "pen" });

    // รอให้ของที่หลุดมาถึงก่อน (ถ้ามี) แล้วค่อยนับ
    await D.quiet("stroke_start", 800);
    const names = ["stroke_start", "stroke_points", "stroke_end", "fill", "clear_canvas"];
    let leaked = 0;
    for (const rec of [D, E, F]) {
      for (const n of names) leaked += (await rec.quiet(n, 1)).length;
    }
    check("การวาดจากคนที่ไม่ใช่คนวาด ไม่ถึงใครเลย", leaked, 0);
    checkOk("คนที่ไม่ใช่คนวาดกดย้อนกลับ ไม่มีอะไรเกิดขึ้น",
      (await D.tryWait("canvas_history", null, 600)) === null);

    // หลังพยายามโกงแล้ว คนวาดจริงต้องวาดได้ตามปกติ (server ยังไม่พัง)
    clearAll(D, E, F);
    D.socket.emit("stroke_start", { x: 0.3, y: 0.3, color: "#1e6fe8", size: 6, tool: "pen" });
    check("หลังพยายามโกง คนวาดจริงยังวาดได้",
      (await E.wait("stroke_start", null, 2000)).color, "#1e6fe8");
    D.socket.emit("stroke_end");
  });

  await runPart("11. ข้อมูลเพี้ยน — server ต้องไม่ล่มและต้องทิ้งเงียบ ๆ", async () => {
    const BAD_START = [
      { x: "0.5", y: 0.5, color: "#000000", size: 5, tool: "pen" }, // x เป็นข้อความ
      { x: -0.5, y: 0.5, color: "#000000", size: 5, tool: "pen" }, // ติดลบ
      { x: 0.5, y: 1.5, color: "#000000", size: 5, tool: "pen" }, // เกิน 1
      { x: null, y: 0.5, color: "#000000", size: 5, tool: "pen" }, // null (NaN ส่งผ่าน socket.io จะกลายเป็น null)
      { x: 0.5, y: 0.5, color: "red", size: 5, tool: "pen" }, // สีผิดรูปแบบ
      { x: 0.5, y: 0.5, color: "#12345", size: 5, tool: "pen" }, // hex ไม่ครบ 6 หลัก
      { x: 0.5, y: 0.5, color: "#000000", size: 9999, tool: "pen" }, // ขนาดเกินช่วง
      { x: 0.5, y: 0.5, color: "#000000", size: 0, tool: "pen" }, // ขนาดต่ำเกิน
      { x: 0.5, y: 0.5, color: "#000000", size: 5, tool: "eraser2" }, // tool ไม่รู้จัก
      { x: 0.5, y: 0.5, color: "#000000", size: 5 }, // ไม่มี tool
      { x: {}, y: [] }, // ชนิดผิดทั้งคู่
      null,
      "ข้อความ",
      42,
      [],
    ];

    clearAll(D, E, F);
    for (const bad of BAD_START) D.socket.emit("stroke_start", bad);
    check("stroke_start ที่ข้อมูลเพี้ยน ไม่มีสักตัวที่ถูกส่งต่อ",
      (await E.quiet("stroke_start", 800)).length, 0);

    // เปิดเส้นที่ถูกต้องไว้หนึ่งเส้น แล้วยิงจุดเพี้ยนใส่ (ต้องผ่านด่านแรกไปถึงด่านตรวจจุด)
    clearAll(D, E, F);
    D.socket.emit("stroke_start", { x: 0.5, y: 0.5, color: "#000000", size: 5, tool: "pen" });
    await E.wait("stroke_start", null, 2000);
    const BAD_POINTS = [
      { points: "ไม่ใช่ลิสต์" },
      { points: [] },
      { points: [{ x: 0.5 }] }, // ไม่มี y
      { points: [{ x: 0.5, y: 2 }] }, // y เกิน 1
      { points: [{ x: "0.5", y: 0.5 }] }, // x เป็นข้อความ
      { points: [{ x: 0.6, y: 0.6 }, null] }, // มีจุดที่ไม่ใช่ object ปนมา
      { points: Array.from({ length: 501 }, () => ({ x: 0.1, y: 0.1 })) }, // เกินเพดานจุดต่อข้อความ
      null,
      7,
    ];
    for (const bad of BAD_POINTS) D.socket.emit("stroke_points", bad);
    check("stroke_points ที่ข้อมูลเพี้ยน ไม่มีสักตัวที่ถูกส่งต่อ",
      (await E.quiet("stroke_points", 800)).length, 0);

    for (const bad of [{ x: 0.5, y: 0.5, color: "blue" }, { x: 2, y: 0.5, color: "#000000" }, null, "x", 9]) {
      D.socket.emit("fill", bad);
    }
    check("fill ที่ข้อมูลเพี้ยน ไม่มีสักตัวที่ถูกส่งต่อ", (await E.quiet("fill", 800)).length, 0);

    // หลังยิงของเพี้ยนไปทั้งชุด server ต้องยังทำงานปกติ
    clearAll(D, E, F);
    D.socket.emit("stroke_points", { points: [{ x: 0.7, y: 0.7 }] });
    check("หลังยิงข้อมูลเพี้ยนทั้งชุด server ยังทำงานปกติ",
      (await E.wait("stroke_points", null, 2000)).points, [{ x: 0.7, y: 0.7 }]);
    D.socket.emit("stroke_end");
  });

  await runPart("12. คนเข้าห้องกลางตา — ได้ภาพที่วาดไปแล้ว และติ๊กถูกของคนที่ทายถูก", async () => {
    // ให้ E ทายถูกก่อน เพื่อดูว่าคนที่เข้าทีหลังเห็น ✅ ของ E ไหม
    clearAll(D, E, F);
    E.socket.emit("guess", { text: dword });
    await E.wait("correct_guess", null, 3000);

    // วาดให้มีของในประวัติชัด ๆ หนึ่งชุด: ล้างจอ -> เส้น -> เทสี
    D.socket.emit("clear_canvas");
    await E.wait("clear_canvas", null, 2000);
    D.socket.emit("stroke_start", { x: 0.2, y: 0.2, color: "#ef8a2b", size: 8, tool: "pen" });
    D.socket.emit("stroke_points", { points: [{ x: 0.25, y: 0.25 }] });
    D.socket.emit("stroke_end");
    D.socket.emit("fill", { x: 0.6, y: 0.6, color: "#7b5ce0" });
    await E.wait("fill", null, 2000);

    const Late = track(await connect());
    others.push(Late);
    await emitAck(Late.socket, "join_room", { code: dcode, name: "Late", avatar: 4 });

    const rs = await Late.wait("round_start", null, 3000);
    checkOk("คนเข้าห้องกลางตาได้ round_start", !!rs);
    check("round_start บอกคนวาดถูกคน", rs.drawerId, D.socket.id);
    checkOk("round_start ส่ง guessedIds มาให้ (คนที่ทายถูกไปแล้ว)",
      Array.isArray(rs.guessedIds) && rs.guessedIds.includes(E.socket.id));
    checkOk("guessedIds ส่งแค่ id ไม่มีคำตอบปนมา",
      rs.guessedIds.every((v) => typeof v === "string"));
    check("ไม่มีคำจริงหลุดมาใน round_start ของคนเข้าทีหลัง", "word" in rs, false);

    const hist = await Late.wait("canvas_history", null, 3000);
    check("ประวัติที่ได้ เรียงตามลำดับที่วาดจริง",
      hist.items.slice(-5).map((it) => it.type),
      ["clear_canvas", "stroke_start", "stroke_points", "stroke_end", "fill"]);
    check("ประวัติเก็บสีของเส้นไว้ครบ", hist.items[hist.items.length - 4].color, "#ef8a2b");
    check("ประวัติบอกว่ายังย้อนกลับได้", hist.canUndo, true);
    check("ประวัติบอกว่ายังไม่มีอะไรให้ทำซ้ำ", hist.canRedo, false);

    // roomState ต้องไม่มีข้อมูลภาพวาดปนออกไป (กติกาใน CLAUDE.md)
    const room = await Late.wait("room_update", null, 3000);
    check("room_update ส่งเฉพาะช่องที่กำหนด ไม่มีข้อมูลภาพวาดติดมา",
      Object.keys(room).sort(), ["code", "hostId", "players", "settings", "status"]);
  });

  await runPart("13. ย้อนกลับ / ทำซ้ำ", async () => {
    // ตอนนี้การกระทำสุดท้ายคือ fill — ย้อนหนึ่งครั้ง fill ต้องหายไปทั้งอัน
    clearAll(D, E, F);
    D.socket.emit("undo");
    const h1 = await E.wait("canvas_history", null, 3000);
    check("ย้อนแล้วการกระทำสุดท้ายหายไปทั้งอัน (fill หายจากท้ายลิสต์)",
      h1.items[h1.items.length - 1].type, "stroke_end");
    check("ย้อนแล้วมีอะไรให้ทำซ้ำ", h1.canRedo, true);
    checkOk("คนวาดเองก็ได้ canvas_history ด้วย (จอตัวเองต้องย้อนตาม)",
      (await D.tryWait("canvas_history", null, 3000)) !== null);

    clearAll(D, E, F);
    D.socket.emit("redo");
    const h2 = await E.wait("canvas_history", null, 3000);
    check("ทำซ้ำแล้ว fill กลับมา", h2.items[h2.items.length - 1].type, "fill");
    check("ทำซ้ำจนหมดแล้วไม่มีอะไรให้ทำซ้ำอีก", h2.canRedo, false);
    check("ทำซ้ำจนหมดแล้วยังย้อนได้อยู่", h2.canUndo, true);

    // ย้อนแล้ววาดใหม่ = กองทำซ้ำหายทั้งกอง เหมือนโปรแกรมวาดรูปทั่วไป
    D.socket.emit("undo");
    await E.wait("canvas_history", (h) => h.canRedo === true, 3000);
    clearAll(D, E, F);
    D.socket.emit("stroke_start", { x: 0.9, y: 0.1, color: "#e8553f", size: 3, tool: "pen" });
    D.socket.emit("stroke_points", { points: [{ x: 0.95, y: 0.15 }] });
    D.socket.emit("stroke_end");
    await E.wait("stroke_end", null, 2000);

    // วิธีดูว่ากองทำซ้ำถูกล้างจริง: กดทำซ้ำแล้วต้องเงียบ
    // ถ้ากองยังมี fill เดิมค้างอยู่ มันจะคืน fill กลับมาแล้วส่ง canvas_history ออกมาทันที
    clearAll(D, E, F);
    D.socket.emit("redo");
    check("วาดใหม่หลังย้อนแล้ว กดทำซ้ำไม่ติด (กองทำซ้ำหายทั้งกอง)",
      (await E.quiet("canvas_history", 700)).length, 0);

    D.socket.emit("undo");
    const h3 = await E.wait("canvas_history", null, 3000);
    check("ย้อนแล้วได้เส้นที่เพิ่งวาดออกไป (fill เดิมไม่กลับมา)", h3.items[h3.items.length - 1].type, "stroke_end");
    check("ย้อนแล้วมีอะไรให้ทำซ้ำได้อีกครั้ง", h3.canRedo, true);

    // ย้อนรวดเดียวจนหมด ต้องย้อนไม่ได้อีก
    for (let i = 0; i < 60; i++) D.socket.emit("undo");
    const h4 = await E.wait("canvas_history", (h) => h.canUndo === false, 4000);
    check("ย้อนจนหมดแล้ว กระดานว่างและย้อนต่อไม่ได้", h4.items.length, 0);
    check("ย้อนจนหมดแล้วยังทำซ้ำได้", h4.canRedo, true);
  });

  await runPart("14. เพดานประวัติต่อตา — กันหน่วยความจำบวม", async () => {
    // ย้อนกลับมาที่ของเดิมก่อน เพื่อไม่ให้เริ่มจากกระดานว่าง
    D.socket.emit("redo");

    // ยิงจุดให้เกินเพดาน 30000 จุด (ข้อความละ 500 จุด = เพดานต่อข้อความพอดี)
    D.socket.emit("stroke_start", { x: 0, y: 0, color: "#000000", size: 5, tool: "pen" });
    for (let i = 0; i < 75; i++) {
      const points = Array.from({ length: 500 }, (_, k) => ({
        x: ((i * 500 + k) % 900) / 1000,
        y: ((i * 500 + k * 7) % 900) / 1000,
      }));
      D.socket.emit("stroke_points", { points });
    }
    await E.quiet("stroke_points", 800);

    checkOk("ชนเพดานแล้ว server เตือนใน log", serverLog.join("\n").includes("ชนเพดาน"));

    // สำคัญ: ถึงจะหยุดเก็บ แต่ยังต้อง "ส่งต่อ" ให้ทุกคนตามปกติ เกมจะได้ไม่สะดุด
    clearAll(D, E, F);
    D.socket.emit("stroke_points", { points: [{ x: 0.11, y: 0.12 }] });
    checkOk("ชนเพดานแล้วยังส่งจุดต่อให้คนอื่นตามปกติ",
      (await E.tryWait("stroke_points", null, 2000)) !== null);

    // และ server ต้องยังรับคำสั่งอื่นได้อยู่ ไม่ได้ค้าง
    clearAll(D, E, F);
    D.socket.emit("clear_canvas");
    checkOk("ชนเพดานแล้วยังสั่งล้างจอได้", (await E.tryWait("clear_canvas", null, 2000)) !== null);
    checkOk("ชนเพดานแล้ว server ยังไม่ตาย", (await emitAck(F.socket, "create_room", { name: "ยังอยู่", avatar: 0 }))?.ok === true);
  });

  // ══════════════════════════════════════════════════════════════════
  // ข้อ 15 — คำใบ้ขึ้นช้า
  // แยกห้องใหม่สองห้อง ไม่ให้ปนกับห้องข้อ 9-14 ที่มีประวัติค้างอยู่
  //   ห้อง A = เส้นทาง "คนวาดกดขอเปิดก่อนเวลา"
  //   ห้อง B = เส้นทาง "เวลาเหลือหนึ่งในสาม แล้ว server เปิดเอง"
  // เริ่มห้อง B ให้เวลาของมันเดินก่อน แล้วค่อยไปตรวจห้อง A ระหว่างนั้น
  // จะได้ไม่ต้องนั่งรอ 20 วินาทีเปล่า ๆ (drawTime ต่ำสุดที่ตั้งได้คือ 30 → เปิดเองตอนเหลือ 10)
  // ══════════════════════════════════════════════════════════════════
  const G = track(await connect()); // ห้อง A: หัวห้อง = คนวาด
  const H = track(await connect()); // ห้อง A: คนทาย
  const I = track(await connect()); // ห้อง A: คนทายอีกคน
  const P = track(await connect()); // ห้อง B: หัวห้อง = คนวาด
  const Q = track(await connect()); // ห้อง B: คนทาย
  others.push(G, H, I, P, Q);

  await runPart("15. คำใบ้ขึ้นช้า — ขอเปิดก่อนเวลา · เปิดเองตามเวลา · คนเข้าหลังเปิด", async () => {
    // ── ห้อง A: เส้นทางคนวาดกดขอ ──
    const acode = (await emitAck(G.socket, "create_room", { name: "HintDrawer", avatar: 0 })).code;
    await emitAck(H.socket, "join_room", { code: acode, name: "HintGuess1", avatar: 1 });
    await emitAck(I.socket, "join_room", { code: acode, name: "HintGuess2", avatar: 2 });
    clearAll(G, H, I);
    G.socket.emit("update_settings", { rounds: 1, drawTime: 30 });
    await G.wait("room_update", (r) => r.settings.drawTime === 30, 3000);

    clearAll(G, H, I);
    G.socket.emit("start_game");
    const acw = await G.wait("choose_word", null, 6000);
    const aWord = acw.options[0];
    G.socket.emit("word_chosen", { word: aWord });

    const ars = await H.wait("round_start", null, 3000);
    check("คนทายไม่เห็นคำใบ้ตอนเริ่มตา (hint = null)", ars.hint, null);
    check("hintAt = หนึ่งในสามของเวลาเต็ม ปัดลง (30 วิ → 10)", ars.hintAt, 10);
    check("ยังไม่มีคำจริงหลุดมาใน round_start", "word" in ars, false);

    // นับ hint_reveal ของห้อง A ไว้ใช้ตอนท้าย — ต้องได้ครั้งเดียวตลอดตา
    // (คนวาดกดขอไปแล้ว ต่อให้เวลาหมดถึงกำหนด server ก็ต้องไม่เปิดซ้ำ)
    let aReveals = 0;
    H.socket.on("hint_reveal", () => { aReveals++; });

    // ── ห้อง B: เส้นทางเวลาเปิดเอง — เริ่มตรงนี้ เพื่อให้เวลาของมันเดินระหว่างเทสห้อง A ──
    const bcode = (await emitAck(P.socket, "create_room", { name: "TimerDrawer", avatar: 3 })).code;
    await emitAck(Q.socket, "join_room", { code: bcode, name: "TimerGuess", avatar: 4 });
    clearAll(P, Q);
    P.socket.emit("update_settings", { rounds: 1, drawTime: 30 });
    await P.wait("room_update", (r) => r.settings.drawTime === 30, 3000);

    clearAll(P, Q);
    P.socket.emit("start_game");
    const bcw = await P.wait("choose_word", null, 6000);
    const bWord = bcw.options[0];
    P.socket.emit("word_chosen", { word: bWord });

    const brs = await Q.wait("round_start", null, 3000);
    check("ห้องเปิดเอง: ตอนเริ่มตายังไม่มีคำใบ้", brs.hint, null);
    check("ห้องเปิดเอง: hintAt = 10", brs.hintAt, 10);

    // จำเวลาล่าสุดที่ server ส่งมา ใช้ยืนยันว่าเปิดตอนเหลือ 10 วิจริง ไม่ใช่เปิดมั่ว
    let lastTick = null;
    Q.socket.on("timer", (t) => { lastTick = t.timeLeft; });

    // คนที่เข้าห้องกลางตา "ก่อน" คำใบ้เปิด ต้องยังไม่ได้คำใบ้
    const Early = track(await connect());
    others.push(Early);
    await emitAck(Early.socket, "join_room", { code: bcode, name: "EarlyBird", avatar: 5 });
    check("คนเข้าห้องก่อนคำใบ้เปิด ได้ hint = null เหมือนคนอื่น",
      (await Early.wait("round_start", null, 3000)).hint, null);

    // ── ตรวจห้อง A ──
    check("คนทายไม่ได้ hint_reveal ก่อนเวลา", (await H.quiet("hint_reveal", 1500)).length, 0);

    clearAll(G, H, I);
    H.socket.emit("request_hint");
    check("คนที่ไม่ใช่คนวาดขอคำใบ้ ไม่มีอะไรเกิดขึ้น", (await H.quiet("hint_reveal", 800)).length, 0);
    check("คำขอของคนที่ไม่ใช่คนวาด ไม่ถึงคนอื่นด้วย", (await G.quiet("hint_reveal", 1)).length, 0);

    clearAll(G, H, I);
    G.socket.emit("request_hint");
    const hr = await H.wait("hint_reveal", null, 3000);
    check("คนวาดกดขอแล้ว คำใบ้เปิดทันที", hr.by, "drawer");
    check("ช่องคำใบ้ที่ได้ ตรงกับกติกาใน events.md", hr.hint, expectedHint(aWord));
    checkOk("คนวาดเองก็ได้ hint_reveal ด้วย (ปุ่มจะได้ปิด)", (await G.tryWait("hint_reveal", null, 3000)) !== null);
    checkOk("คนทายอีกคนก็ได้เหมือนกัน", (await I.tryWait("hint_reveal", null, 3000)) !== null);

    clearAll(G, H, I);
    G.socket.emit("request_hint");
    check("ขอคำใบ้ครั้งที่สอง ไม่มีอะไรเกิดขึ้น", (await H.quiet("hint_reveal", 800)).length, 0);

    // ── รอห้อง B เปิดคำใบ้เอง (ราว 20 วิหลังเริ่มตา เพราะ drawTime = 30) ──
    const bhr = await Q.wait("hint_reveal", null, 26000);
    check("เวลาเหลือหนึ่งในสามแล้ว server เปิดคำใบ้เอง", bhr.by, "timer");
    check("ช่องคำใบ้ที่เปิดเอง ตรงกับกติกา", bhr.hint, expectedHint(bWord));
    check("ตอนเปิดเอง เวลาเหลือ 10 วิพอดี (ตรงกับ hintAt)", lastTick, 10);
    checkOk("คนที่เข้าห้องก่อนเปิด ก็ได้ hint_reveal ด้วย",
      (await Early.tryWait("hint_reveal", (h) => h.by === "timer", 3000)) !== null);

    // ทีนี้ห้อง A ก็เลยกำหนดที่ควรเปิดเองไปแล้วเหมือนกัน (เริ่มก่อนห้อง B)
    // ถ้า server เปิดซ้ำ ทั้งที่นับเป็นครั้งเดียวต่อตา ตัวเลขนี้จะเป็น 2
    check("ทั้งตาของห้อง A ส่ง hint_reveal ครั้งเดียวจริง (คนวาดขอไปแล้ว เวลาหมดไม่เปิดซ้ำ)", aReveals, 1);
    check("ห้อง A ไม่มี hint_reveal ที่สองตามมา", (await H.quiet("hint_reveal", 1)).length, 0);

    // ── คนเข้าห้องกลางตา "หลัง" คำใบ้เปิด ต้องได้ช่องคำใบ้ไปเลย ──
    const LateHint = track(await connect());
    others.push(LateHint);
    await emitAck(LateHint.socket, "join_room", { code: bcode, name: "LateHint", avatar: 5 });
    const lrs = await LateHint.wait("round_start", null, 3000);
    check("คนเข้าหลังเปิดแล้ว ได้ช่องคำใบ้จริงใน round_start (ไม่ใช่ null)",
      lrs.hint, expectedHint(bWord));
    check("คนเข้าหลังเปิดแล้ว ยังไม่มีคำจริงหลุดมา", "word" in lrs, false);
    check("คนเข้าหลังเปิดแล้ว ได้ hintAt มาด้วย", lrs.hintAt, 10);
    check("คนเข้าหลังเปิดแล้ว ไม่ได้ hint_reveal ซ้ำ", (await LateHint.quiet("hint_reveal", 600)).length, 0);

    // คำขอของคนเข้าทีหลัง (ไม่ใช่คนวาด) ต้องไม่มีผลกับห้อง B เหมือนกัน
    clearAll(P, Q, Early);
    LateHint.socket.emit("request_hint");
    check("คนเข้าทีหลังขอคำใบ้ ไม่มีอะไรเกิดขึ้น", (await Q.quiet("hint_reveal", 800)).length, 0);
  });

  // ══════════════════════════════════════════════════════════════════
  // ข้อ 5 — Mini Challenge
  //
  // challenge สุ่มจริงทุกตา จึงทดสอบด้วยการสร้างห้องจริงไปเรื่อย ๆ แล้วดูว่า server ออกอะไร
  // **ไม่ mock Math.random และไม่แอบสั่งให้ออกชนิดที่ต้องการ** เพราะทั้งสองทาง
  // จะทำให้เทสไม่ได้ทดสอบเส้นทางโค้ดจริงที่ผู้เล่นเจอ
  // เก็บห้องแรกของชนิดที่ต้องใช้ไว้ทดสอบกติกาในข้อ 17 และ 18
  // ══════════════════════════════════════════════════════════════════
  const CHALLENGE_TRIES = 30;
  // สุ่ม colour_fix ให้ได้มากพอจะจับได้ถ้า "สีขาว" หลุดกลับเข้ากอง (ข้อ 16.1)
  // colour_fix ออกราว 30% ⇒ ต้องสร้างราว 3-4 ห้องต่อ 1 ตาสี
  const COLOUR_FIX_WANTED = 25;
  const COLOUR_FIX_MAX_ROOMS = 150;
  const seenTypes = [];
  const seenChallengeColors = []; // ทุกสีที่ colour_fix ล็อกไว้ (เฉพาะสี ไม่ซ้ำคำ)
  const roomOfType = {};

  await runPart("16. Mini Challenge — ชนิดที่สุ่มออกมา (โครงสร้าง ไม่ใช่สัดส่วน)", async () => {
    for (let i = 0; i < CHALLENGE_TRIES; i++) {
      const room = await openTurn(`R${i}`);
      seenTypes.push(room.challenge?.type);
      if (room.challenge?.type === "colour_fix") {
        seenChallengeColors.push(String(room.challenge.color).toLowerCase());
      }
      // เก็บห้องแรกของชนิดที่ต้องใช้อีกสองข้อไว้ · ห้องที่เกินความจำเป็นปิดทิ้งทันที
      if (roomOfType[room.challenge?.type]) {
        room.close();
      } else {
        roomOfType[room.challenge?.type] = room;
        others.push(...room.recs); // ปิดตอนจบเหมือน socket ตัวอื่น
      }
    }

    // ── สุ่มเพิ่มจนเห็น colour_fix มากพอจะเชื่อเรื่อง "สีที่ล็อก" ได้ ──
    // ถ้ายังมีสีขาวในกอง โอกาสที่จะรอดจาก 25 ตา = (7/8)^25 ≈ 3.5% ⇒ เทสนี้จะล้มเกือบทุกครั้ง
    // (ทางที่แน่นอนกว่านี้ทำไม่ได้ เพราะ server สุ่มเองในโปรเซสแยก — เทสคุยได้ทาง socket เท่านั้น)
    let extra = CHALLENGE_TRIES;
    while (seenChallengeColors.length < COLOUR_FIX_WANTED && extra < COLOUR_FIX_MAX_ROOMS) {
      const room = await openTurn(`X${extra}`);
      extra++;
      if (room.challenge?.type === "colour_fix") seenChallengeColors.push(String(room.challenge.color).toLowerCase());
      if (roomOfType[room.challenge?.type]) room.close();
      else {
        roomOfType[room.challenge?.type] = room;
        others.push(...room.recs);
      }
    }

    checkOk(`สร้างห้องจริงได้ครบ ${CHALLENGE_TRIES} ตัวอย่าง`, seenTypes.length === CHALLENGE_TRIES);
    checkOk("ทุกค่าที่ออกมาเป็นหนึ่งในสามชนิดที่กำหนด",
      seenTypes.every((t) => ["none", "colour_fix", "dont_lift_pen"].includes(t)));
    checkOk("ไม่มี shapes_only ออกมาเลย (ตัดออกจากเกมแล้ว)",
      seenTypes.every((t) => t !== "shapes_only"));
    // ถ้าเขียนโค้ดให้ออกแต่ none อย่างเดียว หรือให้ชนิดใดชนิดหนึ่งไม่ออกเลย ข้อนี้จะจับได้
    checkOk(`ทั้งสามชนิดออกจริงใน ${CHALLENGE_TRIES} ห้อง`,
      new Set(seenTypes).size === 3);
    // ตรวจความถี่แบบหลวม ๆ (ไม่ใช่การทดสอบสัดส่วนจริง ๆ เพราะต้องสุ่มหลายร้อยห้องจึงจะแยก 40/30/30
    // ออกจาก 35/35/30 ได้ ซึ่งจะทำให้เทสล้มมั่วเป็นครั้งคราว) — จับได้เฉพาะกรณีสุดโต่ง
    // เช่น none ออก 0 ครั้ง หรือออกเกือบทุกห้อง ซึ่งแปลว่าเขียนสัดส่วนผิดชัด ๆ
    const noneCount = seenTypes.filter((t) => t === "none").length;
    checkOk(`ชนิด none ไม่ได้ออกน้อยหรือมากผิดปกติ (${noneCount}/${CHALLENGE_TRIES} จากที่ควรราราว 12)`,
      noneCount >= 3 && noneCount <= 25);

    const cf = roomOfType.colour_fix;
    checkOk("มีห้องที่ออก colour_fix ให้ทดสอบกติกาต่อ", !!cf);
    if (cf) {
      checkOk(`colour_fix ส่ง color มาเป็น hex 6 หลัก (${cf.challenge.color})`,
        /^#[0-9a-fA-F]{6}$/.test(cf.challenge.color));
      checkOk(`สีที่ล็อกอยู่ใน 8 สีหลักของพาเลต (${cf.challenge.color})`,
        MAIN_COLORS.includes(String(cf.challenge.color).toLowerCase()));
    }

    // ── 16.1 colour_fix ห้ามล็อก "สีขาว" ซึ่งเป็นสีของกระดาน ──
    // ล็อกสีขาว = วาดแล้วมองไม่เห็นอะไรเลยทั้งตา ผู้เล่นทำภารกิจไม่ได้ (เจอตอนเทสเบราว์เซอร์จริง)
    checkOk(`เก็บตัวอย่างสีที่ colour_fix ล็อกได้มากพอ (${seenChallengeColors.length} ตา)`,
      seenChallengeColors.length >= COLOUR_FIX_WANTED);
    check(`ไม่มีตาที่ล็อกสีขาวเลย (${seenChallengeColors.join(" ")})`,
      seenChallengeColors.includes("#ffffff"), false);
    checkOk("ทุกสีที่ล็อกอยู่ใน 8 สีหลักของพาเลต",
      seenChallengeColors.every((c) => MAIN_COLORS.includes(c)));

    const dl = roomOfType.dont_lift_pen;
    checkOk("มีห้องที่ออก dont_lift_pen ให้ทดสอบกติกาต่อ", !!dl);
    if (dl) {
      check("dont_lift_pen ไม่มีช่อง color ติดมา", "color" in dl.challenge, false);
    }
    check("none ไม่มีช่อง color ติดมา", "color" in (roomOfType.none?.challenge ?? {}), false);
  });

  await runPart("17. Mini Challenge — colour_fix ล็อกสีเดียว และยางลบต้องผ่านเสมอ", async () => {
    const room = roomOfType.colour_fix;
    const { drawer, guesser } = room;
    const locked = room.challenge.color;
    const wrong = MAIN_COLORS.find((c) => c !== locked.toLowerCase());

    check("challenge ที่คนทายได้ เหมือนกับที่คนวาดได้เป๊ะ", room.rsGuess.challenge, room.challenge);
    checkOk("สีที่ใช้ทดสอบว่า 'ผิดกติกา' ต่างจากสีที่ล็อกจริง", wrong !== locked.toLowerCase());

    // ── 1) โกง: วาดด้วยสีที่ไม่ใช่สีที่ล็อก ต้องไม่ถึงใครเลยทั้งสามตอน ──
    clearAll(drawer, guesser);
    drawer.socket.emit("stroke_start", { x: 0.1, y: 0.1, color: wrong, size: 5, tool: "pen" });
    drawer.socket.emit("stroke_points", { points: [{ x: 0.2, y: 0.2 }] });
    drawer.socket.emit("stroke_end");
    const leaked = await Promise.all(DRAW_EVENT_NAMES.map((n) => guesser.quiet(n, 700)));
    check("เส้นที่ใช้สีผิดกติกา ไม่มีตอนใดหลุดถึงคนอื่นเลย",
      leaked.map((l) => l.length), [0, 0, 0, 0]);

    // ── 2) เส้นที่ใช้สีที่ล็อก ต้องผ่านครบสามตอน ──
    clearAll(drawer, guesser);
    drawer.socket.emit("stroke_start", { x: 0.3, y: 0.3, color: locked, size: 5, tool: "pen" });
    check("เส้นที่ใช้สีที่ล็อก ผ่านปกติ",
      (await guesser.wait("stroke_start", null, 2000)).color, locked);
    drawer.socket.emit("stroke_points", { points: [{ x: 0.35, y: 0.35 }] });
    checkOk("จุดของเส้นที่ผ่านกติกา ส่งต่อถึงคนอื่น",
      (await guesser.tryWait("stroke_points", null, 2000)) !== null);
    drawer.socket.emit("stroke_end");
    checkOk("ปิดเส้นที่ผ่านกติกา ส่งต่อถึงคนอื่น",
      (await guesser.tryWait("stroke_end", null, 2000)) !== null);

    // ── 3) สีเดียวกันแต่พิมพ์ใหญ่ ต้องผ่านด้วย (COLOR_RE ยอมรับทั้ง #e8553f และ #E8553F) ──
    clearAll(drawer, guesser);
    drawer.socket.emit("stroke_start", { x: 0.5, y: 0.1, color: locked.toUpperCase(), size: 5, tool: "pen" });
    check("สีเดียวกันแต่พิมพ์ใหญ่ ก็ยังผ่าน (เทียบสีแบบไม่สนตัวพิมพ์)",
      (await guesser.wait("stroke_start", null, 2000)).color, locked.toUpperCase());
    drawer.socket.emit("stroke_end");
    await guesser.tryWait("stroke_end", null, 2000);

    // ── 4) ยางลบต้องผ่านเสมอ แม้ส่งสีที่ไม่ตรงกติกามาด้วย ──
    // นี่คือเหตุผลที่ต้องยกเว้น: ยางลบมาเป็นเส้นปกติที่มี tool: "eraser"
    // ถ้าเช็คสีด้วย ผู้เล่นจะลบรอยตัวเองไม่ได้เลยทั้งตา
    // (ของจริง client ส่งสีที่ล็อกมาอยู่แล้ว แต่คนที่แก้ client ก็ยังต้องลบรอยตัวเองได้)
    clearAll(drawer, guesser);
    drawer.socket.emit("stroke_start", { x: 0.7, y: 0.7, color: wrong, size: 5, tool: "eraser" });
    const er = await guesser.wait("stroke_start", null, 2000);
    check("เส้นยางลบสีไม่ตรงกติกา ยังผ่านได้ (ต้องลบรอยตัวเองได้)",
      [er.color, er.tool], [wrong, "eraser"]);
    drawer.socket.emit("stroke_end");
    await guesser.tryWait("stroke_end", null, 2000);

    // ── 5) ถังสี ──
    clearAll(drawer, guesser);
    drawer.socket.emit("fill", { x: 0.9, y: 0.9, color: wrong });
    check("เทสีด้วยสีผิดกติกา ถูกทิ้ง", (await guesser.quiet("fill", 400)).length, 0);
    clearAll(drawer, guesser);
    drawer.socket.emit("fill", { x: 0.9, y: 0.9, color: locked });
    check("เทสีด้วยสีที่ล็อก ผ่าน", (await guesser.wait("fill", null, 2000)).color, locked);

    // ── 6) คนที่เข้าห้องกลางตาต้องเห็น challenge เดียวกัน และประวัติมีแต่ของที่ผ่านกติกา ──
    const Late = track(await connect());
    others.push(Late);
    await emitAck(Late.socket, "join_room", { code: room.code, name: "CFLate", avatar: 3 });
    const lrs = await Late.wait("round_start", null, 3000);
    check("คนเข้าห้องกลางตาเห็น challenge เดียวกันเป๊ะ (รวมสีที่ล็อก)", lrs.challenge, room.challenge);
    const lhist = await Late.wait("canvas_history", null, 3000);
    const starts = lhist.items.filter((it) => it.type === "stroke_start");
    // 3 เส้นที่ผ่าน: สีตรง · สีเดียวกันแต่พิมพ์ใหญ่ · ยางลบสีไม่ตรง (เส้นสีผิดถูกทิ้งไปตั้งแต่ต้น)
    check("ประวัติที่คนเข้าทีหลังได้ มีเฉพาะเส้นที่ผ่านกติกา", starts.length, 3);
    checkOk("ไม่มีเส้นสีผิดกติกาติดไปในประวัติเลย",
      starts.every((it) => it.tool === "eraser" || String(it.color).toLowerCase() === locked.toLowerCase()));
    check("ไม่มีคำจริงหลุดมากับ round_start ของคนเข้าทีหลัง", "word" in lrs, false);

    // ── 7) colour_fix ไม่ได้ห้ามย้อนกลับ (กติกานั้นเป็นของ dont_lift_pen เท่านั้น) ──
    clearAll(drawer, guesser);
    drawer.socket.emit("undo");
    const h = await guesser.wait("canvas_history", null, 2000);
    check("colour_fix ยังย้อนกลับได้ตามปกติ", h.canRedo, true);
    drawer.socket.emit("redo");
    await guesser.tryWait("canvas_history", (x) => x.canRedo === false, 2000);
  });

  await runPart("18. Mini Challenge — dont_lift_pen ห้ามยกปากกา ห้ามย้อน ทิ้งถังสี", async () => {
    const room = roomOfType.dont_lift_pen;
    const { drawer, guesser } = room;
    const LINE = "#e8553f";

    // ── 1) ถังสีถูกทิ้งตั้งแต่ยังไม่วาดอะไรเลย (events.md: "ทิ้ง fill ทุกครั้ง") ──
    clearAll(drawer, guesser);
    drawer.socket.emit("fill", { x: 0.5, y: 0.5, color: "#000000" });
    check("dont_lift_pen ทิ้งถังสีทุกครั้ง แม้ยังไม่วาดอะไร", (await guesser.quiet("fill", 400)).length, 0);

    // ── 2) ยังไม่วาดอะไร กดย้อน/ทำซ้ำก็ต้องเงียบ ──
    clearAll(drawer, guesser);
    drawer.socket.emit("undo");
    drawer.socket.emit("redo");
    check("ยังไม่มีอะไรให้ย้อน กดย้อน/ทำซ้ำก็เงียบ",
      (await guesser.quiet("canvas_history", 400)).length, 0);

    // ── 3) เส้นแรกผ่านครบสามตอน แล้วปิดท้ายด้วย pen_locked ──
    clearAll(drawer, guesser);
    drawer.socket.emit("stroke_start", { x: 0.1, y: 0.1, color: LINE, size: 5, tool: "pen" });
    check("เส้นแรกก่อนยกปากกา ผ่านปกติ",
      (await guesser.wait("stroke_start", null, 2000)).color, LINE);
    drawer.socket.emit("stroke_points", { points: [{ x: 0.2, y: 0.2 }] });
    checkOk("จุดของเส้นแรก ส่งต่อถึงคนอื่น",
      (await guesser.tryWait("stroke_points", null, 2000)) !== null);
    drawer.socket.emit("stroke_end");
    checkOk("ปิดเส้นแรก ส่งต่อถึงคนอื่น",
      (await guesser.tryWait("stroke_end", null, 2000)) !== null);
    checkOk("ยกปากกาแล้ว server ส่ง pen_locked ให้คนอื่น",
      (await guesser.tryWait("pen_locked", null, 2000)) !== null);
    checkOk("คนวาดเองก็ได้ pen_locked (ไว้ปิดเครื่องมือของตัวเอง)",
      (await drawer.tryWait("pen_locked", null, 2000)) !== null);

    // ── 4) โกง: ยกปากกาแล้ววาดต่อ ──
    clearAll(drawer, guesser);
    drawer.socket.emit("stroke_start", { x: 0.3, y: 0.3, color: LINE, size: 5, tool: "pen" });
    drawer.socket.emit("stroke_points", { points: [{ x: 0.4, y: 0.4 }] });
    drawer.socket.emit("stroke_end");
    const leaked = await Promise.all(DRAW_EVENT_NAMES.map((n) => guesser.quiet(n, 700)));
    check("วาดต่อหลังยกปากกา ไม่มีตอนใดหลุดถึงคนอื่นเลย",
      leaked.map((l) => l.length), [0, 0, 0, 0]);
    check("pen_locked ส่งครั้งเดียวต่อตา ไม่ส่งซ้ำ", (await guesser.quiet("pen_locked", 300)).length, 0);

    // ── 5) โกง: ยางลบก็วาดต่อไม่ได้ (กติกาเป็นเรื่องจังหวะเวลา ไม่ใช่เรื่องเครื่องมือ) ──
    clearAll(drawer, guesser);
    drawer.socket.emit("stroke_start", { x: 0.5, y: 0.5, color: "#ffffff", size: 8, tool: "eraser" });
    drawer.socket.emit("stroke_end");
    check("ยางลบหลังยกปากกา ก็ถูกทิ้งเหมือนกัน", (await guesser.quiet("stroke_start", 400)).length, 0);

    // ── 6) โกง: ย้อนเส้นที่ลากผิดทิ้งแล้วลากใหม่ = หัวใจของกติกานี้ ──
    clearAll(drawer, guesser);
    drawer.socket.emit("undo");
    check("dont_lift_pen ย้อนกลับไม่ได้ (คนอื่นไม่เห็นอะไร)",
      (await guesser.quiet("canvas_history", 400)).length, 0);
    clearAll(drawer, guesser);
    drawer.socket.emit("redo");
    check("dont_lift_pen ทำซ้ำก็ไม่ได้", (await guesser.quiet("canvas_history", 400)).length, 0);
    checkOk("คนวาดเองก็ไม่ได้ canvas_history เหมือนกัน",
      (await drawer.quiet("canvas_history", 300)).length === 0);

    // ── 7) คนเข้าห้องกลางตา เห็น challenge เดียวกัน และประวัติมีแค่เส้นแรก ──
    // (คนที่เข้าหลังยกปากกาแล้วจะไม่เห็นข้อความ "คนวาดยกปากกาแล้ว" ในกล่องในห้อง
    //  เพราะ pen_locked ส่งครั้งเดียวต่อตา — ไม่มีผลกับการเล่น เขาไม่ได้เป็นคนวาดตานี้)
    const Late = track(await connect());
    others.push(Late);
    await emitAck(Late.socket, "join_room", { code: room.code, name: "DLLate", avatar: 5 });
    const lrs = await Late.wait("round_start", null, 3000);
    check("คนเข้าห้องกลางตาเห็น dont_lift_pen เหมือนกัน", lrs.challenge, { type: "dont_lift_pen" });
    const lhist = await Late.wait("canvas_history", null, 3000);
    check("ประวัติที่คนเข้าทีหลังได้ มีแค่เส้นแรกที่ผ่านกติกา",
      lhist.items.filter((it) => it.type === "stroke_start").length, 1);

    // ── 8) ล้างจอยังทำได้ (ตั้งใจ) — เพราะล้างแล้วก็ยังวาดต่อไม่ได้ จึงไม่เป็นช่องโกง ──
    clearAll(drawer, guesser);
    drawer.socket.emit("clear_canvas");
    checkOk("ล้างจอยังทำได้หลังยกปากกา",
      (await guesser.tryWait("clear_canvas", null, 2000)) !== null);
    clearAll(drawer, guesser);
    drawer.socket.emit("stroke_start", { x: 0.6, y: 0.6, color: LINE, size: 5, tool: "pen" });
    check("ล้างจอแล้วก็ยังวาดต่อไม่ได้", (await guesser.quiet("stroke_start", 600)).length, 0);
  });

  // ปิดทุก socket เพื่อให้โปรเซสจบได้
  for (const rec of [A, B, C, ...others]) rec.socket.disconnect();
}

// กันเทสค้าง: ถ้าเกิน 150 วิให้หยุด (ไม่หน่วงไม่ให้โปรเซสปิดตัว)
// เดิมตั้งไว้ 90 วิ ตอนที่ชุดเทสทั้งชุดใช้ราว 35 วิ — ข้อ 5 เพิ่มการสร้างห้องจริง 30 ห้อง
// กับการรอ "ต้องไม่มีอะไรมา" อีกหลายจุด รวมแล้วราว 50 วิ จึงขยับเพดานขึ้นให้ยังเหลือที่เผื่อเท่าของเดิม
// (ข้อ 6 กับข้อ 15 กินเวลา 9 + 21 วิอยู่แล้ว เพราะเป็นการรอตัวจับเวลาจริงของเกม ลดไม่ได้)
const watchdog = setTimeout(() => {
  console.log("\n❌ เทสค้างเกิน 150 วินาที — ยกเลิก");
  stopServer();
  process.exit(1);
}, 150000);
watchdog.unref();

main()
  .catch((e) => {
    failed++;
    problems.push("ตัวเทสเองพัง");
    console.log(`\n❌ ตัวเทสเองพัง: ${e.message}`);
  })
  .finally(() => {
    stopServer();
    console.log(`\nสรุป: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
    if (failed > 0) {
      console.log("หัวข้อที่ไม่ผ่าน: " + problems.join(" · "));
      // โชว์ log ของ server ช่วงท้าย ช่วยหาสาเหตุ
      const tail = serverLog.join("\n").split("\n").slice(-15).join("\n");
      if (tail.trim()) console.log(`\n--- log ของ server (ท้ายสุด) ---\n${tail}`);
    }
    process.exit(failed === 0 ? 0 : 1);
  });
