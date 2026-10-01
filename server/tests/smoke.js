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
  try {
    await fn();
  } catch (e) {
    failed++;
    problems.push(label);
    console.log(`❌ ${label} — พังกลางทาง: ${e.message}`);
  }
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
    check("คำใบ้ตรงกับกติกาใน events.md", rs.hint, expectedHint(word));
    check("คนวาดได้คำจริงทาง your_word", (await A.wait("your_word")).word, word);
    checkOk("คนทายไม่ได้ your_word", await B.tryWait("your_word", null, 400) === null);

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
      check(`${label}: คำใบ้ตรงกับกติกา`, rs.hint, expectedHint(w));
      check(`${label}: ไม่มีคำจริงใน round_start`, "word" in rs, false);
      check(`${label}: your_word ตรงกับคำที่เลือก`, (await t.drawer.wait("your_word")).word, w);

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
  // ข้อ 4 — การวาด ย้อนกลับ ทำซ้ำ และการกันโกง
  // แยกห้องใหม่ต่างหาก เพื่อไม่ให้ปนกับห้องของข้อ 1-6 ที่จบเกมไปแล้ว
  // ══════════════════════════════════════════════════════════════════
  const D = track(await connect()); // หัวห้อง = คนวาด
  const E = track(await connect()); // คนทาย
  const F = track(await connect()); // คนทายอีกคน ไว้ดูว่าทุกคนเห็นเหมือนกัน
  others.push(D, E, F);

  let dcode = null;
  let dword = null;

  await runPart("9. การวาด — ส่งต่อให้คนอื่น และทิ้งข้อมูลที่ไม่ใช่ของคนวาด", async () => {
    dcode = (await emitAck(D.socket, "create_room", { name: "Drawer", avatar: 0 })).code;
    await emitAck(E.socket, "join_room", { code: dcode, name: "Guess1", avatar: 1 });
    await emitAck(F.socket, "join_room", { code: dcode, name: "Guess2", avatar: 2 });

    clearAll(D, E, F);
    D.socket.emit("update_settings", { rounds: 1, drawTime: 90 });
    // รอตัวที่มีค่าใหม่จริง ไม่ใช่ room_update ตัวแรกที่เจอ
    // (room_update ของตอน E/F เข้าห้องอาจมาถึงหลัง clearAll พอดี แล้วกลายเป็นตัวแรกในลิสต์)
    check("ตั้งเวลาวาด 90 วิ สำหรับเทสข้อนี้",
      (await D.wait("room_update", (r) => r.settings.drawTime === 90, 3000)).settings.drawTime, 90);

    clearAll(D, E, F);
    D.socket.emit("start_game");
    const cw = await D.wait("choose_word", null, 6000);
    dword = cw.options[0];
    D.socket.emit("word_chosen", { word: dword });
    await D.wait("round_start", null, 3000);

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

  // ปิดทุก socket เพื่อให้โปรเซสจบได้
  for (const rec of [A, B, C, ...others]) rec.socket.disconnect();
}

// กันเทสค้าง: ถ้าเกิน 90 วิให้หยุด (ไม่หน่วงไม่ให้โปรเซสปิดตัว)
const watchdog = setTimeout(() => {
  console.log("\n❌ เทสค้างเกิน 90 วินาที — ยกเลิก");
  stopServer();
  process.exit(1);
}, 90000);
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
