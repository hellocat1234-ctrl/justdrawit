import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";

// สถานะตั้งต้นของเกมหนึ่งเกม
function emptyGame() {
  return {
    active: false, // true ตั้งแต่ game_started จนถึง game_end
    round: null, // ก้อนข้อมูลจาก round_start — ใช้แค่ตอนกำลังวาด (มี hint กับ challenge)
    roundNo: null, // รอบที่เท่าไร เก็บไว้โชว์ตอนพักระหว่างตา (round เป็น null แล้ว)
    totalRounds: null,
    drawerId: null, // คนวาดตานี้ เก็บไว้เหมือนกัน จะได้ไม่หายตอนพัก
    word: null, // คำจริง เฉพาะคนวาด ได้จาก your_word
    timeLeft: null, // วินาทีที่เหลือ จาก timer
    options: null, // ตัวเลือกคำ 3 คำ เฉพาะคนวาด ได้จาก choose_word
    chooseTime: 10,
    summary: null, // จาก round_end (เฉลย + คะแนนที่ได้แต่ละคน)
    ranking: null, // จาก game_end
    guessed: [], // playerId ที่ทายถูกในตานี้ ไว้ขึ้น ✅
    messages: [], // แชท
    roundKey: 0, // นับขึ้นทุกครั้งที่ขึ้นตาใหม่ — กระดานใช้ค่านี้รู้ว่าต้องล้างจอ (ข้อ 3)
  };
}

/**
 * รวมสถานะของเกมที่กำลังเล่นอยู่ไว้ที่เดียว
 *
 * ทำไมต้องเป็น hook ที่ App เรียก ไม่ให้หน้า Game ผูก socket เอง
 * เพราะหน้า Game ถูกสร้างตอนได้ game_started เท่านั้น ถ้ามันผูก socket เอง
 * event ที่มาถึงก่อนมันเกิดจะหลุดไปเลย — เช่นตอนเข้าห้องกลางเกม server ส่ง
 * game_started แล้วตามด้วย round_start ทันที ซึ่งจังหวะนั้นหน้า Game ยังไม่ทันเกิด
 * App อยู่ตลอดตั้งแต่เปิดหน้าเว็บ จึงไม่มี event ไหนหลุด
 * (บทเรียนเดียวกับบั๊ก StrictMode ในข้อ 1: event ที่พลาดไปแล้วจะไม่ยิงซ้ำ)
 */
export function useGame() {
  const [game, setGame] = useState(emptyGame);
  const [chooseLeft, setChooseLeft] = useState(0);
  const playersRef = useRef(null); // รายชื่อผู้เล่นรอบก่อน ไว้เทียบว่าใครเข้าออก

  useEffect(() => {
    // ใช้ฟังก์ชันรับค่าเก่า จะได้ไม่ต้องกังวลเรื่อง state ค้าง
    const patch = (fields) => setGame((g) => ({ ...g, ...fields }));

    const onGameStarted = (data) =>
      setGame({ ...emptyGame(), active: true, totalRounds: data?.totalRounds ?? null });

    // มาถึงตอนนี้แปลว่าตาเก่าจบไป 3 วิแล้ว (server หน่วงก่อนขึ้นตาใหม่)
    // ต้องปิด modal สรุปตาไปพร้อมกัน ไม่งั้นคนวาดจะเห็นสอง modal ซ้อนกัน
    const onChooseWord = (data) =>
      patch({ options: data.options, chooseTime: data.time, summary: null });

    // ตาใหม่มาแล้ว ล้างของตาที่แล้วทั้งหมด (ตัวเลือกคำ สรุปตา คำจริง คนที่ทายถูก)
    // roundKey ต้องบวกจากค่าเดิม (ไม่ใช้ค่าคงที่) เพราะกระดานเทียบค่านี้เพื่อล้างจอ
    // ถ้าใช้ค่าคงที่ กระดานจะไม่รู้ว่าขึ้นตาใหม่
    const onRoundStart = (data) =>
      setGame((g) => ({
        ...g,
        round: data,
        roundNo: data.round,
        totalRounds: data.totalRounds,
        drawerId: data.drawerId,
        timeLeft: data.time,
        options: null,
        summary: null,
        word: null,
        guessed: [],
        roundKey: g.roundKey + 1,
      }));

    const onYourWord = (data) => patch({ word: data.word });
    const onTimer = (data) => patch({ timeLeft: data.timeLeft });

    // จบตา: ซ่อนคำใบ้ ทิ้งตัวเลือก เก็บสรุปไว้โชว์เป็น modal
    const onRoundEnd = (data) => patch({ summary: data, round: null, word: null, options: null });

    // จบเกม: เก็บอันดับไว้โชว์ ส่วนประวัติแชทคงไว้ให้อ่านย้อนหลังได้ระหว่างดูอันดับ
    const onGameEnd = (data) =>
      setGame((g) => ({
        ...emptyGame(),
        messages: g.messages,
        ranking: data.ranking,
        totalRounds: g.totalRounds,
      }));

    const onChat = (msg) => setGame((g) => ({ ...g, messages: [...g.messages, msg] }));

    // ทายถูก: เก็บ id ไว้ขึ้น ✅ ที่แถบรายชื่อ และเพิ่มข้อความระบบไว้กล่อง "ในห้อง"
    // server ไม่ได้ส่งข้อความระบบนี้มา (ส่งมาแค่ id กับชื่อ) จึงประกอบเองฝั่งนี้
    const onCorrectGuess = (data) =>
      setGame((g) => ({
        ...g,
        guessed: [...g.guessed, data.playerId],
        messages: [...g.messages, { system: true, text: `${data.name} ทายถูก` }],
      }));

    // ข้อความระบบ "ใครเข้าออก" — server ไม่ได้ส่ง event นี้มา ต้องเทียบรายชื่อเอาเอง
    const onRoomUpdate = (next) => {
      const prev = playersRef.current;
      const notes = [];
      if (prev) {
        for (const p of next.players) {
          if (!prev.has(p.id)) notes.push({ system: true, text: `${p.name} เข้าห้อง` });
        }
        for (const p of prev.values()) {
          if (!next.players.some((x) => x.id === p.id)) notes.push({ system: true, text: `${p.name} ออกจากห้อง` });
        }
      }
      playersRef.current = new Map(next.players.map((p) => [p.id, p]));
      if (notes.length > 0) setGame((g) => ({ ...g, messages: [...g.messages, ...notes] }));
    };

    socket.on("game_started", onGameStarted);
    socket.on("choose_word", onChooseWord);
    socket.on("round_start", onRoundStart);
    socket.on("your_word", onYourWord);
    socket.on("timer", onTimer);
    socket.on("round_end", onRoundEnd);
    socket.on("game_end", onGameEnd);
    socket.on("chat_message", onChat);
    socket.on("correct_guess", onCorrectGuess);
    socket.on("room_update", onRoomUpdate);

    return () => {
      socket.off("game_started", onGameStarted);
      socket.off("choose_word", onChooseWord);
      socket.off("round_start", onRoundStart);
      socket.off("your_word", onYourWord);
      socket.off("timer", onTimer);
      socket.off("round_end", onRoundEnd);
      socket.off("game_end", onGameEnd);
      socket.off("chat_message", onChat);
      socket.off("correct_guess", onCorrectGuess);
      socket.off("room_update", onRoomUpdate);
    };
  }, []);

  // นับถอยหลังตอนเลือกคำ — server ไม่ได้ส่งเวลาช่วงนี้มาเป็นรายวินาที (timer เริ่มตอนวาดแล้ว)
  // เลยนับเองในเครื่องเพื่อโชว์เฉยๆ ใครเลือกตอนไหนจริงๆ server เป็นคนตัดสิน
  useEffect(() => {
    if (!game.options) {
      setChooseLeft(0);
      return;
    }
    setChooseLeft(game.chooseTime ?? 10);
    const tick = setInterval(() => setChooseLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [game.options, game.chooseTime]);

  return {
    game,
    chooseLeft,
    chooseWord: (word) => socket.emit("word_chosen", { word }),
    sendGuess: (text) => socket.emit("guess", { text }),
    startGame: () => socket.emit("start_game"),
    // ออกจากห้องแล้วล้างให้เกลี้ยง ไม่งั้นกลับเข้าห้องใหม่แล้วอาจเห็นของเก่าค้างอยู่แวบหนึ่ง
    resetGame: () => {
      setGame(emptyGame());
      playersRef.current = null;
    },
  };
}
