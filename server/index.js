const express = require("express");
const http = require("http");
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

// ---------- คลังคำชั่วคราว (รอของจริงจากเพื่อน) ----------
const WORDS = ["แมว", "หมา", "บ้าน", "รถไฟ", "ร่ม", "ดอกไม้", "ปลา", "ต้นไม้", "จักรยาน", "ไอศกรีม"];

function pickWords(n) {
  return [...WORDS].sort(() => Math.random() - 0.5).slice(0, n);
}


// ---------- คำใบ้ ----------
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


function normalize(text) {
  return String(text ?? "").toLowerCase().replace(/\s+/g, "");
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
    hint: makeHint(room.word),
    time: room.timeLeft,
    challenge: { type: "none" },
  };
}

function endRound(room) {
  stopTimer(room);
  room.phase = "between";
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
      if (room.phase === "drawing") socket.emit("round_start", roundInfo(room));
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