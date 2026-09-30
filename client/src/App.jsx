import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import { errorText } from "./messages";
import { useGame } from "./hooks/useGame";
import Lobby from "./screens/Lobby";
import WaitingRoom from "./screens/WaitingRoom";
import Game from "./screens/Game";
import Toast from "./components/Toast";

// App เป็นที่เดียวที่ผูก socket ไว้ หน้าจออื่นรับข้อมูลเป็น props
// ทำแบบนี้เพราะ socket เป็นของกลาง ถ้าต่างคนต่างผูก จะมี listener ซ้ำและลืมถอดออกง่าย
export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [screen, setScreen] = useState("lobby"); // lobby | waiting | game
  const [room, setRoom] = useState(null); // RoomState ก้อนล่าสุดจาก server
  const [me, setMe] = useState(null); // { playerId, name, avatar } ของเครื่องนี้
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // สถานะของเกมที่กำลังเล่น ผูก socket ไว้ที่นี่ (ไม่ใช่ในหน้า Game) เพื่อไม่ให้ event หลุด
  // ดูเหตุผลเต็มๆ ในคอมเมนต์ของ useGame
  const { game, chooseLeft, chooseWord, sendGuess, startGame, resetGame } = useGame();

  function showToast(text) {
    setToast({ text, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    // server ส่ง room_update ทุกครั้งที่มีคนเข้าออก แก้ตั้งค่า หรือคะแนนเปลี่ยน
    // หน้าจอแค่เอาค่าที่ได้ไปแสดง ไม่ต้องคำนวณเอง
    const onRoomUpdate = (next) => setRoom(next);
    const onGameStarted = () => setScreen("game");
    const onGameError = (err) => showToast(errorText(err?.code));

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_update", onRoomUpdate);
    socket.on("game_started", onGameStarted);
    socket.on("game_error", onGameError);

    // สำคัญมาก: socket อาจต่อติดไปแล้วก่อนที่ effect นี้จะได้ทำงาน (เกิดจริงตอน dev
    // เพราะ StrictMode ถอด listener ออกแล้วใส่ใหม่) ถ้าพลาด event "connect" ไปแล้ว
    // มันจะไม่ยิงซ้ำอีก ปุ่มจะถูกปิดค้างตลอด จึงต้องอ่านสถานะจริง ณ ตอนนี้ด้วย
    setConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_update", onRoomUpdate);
      socket.off("game_started", onGameStarted);
      socket.off("game_error", onGameError);
    };
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function handleEntered(info) {
    setMe(info);
    setScreen("waiting");
  }

  function handleLeave() {
    socket.emit("leave_room");
    resetGame();
    setRoom(null);
    setMe(null);
    setScreen("lobby");
  }

  return (
    <>
      {screen === "lobby" && (
        <Lobby
          connected={connected}
          onEntered={handleEntered}
          // หน้า Lobby ส่ง "รหัส error" มา ที่นี่แปลงเป็นข้อความไทยก่อนโชว์
          onError={(code) => showToast(errorText(code))}
        />
      )}

      {/* room ยังมาไม่ถึงก็มีให้เห็นว่ากำลังทำอะไรอยู่ ไม่ใช่จอเปล่า */}
      {screen === "waiting" &&
        (room ? (
          <WaitingRoom room={room} me={me} onLeave={handleLeave} />
        ) : (
          <div className="screen">
            <div className="panel">กำลังเข้าห้อง...</div>
          </div>
        ))}

      {screen === "game" &&
        (room ? (
          <Game
            room={room}
            meId={me?.playerId}
            game={game}
            chooseLeft={chooseLeft}
            chooseWord={chooseWord}
            sendGuess={sendGuess}
            startGame={startGame}
            onLeave={handleLeave}
          />
        ) : (
          <div className="screen">
            <div className="panel">กำลังเข้าห้อง...</div>
          </div>
        ))}

      {/* key ผูกกับ id ของ toast เพื่อให้แสดงข้อความซ้ำแล้วเล่นอนิเมชันใหม่ */}
      <Toast key={toast?.id ?? "none"} toast={toast} />
    </>
  );
}
