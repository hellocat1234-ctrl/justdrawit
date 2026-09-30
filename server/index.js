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

function roomState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players,
    settings: room.settings,
  };
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
    rooms.delete(code);
    return;
  }

  if (room.hostId === socket.id) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
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
      players: [{ id: socket.id, name, avatar: data.avatar ?? 0, score: 0, isHost: true, team: null }],
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
    if (room.status !== "lobby") return callback({ ok: false, error: "GAME_STARTED" });
    if (room.players.length >= MAX_PLAYERS) return callback({ ok: false, error: "ROOM_FULL" });
    if (room.players.some((p) => p.name === name)) return callback({ ok: false, error: "NAME_TAKEN" });

    leaveRoom(socket);

    room.players.push({ id: socket.id, name, avatar: data.avatar ?? 0, score: 0, isHost: false, team: null });
    socket.join(code);
    socket.data.roomCode = code;

    callback({ ok: true, playerId: socket.id });
    io.to(code).emit("room_update", roomState(room));
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