const express = require("express");
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + "/public"));

// ---------- ที่เก็บข้อมูลห้อง ----------
const rooms = new Map(); // key = รหัสห้อง, value = ข้อมูลห้อง
const MAX_PLAYERS = 8;

// ---------- ฟังก์ชันช่วย ----------
function makeRoomCode() {
  let code;
  do {
    code = String(Math.floor(10000 + Math.random() * 90000));
  } while (rooms.has(code));
  return code;
}

function cleanName(name) {
  return String(name ?? "").trim().slice(0, 20);
}

// เลขอวตารต้องเป็นจำนวนเต็ม 0-5 ตาม events.md ค่าอื่นที่ไม่ถูกต้องใช้ 0 แทน (ไม่ต้องแจ้ง error)
function cleanAvatar(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 0;
}

function roomState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players,
    settings: room.settings,
  };
}

// ---------- คลังคำ ----------
// อ่านจาก server/data/words.json ตอนสตาร์ท แยกเป็น 3 ระดับ
// ถ้าไฟล์หายหรือ JSON เสีย ให้ใช้คำสำรอง 10 คำเดิม — server ต้องเปิดได้เสมอ ห้ามล่ม
const WORDS_FILE = __dirname + "/data/words.json";
const LEVELS = ["easy", "medium", "hard"];
const MAX_WORD_LENGTH = 12; // ยาวเกินนี้จะเตือนใน log แต่ยังใช้คำนั้นตามปกติ ไม่ตัดทิ้ง
const FALLBACK_WORDS = ["แมว", "หมา", "บ้าน", "รถไฟ", "ร่ม", "ดอกไม้", "ปลา", "ต้นไม้", "จักรยาน", "ไอศกรีม"];

// แยกเก็บตามระดับ พร้อมหมวดหมู่ เผื่อไว้ให้ข้อ 7 (Solo) ไล่ความยากทีละขั้น
const WORD_BANK = { easy: [], medium: [], hard: [] };
// ชื่อคำล้วนๆ ทุกระดับรวมกัน โหมดปกติสุ่มจากก้อนนี้
let ALL_WORDS = [];

function loadWords() {
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(WORDS_FILE, "utf8"));
  } catch (err) {
    console.warn(`อ่าน words.json ไม่ได้ (${err.message}) — จะใช้คำสำรองแทน`);
  }

  // เก็บเฉพาะรายการที่หน้าตาถูก และตัดคำซ้ำทิ้ง กันไฟล์มีปัญหาทำให้เกมเพี้ยน
  const seen = new Set();
  for (const level of LEVELS) {
    const list = Array.isArray(data?.[level]) ? data[level] : [];
    for (const item of list) {
      const word = typeof item?.word === "string" ? item.word.trim() : "";
      if (!word || seen.has(word)) continue;
      seen.add(word);
      WORD_BANK[level].push({ word, category: typeof item?.category === "string" ? item.category : "" });
    }
  }

  ALL_WORDS = LEVELS.flatMap((level) => WORD_BANK[level].map((item) => item.word));

  if (ALL_WORDS.length === 0) {
    WORD_BANK.easy = FALLBACK_WORDS.map((word) => ({ word, category: "สำรอง" }));
    ALL_WORDS = [...FALLBACK_WORDS];
    console.log(`คลังคำ: ใช้คำสำรอง ${ALL_WORDS.length} คำ (อ่าน words.json ไม่ได้)`);
    return;
  }

  // นับเป็น "จำนวนอักขระ" ซึ่งมากกว่าจำนวนตัวที่ตาเห็น เพราะสระบนล่างและวรรณยุกต์
  // เป็นอักขระแยกต่างหาก เช่น "ต้นไม้" นับได้ 6 ทั้งที่ตาเห็น 4
  // (ข้อความไทย [...word].length กับ word.length ให้ค่าเท่ากัน ใช้ [...word] ไว้เผื่อ
  //  อนาคตมีอักขระนอกระนาบหลักอย่างอีโมจิ ซึ่ง word.length จะนับเป็น 2)
  const tooLong = ALL_WORDS.filter((word) => [...word].length > MAX_WORD_LENGTH);
  if (tooLong.length > 0) {
    console.warn(`⚠️  คำยาวเกิน ${MAX_WORD_LENGTH} ตัวอักษร ${tooLong.length} คำ: ${tooLong.join(", ")}`);
  }

  console.log(
    `คลังคำ: ${LEVELS.map((l) => `${l} ${WORD_BANK[l].length}`).join(" / ")} (รวม ${ALL_WORDS.length} คำ) จาก words.json`
  );
}

loadWords();

// โหมดปกติ: ทุกระดับปนกัน (ข้อ 7 ค่อยสุ่มจาก WORD_BANK ตามระดับเอง)
function pickWords(n) {
  return [...ALL_WORDS].sort(() => Math.random() - 0.5).slice(0, n);
}


// ---------- คำใบ้ ----------
// คำใบ้ไม่โผล่ตั้งแต่ต้นตาอีกแล้ว มันจะเปิดเมื่อ "เวลาเหลือหนึ่งในสามของเวลาเต็ม" (ปัดลง)
//   30 วิ → เหลือ 10 · 45 วิ → เหลือ 15 · 60 วิ → เหลือ 20 · 90 วิ → เหลือ 30
// คนวาดกดขอเปิดก่อนเวลาได้หนึ่งครั้งต่อตา (request_hint)
//
// กติกาที่ห้ามละเมิด: **ห้ามส่งช่องคำใบ้ออกไปก่อนถึงเวลาทางใดทางหนึ่งเด็ดขาด**
// ไม่ว่าจะใน round_start ของคนเข้าห้องกลางตา หรือที่ไหน — คนทายเปิด DevTools ดูได้
// เพราะฉะนั้น roundInfo() จึงส่ง hint: null จนกว่าจะเปิดจริงเท่านั้น
const HINT_AT_DIVISOR = 3;

function makeHint(word) {
  const slots = [];
  for (const ch of word) {
    if (/[\u0E48-\u0E4B]/.test(ch)) {
      if (slots.length > 0) slots[slots.length - 1].tone = true;
    } else if (/[\u0E31\u0E34-\u0E3A\u0E47\u0E4C-\u0E4E]/.test(ch)) {
      // สระบนล่าง ไม้ไต่คู้ การันต์ ไม่นับเป็นช่อง ข้ามไป
    } else if (ch === " ") {
      slots.push({ space: true });
    } else {
      slots.push({ tone: false });
    }
  }
  return slots;
}

// วินาทีที่เหลือตอนคำใบ้จะเปิดเอง — คิดจากเวลาต่อตาที่ตั้งไว้ในห้องนั้น
// อ่านค่าจาก settings ทุกครั้ง (ไม่แช่ไว้ตั้งแต่เริ่มตา) จึงไม่มีทางไม่ตรงกัน
function hintAt(room) {
  return Math.floor(room.settings.drawTime / HINT_AT_DIVISOR);
}

// เปิดคำใบ้ให้ทั้งห้อง — **ประตูเดียว** ของการเปิดคำใบ้ในตาหนึ่ง
// ทั้งทางที่คนวาดกดขอ (request_hint) และทางที่เวลาหมด (tick ของ startTimer) ต้องผ่านฟังก์ชันนี้
// จึงรับประกันได้ว่า hint_reveal ออกไป "ครั้งเดียวต่อตา" จริง ไม่ใช่แค่พยายามให้เป็น
// คืน true ถ้าเปิดจริง · false ถ้าเปิดไปแล้วหรือยังไม่มีคำ (ไม่ส่งอะไรออกไปเลย)
function revealHint(room, by) {
  if (room.hintOpen || !room.word) return false;
  room.hintOpen = true;
  io.to(room.code).emit("hint_reveal", { hint: makeHint(room.word), by });
  return true;
}


function normalize(text) {
  return String(text ?? "").toLowerCase().replace(/\s+/g, "");
}

// ══════════════════════════════════════════════════════════════════════
// การวาด (ข้อ 4) — รับจากคนวาด ส่งต่อให้คนอื่น เก็บไว้ให้คนเข้าห้องกลางตา และย้อนกลับได้
//
// หลักการเดียวกับทั้งไฟล์: server เป็นคนตัดสิน
//   - รับเฉพาะจาก "คนวาด" ของห้องนั้น และเฉพาะ "ช่วงวาด" เท่านั้น
//   - ข้อมูลผิดรูปแบบทิ้งเงียบ ๆ ไม่ตอบ error กลับ (คนโกงไม่ควรรู้ว่าเรากำลังเช็คอะไรอยู่)
//   - ส่งต่อด้วย socket.to(code) = ทุกคนในห้องยกเว้นคนวาด (เขาเห็นภาพของตัวเองอยู่แล้ว)
//
// ประวัติถูกเก็บเป็น "การกระทำ" (op) ไม่ใช่ event รายอัน
//   หนึ่งเส้น = stroke_start + stroke_points หลายอัน + stroke_end = 1 การกระทำ
//   หนึ่งครั้งเทสี = 1 การกระทำ · ล้างจอ 1 ครั้ง = 1 การกระทำ
// การแบ่งแบบนี้ทำให้ "ย้อนกลับหนึ่งครั้ง" = ถอยหนึ่งเส้น ไม่ใช่ถอยทีละจุด
// (ผู้ใช้กดย้อนครั้งเดียวต้องได้ผลอย่างที่ตาเห็น ไม่ใช่ต้องกด 40 ครั้ง)
//
// สองช่องที่ดูคล้ายกันแต่คนละเรื่อง อย่าสับสน
//   room.strokeOpen    = "ตอนนี้มีเส้นค้างอยู่ไหม"     → เรื่องของสัญญา ใช้ตัดสินว่าข้อความนี้ถูกต้องไหม
//   room.currentStroke = "เส้นนั้นถูกเก็บลงประวัติหรือยัง" → เรื่องของที่เก็บ (เป็น null ได้ทั้งที่ strokeOpen เป็น true)
// แยกกันเพราะตอนชนเพดาน เราหยุด "เก็บ" แต่ยัง "ส่งต่อ" ให้ทุกคนตามปกติ
// ถ้าใช้ช่องเดียว ชนเพดานเมื่อไหร่จุดที่เหลือของเส้นนั้นจะถูกทิ้งไปด้วย ทั้งที่ควรส่งถึงเพื่อนร่วมห้อง
// ══════════════════════════════════════════════════════════════════════

// เพดานค่าต่าง ๆ ของการวาด
// SIZE_MIN/SIZE_MAX ต้องตรงกับ client/src/canvas/palette.js แต่คนละโปรเซสกัน
// จึง import หากันไม่ได้ ต้องประกาศซ้ำ — ถ้าวันหนึ่งแก้ ต้องแก้ทั้งสองที่
const SIZE_MIN = 2;
const SIZE_MAX = 40;
const VALID_TOOLS = ["pen", "eraser"];
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const MAX_POINTS_PER_MSG = 500; // จุดสูงสุดในหนึ่งข้อความ stroke_points
const MAX_CANVAS_EVENTS = 4000; // action สูงสุดที่เก็บไว้ต่อตา
const MAX_CANVAS_POINTS = 30000; // จุดรวมสูงสุดที่เก็บไว้ต่อตา
// เพดานสองตัวนี้ตั้งเผื่อไว้ราว 5-7 เท่าของที่ใช้จริงในตาหนึ่ง
// (ตาละ 60 วิ ส่งทุก 40ms = ไม่เกิน 1500 ข้อความ และกรองจุดซ้ำแล้วเหลือราว 3000-6000 จุด)
// มีไว้กันหน่วยความจำบวมเท่านั้น ไม่ได้ตั้งใจให้ชนในการเล่นปกติ

const isUnit = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
const isColor = (v) => typeof v === "string" && COLOR_RE.test(v);
const isSize = (v) => typeof v === "number" && Number.isFinite(v) && v >= SIZE_MIN && v <= SIZE_MAX;

// คืนห้อง ถ้าคนนี้เป็น "คนวาด" ของห้องที่กำลังวาดอยู่ตอนนี้ ไม่งั้นคืน null
// รวมการเช็คสิทธิ์และช่วงเวลาไว้ที่เดียว ทุก handler ของการวาดเรียกฟังก์ชันนี้
function drawRoom(socket) {
  const room = rooms.get(socket.data.roomCode);
  if (!room || room.phase !== "drawing" || room.drawerId !== socket.id) return null;
  return room;
}

// ตรวจก้อนจุดของ stroke_points — คืนลิสต์ที่สะอาดแล้ว หรือ null ถ้าข้อมูลผิด
function cleanPoints(data) {
  if (!data || typeof data !== "object") return null;
  const list = data.points;
  if (!Array.isArray(list) || list.length === 0) return null;
  if (list.length > MAX_POINTS_PER_MSG) return null;

  const out = [];
  for (const p of list) {
    if (!p || typeof p !== "object") return null;
    if (!isUnit(p.x) || !isUnit(p.y)) return null;
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

// กรอง "จุดซ้ำตำแหน่งเดิม" ทิ้ง
//
// ทำไมต้องมีทั้งที่ฝั่ง client กรองไปแล้ว: client กรองที่เกณฑ์ 1 พิกเซล ซึ่งต้องรู้ขนาดจอบนเครื่องนั้น
// server ไม่มีจอ จึงเทียบแบบนั้นไม่ได้ แต่จุดที่ "ซ้ำเป๊ะ" กรองได้ทุกจอ และเป็นตัวที่ทำให้เส้นเหลี่ยมจริง
// (ดูคำอธิบายเต็มใน client/src/components/Canvas.jsx) — ฝั่งรับจึงได้เส้นเรียบเหมือนฝั่งวาดแน่นอน
function dedupePoints(room, points) {
  const out = [];
  let last = room.lastPoint;
  for (const p of points) {
    if (last && p.x === last.x && p.y === last.y) continue;
    out.push(p);
    last = p;
  }
  room.lastPoint = last;
  return out;
}

// นับจำนวนจุดในหนึ่งการกระทำ — จุดคือสิ่งที่กินหน่วยความจำมากที่สุดในประวัติ
function countPoints(op) {
  let n = 0;
  for (const ev of op.events) if (ev.type === "stroke_points") n += ev.points.length;
  return n;
}

// ชนเพดานแล้ว — หยุดเก็บประวัติต่อในตานี้ (เตือนครั้งเดียวต่อห้อง)
// ยัง "ส่งต่อ" ให้ทุกคนตามปกติ เกมจึงไม่สะดุด สิ่งที่เสียไปคือคนที่เข้าห้องกลางตาหลังจุดนี้จะเห็นภาพไม่ครบ
function freezeCanvas(room) {
  if (room.canvasFrozen) return;
  room.canvasFrozen = true;

  // ปิดเส้นที่ค้างอยู่ให้เรียบร้อยก่อนทิ้ง ไม่งั้นประวัติจะจบด้วยเส้นที่ไม่มี stroke_end
  // ตอนวาดซ้ำจากประวัติ ปลายเส้นจะไม่ถูกปิดให้ (ดู endStroke ใน painter.js)
  // เส้นนี้ยังถูก "ส่งต่อ" ให้ทุกคนตามปกติ — ที่หยุดคือการเก็บลงประวัติเท่านั้น
  const last = room.currentStroke?.events[room.currentStroke.events.length - 1];
  if (room.currentStroke && last.type !== "stroke_end") {
    room.currentStroke.events.push({ type: "stroke_end" });
    room.canvasEvents++;
  }
  room.currentStroke = null; // ไม่มีเส้นไหนถูกเก็บอีกแล้วในตานี้

  console.warn(
    `⚠️  ห้อง ${room.code}: ประวัติการวาดตานี้ชนเพดาน (${MAX_CANVAS_EVENTS} action / ${MAX_CANVAS_POINTS} จุด) — หยุดเก็บเพิ่ม`
  );
}

// เก็บ action ลงประวัติเป็นส่วนหนึ่งของการกระทำ (คืน true ถ้าเก็บได้จริง)
function storeAction(room, type, payload) {
  if (room.canvasFrozen) return false;

  // จุดที่ตามมา ต่อเข้ากับเส้นที่ค้างอยู่ ไม่นับเป็นการกระทำใหม่
  if (type === "stroke_points") {
    if (!room.currentStroke) return false;
    const cost = payload.points.length;
    if (room.canvasEvents + 1 > MAX_CANVAS_EVENTS || room.canvasPoints + cost > MAX_CANVAS_POINTS) {
      freezeCanvas(room);
      return false;
    }
    room.currentStroke.events.push({ type, points: payload.points });
    room.canvasEvents++;
    room.canvasPoints += cost;
    return true;
  }

  if (type === "stroke_end") {
    if (!room.currentStroke) return false;
    room.currentStroke.events.push({ type });
    room.canvasEvents++;
    room.currentStroke = null;
    return true;
  }

  // stroke_start / fill / clear_canvas — ขึ้นต้นการกระทำใหม่หนึ่งอัน
  const op = { events: [{ type, ...payload }] };
  if (room.canvasEvents + op.events.length > MAX_CANVAS_EVENTS) {
    freezeCanvas(room);
    return false;
  }
  room.canvasOps.push(op);
  room.canvasEvents += op.events.length;
  room.canvasPoints += countPoints(op);
  room.redoOps = []; // วาดใหม่หลังย้อน = กองทำซ้ำหายทั้งกอง เหมือนโปรแกรมวาดรูปทั่วไป
  if (type === "stroke_start") room.currentStroke = op;
  return true;
}

// ย้อนหนึ่งการกระทำ — คืน true ถ้าย้อนจริง
function undoCanvas(room) {
  // ยังลากเส้นค้างอยู่ ย้อนไม่ได้ เพราะลำดับจะเพี้ยน (ให้ปล่อยมือก่อนแล้วกดใหม่)
  if (room.strokeOpen || room.canvasOps.length === 0) return false;
  const op = room.canvasOps.pop();
  room.canvasEvents -= op.events.length;
  room.canvasPoints -= countPoints(op);
  room.redoOps.push(op);
  return true;
}

function redoCanvas(room) {
  if (room.strokeOpen || room.redoOps.length === 0) return false;
  const op = room.redoOps.pop();
  room.canvasOps.push(op);
  room.canvasEvents += op.events.length;
  room.canvasPoints += countPoints(op);
  return true;
}

// "ภาพปัจจุบันทั้งชุด" + สถานะปุ่มย้อน/ทำซ้ำ
//
// ทำไมส่งทั้งชุดไม่ส่งแค่ส่วนต่าง: ย้อน/ทำซ้ำเป็นเรื่องที่เกิดไม่บ่อย (คนกดปุ่ม)
// แต่ต้อง "ถูกเป๊ะ" ทุกจอ การส่งภาพทั้งชุดทำให้ทุกคนได้ผลเหมือนกันโดยไม่มีทางเพี้ยน
// และคนที่เข้าห้องกลางตาทีหลังก็ได้ภาพหลังย้อนแล้วทันทีโดยไม่ต้องมีโค้ดพิเศษอะไรเลย
function canvasPayload(room) {
  const items = [];
  for (const op of room.canvasOps) items.push(...op.events);
  return { items, canUndo: room.canvasOps.length > 0, canRedo: room.redoOps.length > 0 };
}

// ล้างประวัติทั้งก้อน — เรียกตอนขึ้นตาใหม่ (events.md หัวข้อ 4)
function resetCanvas(room) {
  room.canvasOps = [];
  room.redoOps = [];
  room.currentStroke = null;
  room.strokeOpen = false;
  room.lastPoint = null;
  room.canvasEvents = 0;
  room.canvasPoints = 0;
  room.canvasFrozen = false;
}

// ---------- ตัวจับเวลา ----------
function stopTimer(room) {
  clearInterval(room.timer);
  room.timer = null;
}

function startTimer(room, seconds, onEnd) {
  stopTimer(room);
  room.timeLeft = seconds;
  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(room.code).emit("timer", { timeLeft: room.timeLeft });
    // ถึงเวลาที่คำใบ้ควรเปิดเองแล้ว (เหลือหนึ่งในสามของเวลาเต็ม) — เปิดให้ทั้งห้อง
    // ถ้าคนวาดกดขอไปก่อนหน้านี้แล้ว revealHint จะไม่ทำอะไร (มี hintOpen กันอยู่)
    if (room.timeLeft <= hintAt(room)) revealHint(room, "timer");
    if (room.timeLeft <= 0) {
      stopTimer(room);
      onEnd();
    }
  }, 1000);
}

// ---------- ขั้นตอนของเกม ----------
function nextTurn(room) {
  if (!rooms.has(room.code) || room.status !== "playing") return;

  if (room.turnIndex >= room.turnOrder.length) {
    room.round++;
    room.turnIndex = 0;
    room.turnOrder = room.players.map((p) => p.id);
  }
  if (room.round > room.settings.rounds) return endGame(room);

  room.drawerId = room.turnOrder[room.turnIndex];
  room.turnIndex++;
  if (!room.players.some((p) => p.id === room.drawerId)) return nextTurn(room);

  room.phase = "choosing";
  room.wordOptions = pickWords(3);
  io.to(room.drawerId).emit("choose_word", { options: room.wordOptions, time: 10 });
  room.chooseTimeout = setTimeout(() => startDrawing(room, room.wordOptions[0]), 10000);
}

function startDrawing(room, word) {
  clearTimeout(room.chooseTimeout);
  room.phase = "drawing";
  room.word = word;
  console.log("คำตานี้:", word);
  room.guessedIds = new Set();
  room.roundGains = {};
  // ตาใหม่ = คำใบ้ยังไม่เปิด (ต้องรีเซ็ตก่อนส่ง round_start เสมอ ไม่งั้นตาถัดไปจะได้คำใบ้ฟรี)
  room.hintOpen = false;
  resetCanvas(room); // ขึ้นตาใหม่ = กระดานว่าง ประวัติตาที่แล้วทิ้งทั้งหมด

  room.timeLeft = room.settings.drawTime;
  io.to(room.code).emit("round_start", roundInfo(room));
  io.to(room.drawerId).emit("your_word", { word });

  startTimer(room, room.settings.drawTime, () => endRound(room));
}

function roundInfo(room) {
  return {
    round: room.round,
    totalRounds: room.settings.rounds,
    drawerId: room.drawerId,
    // คำใบ้เป็น null จนกว่าจะเปิด (คนวาดกดขอ หรือเวลาเหลือหนึ่งในสาม)
    // คนที่เข้าห้องกลางตาหลังเปิดแล้วจะได้ชุดช่องจริงไปเลย ไม่ใช่ null
    hint: room.hintOpen && room.word ? makeHint(room.word) : null,
    hintAt: hintAt(room), // เปิดเองเมื่อเวลาเหลือเท่านี้ — client ใช้โชว์ "คำใบ้จะขึ้นเมื่อเหลือ X วิ"
    time: room.timeLeft,
    challenge: { type: "none" },
    // ส่งแค่ "id" ของคนที่ทายถูกแล้ว ไม่มีคำตอบหรืออะไรที่บอกคำปนมาด้วย
    // มีไว้ให้คนที่เข้าห้องกลางตาเห็นติ๊กถูกของคนที่ทายไปก่อนหน้า (งานค้างจากข้อ 2)
    guessedIds: [...room.guessedIds],
  };
}

function endRound(room) {
  stopTimer(room);
  room.phase = "between";
  // ตัดจบเส้นที่ค้างอยู่ (คนวาดอาจปล่อยมือไม่ทันตอนหมดเวลา)
  // ปิดแบบไม่เก็บ stroke_end เพิ่ม เพราะประวัติจะถูกล้างทั้งก้อนตอนขึ้นตาใหม่อยู่แล้ว
  room.strokeOpen = false;
  room.currentStroke = null;
  const results = Object.entries(room.roundGains).map(([playerId, gained]) => ({ playerId, gained }));
  io.to(room.code).emit("round_end", { word: room.word, results });
  room.word = null;
  io.to(room.code).emit("room_update", roomState(room));
  setTimeout(() => nextTurn(room), 3000);
}

function endGame(room) {
  stopTimer(room);
  clearTimeout(room.chooseTimeout);
  room.status = "ended";
  room.phase = null;
  const ranking = [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ playerId: p.id, name: p.name, score: p.score }));
  io.to(room.code).emit("game_end", { ranking });
  io.to(room.code).emit("room_update", roomState(room));
}

function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;

  socket.leave(code);
  socket.data.roomCode = null;

  const room = rooms.get(code);
  if (!room) return;

  room.players = room.players.filter((p) => p.id !== socket.id);

    if (room.players.length === 0) {
    stopTimer(room);
    clearTimeout(room.chooseTimeout);
    rooms.delete(code);
    return;
  }

  if (room.hostId === socket.id) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
  }

  if (room.status === "playing") {
    if (room.players.length < 2) return endGame(room);
    if (room.drawerId === socket.id) {
      if (room.phase === "choosing") {
        clearTimeout(room.chooseTimeout);
        nextTurn(room);
      } else if (room.phase === "drawing") {
        endRound(room);
      }
    }
  }

  io.to(code).emit("room_update", roomState(room));
}

// ---------- เมื่อมีผู้เล่นต่อเข้ามา ----------
io.on("connection", (socket) => {
  console.log("มีคนเชื่อมต่อเข้ามา:", socket.id);

  socket.on("create_room", (data, callback) => {
    if (typeof callback !== "function") return;
    const name = cleanName(data?.name);
    if (!name) return callback({ ok: false, error: "INVALID_NAME" });

    leaveRoom(socket);

    const code = makeRoomCode();
    const room = {
      code,
      hostId: socket.id,
      status: "lobby",
      players: [{ id: socket.id, name, avatar: cleanAvatar(data.avatar), score: 0, isHost: true, team: null }],
      settings: { mode: "classic", rounds: 3, drawTime: 60 },
    };
    rooms.set(code, room);

    socket.join(code);
    socket.data.roomCode = code;

    callback({ ok: true, code, playerId: socket.id });
    io.to(code).emit("room_update", roomState(room));
  });

  socket.on("join_room", (data, callback) => {
    if (typeof callback !== "function") return;
    const name = cleanName(data?.name);
    const code = String(data?.code ?? "");
    const room = rooms.get(code);

    if (!name) return callback({ ok: false, error: "INVALID_NAME" });
    if (!room) return callback({ ok: false, error: "ROOM_NOT_FOUND" });
    if (room.players.length >= MAX_PLAYERS) return callback({ ok: false, error: "ROOM_FULL" });
    if (room.players.some((p) => p.name === name)) return callback({ ok: false, error: "NAME_TAKEN" });

    leaveRoom(socket);

    room.players.push({ id: socket.id, name, avatar: cleanAvatar(data.avatar), score: 0, isHost: false, team: null });
    socket.join(code);
    socket.data.roomCode = code;

    callback({ ok: true, playerId: socket.id });
    io.to(code).emit("room_update", roomState(room));
    if (room.status === "playing") {
      room.turnOrder.push(socket.id);
      socket.emit("game_started", { mode: room.settings.mode, totalRounds: room.settings.rounds });
      if (room.phase === "drawing") {
        socket.emit("round_start", roundInfo(room));
        // ภาพที่วาดไปแล้วก่อนเข้า — ส่ง "หลัง" round_start เพื่อให้จอใหม่ล้างกระดานเสร็จก่อน
        // ไม่งั้นภาพที่เพิ่งได้มาจะถูกล้างทิ้งทันที
        socket.emit("canvas_history", canvasPayload(room));
      }
    }
  });


    socket.on("update_settings", (data) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status === "playing") return;
    if (room.hostId !== socket.id) {
      return socket.emit("game_error", { code: "NOT_HOST", message: "เฉพาะหัวห้องเท่านั้น" });
    }
    const rounds = Number(data?.rounds);
    const drawTime = Number(data?.drawTime);
    if ([1, 2, 3, 4, 5].includes(rounds)) room.settings.rounds = rounds;
    if ([30, 45, 60, 90].includes(drawTime)) room.settings.drawTime = drawTime;
    io.to(room.code).emit("room_update", roomState(room));
  });

  socket.on("start_game", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status === "playing") return;
    if (room.hostId !== socket.id) {
      return socket.emit("game_error", { code: "NOT_HOST", message: "เฉพาะหัวห้องเท่านั้นที่เริ่มเกมได้" });
    }
    if (room.players.length < 2) {
      return socket.emit("game_error", { code: "NOT_ENOUGH_PLAYERS", message: "ต้องมีอย่างน้อย 2 คน" });
    }

    room.status = "playing";
    room.players.forEach((p) => (p.score = 0));
    room.round = 1;
    room.turnOrder = room.players.map((p) => p.id);
    room.turnIndex = 0;

    io.to(room.code).emit("game_started", { mode: room.settings.mode, totalRounds: room.settings.rounds });
    io.to(room.code).emit("room_update", roomState(room));
    nextTurn(room);
  });

  socket.on("word_chosen", (data) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== "choosing" || room.drawerId !== socket.id) return;
    if (!room.wordOptions.includes(data?.word)) return;
    startDrawing(room, data.word);
  });

    socket.on("guess", (data) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    const text = String(data?.text ?? "").trim().slice(0, 100);
    if (!player || !text) return;
    const msg = { playerId: socket.id, name: player.name, text };

    // ไม่ได้อยู่ช่วงวาด คุยเล่นได้ปกติ
    if (room.phase !== "drawing") return io.to(room.code).emit("chat_message", msg);

    // ช่องโกง 1: คนวาดห้ามพิมพ์ระหว่างวาด
    if (socket.id === room.drawerId) return;

    // ช่องโกง 2: คนที่ทายถูกแล้ว คุยได้แค่กับคนที่รู้คำตอบแล้ว
    if (room.guessedIds.has(socket.id)) {
      for (const id of [room.drawerId, ...room.guessedIds]) {
        io.to(id).emit("chat_message", msg);
      }
      return;
    }

    // ทายถูก
    if (normalize(text) === normalize(room.word)) {
      room.guessedIds.add(socket.id);
      const gained = 50 + room.timeLeft * 5;
      player.score += gained;
      room.roundGains[socket.id] = gained;

      const drawer = room.players.find((p) => p.id === room.drawerId);
      if (drawer) {
        drawer.score += 50;
        room.roundGains[drawer.id] = (room.roundGains[drawer.id] || 0) + 50;
      }

      // ช่องโกง 3 (ไอเดียเรา): คนทายเห็นคำตัวเอง คนอื่นเห็นเป็น ******
      socket.emit("chat_message", { ...msg, correct: true });
      socket.to(room.code).emit("chat_message", { ...msg, text: "******", correct: true });
      io.to(room.code).emit("correct_guess", { playerId: socket.id, name: player.name });
      io.to(room.code).emit("room_update", roomState(room));

      const guessers = room.players.filter((p) => p.id !== room.drawerId);
      if (guessers.every((p) => room.guessedIds.has(p.id))) endRound(room);
      return;
    }

    // ทายผิด ทุกคนเห็นได้
    io.to(room.code).emit("chat_message", msg);
  });

  // ══════════════════════════════════════════════════════════════════
  // การวาด (ข้อ 4) — ทุกตัวหน้าตาเหมือนกัน: ตรวจสิทธิ์ → ตรวจข้อมูล → เก็บ → ส่งต่อ
  //
  // ข้อมูลผิด "ทิ้งเงียบ ๆ" ไม่ตอบ game_error กลับไป
  // เพราะการบอกว่าข้อมูลไหนผิด เท่ากับบอกใบ้คนที่กำลังลองโกงว่าเราดักตรงไหนอยู่
  // และไม่ว่าอะไรจะถูกส่งมา server ต้องไม่ล่ม — ตรวจให้ครบก่อนใช้ทุกครั้ง
  // ══════════════════════════════════════════════════════════════════

  socket.on("stroke_start", (data) => {
    const room = drawRoom(socket);
    if (!room || !data || typeof data !== "object") return;

    const { x, y, color, size, tool } = data;
    if (!isUnit(x) || !isUnit(y)) return;
    if (!isColor(color)) return;
    if (!isSize(size)) return;
    if (!VALID_TOOLS.includes(tool)) return;

    const payload = { x, y, color, size, tool };
    room.strokeOpen = true;
    room.lastPoint = { x, y }; // จุดตั้งต้นของเส้นนี้ ใช้กรองจุดซ้ำในข้อความถัดไป
    storeAction(room, "stroke_start", payload);
    socket.to(room.code).emit("stroke_start", payload);
  });

  socket.on("stroke_points", (data) => {
    const room = drawRoom(socket);
    if (!room || !room.strokeOpen) return; // ไม่มีเส้นค้างอยู่ = ข้อมูลแปลกปลอม

    const points = cleanPoints(data);
    if (!points) return;

    const fresh = dedupePoints(room, points);
    if (fresh.length === 0) return; // จุดซ้ำทั้งหมด ไม่มีอะไรต้องส่ง

    storeAction(room, "stroke_points", { points: fresh });
    socket.to(room.code).emit("stroke_points", { points: fresh });
  });

  socket.on("stroke_end", () => {
    const room = drawRoom(socket);
    if (!room || !room.strokeOpen) return;

    room.strokeOpen = false;
    room.lastPoint = null;
    storeAction(room, "stroke_end", {});
    socket.to(room.code).emit("stroke_end", {});
  });

  socket.on("fill", (data) => {
    const room = drawRoom(socket);
    if (!room || !data || typeof data !== "object") return;

    const { x, y, color } = data;
    if (!isUnit(x) || !isUnit(y) || !isColor(color)) return;

    const payload = { x, y, color };
    storeAction(room, "fill", payload);
    socket.to(room.code).emit("fill", payload);
  });

  // clear_canvas ไม่ได้ล้าง "ประวัติ" ทิ้ง แต่ถูกเก็บเป็นอีกหนึ่งการกระทำ
  // จึงกดย้อนกลับเพื่อเอากลับมาได้ (เหมือนโปรแกรมวาดรูปทั่วไป)
  socket.on("clear_canvas", () => {
    const room = drawRoom(socket);
    if (!room) return;

    storeAction(room, "clear_canvas", {});
    socket.to(room.code).emit("clear_canvas", {});
  });

  // ── ย้อนกลับ / ทำซ้ำ ──
  // client แค่ "ขอ" — server เป็นคนตัดสินว่าย้อนได้ไหม แล้วส่งภาพปัจจุบันทั้งชุดกลับให้ทั้งห้อง
  // (io.to ไม่ใช่ socket.to เพราะคนวาดต้องได้ด้วย จอตัวเองจะได้ย้อนตาม)
  socket.on("undo", () => {
    const room = drawRoom(socket);
    if (!room || !undoCanvas(room)) return;
    io.to(room.code).emit("canvas_history", canvasPayload(room));
  });

  socket.on("redo", () => {
    const room = drawRoom(socket);
    if (!room || !redoCanvas(room)) return;
    io.to(room.code).emit("canvas_history", canvasPayload(room));
  });

  // ── คำใบ้ (คนวาดขอเปิดก่อนเวลา) ──
  // drawRoom() เช็คให้ครบสามอย่างในตัวมันเองอยู่แล้ว: อยู่ในห้อง · กำลังวาด · เป็นคนวาด
  // ไม่ผ่านข้อใดข้อหนึ่ง = ทิ้งเงียบ ๆ เหมือน handler การวาดตัวอื่น (ไม่ตอบ error กลับ)
  // เปิดซ้ำครั้งที่สองก็เงียบ เพราะ revealHint มี hintOpen กันไว้แล้ว
  socket.on("request_hint", () => {
    const room = drawRoom(socket);
    if (!room) return;
    revealHint(room, "drawer");
  });

  socket.on("leave_room", () => leaveRoom(socket));

  socket.on("disconnect", () => {
    console.log("มีคนหลุดออกไป:", socket.id);
    leaveRoom(socket);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`server พร้อมแล้ว ที่ http://localhost:${PORT}`);
});