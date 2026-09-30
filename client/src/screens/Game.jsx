import { useRef, useState } from "react";
import HintSlots from "../components/HintSlots";
import Timer from "../components/Timer";
import Scoreboard from "../components/Scoreboard";
import Chat from "../components/Chat";
import RoomLog from "../components/RoomLog";
import ChallengeBanner from "../components/ChallengeBanner";
import Canvas from "../components/Canvas";
import Toolbar from "../components/Toolbar";
import WordChoiceModal from "../components/WordChoiceModal";
import RoundSummaryModal from "../components/RoundSummaryModal";
import GameOverModal from "../components/GameOverModal";
import { clearBoard } from "../canvas/actions";
import { PAINT_COLORS, SIZE_DEFAULT, TOOLS } from "../canvas/palette";

/**
 * หน้าเกมทั้งหมด (ข้อ 2 + กระดานวาดข้อ 3)
 *
 * หน้านี้ไม่ผูก socket เอง รับสถานะสำเร็จรูปมาจาก useGame ที่ App เรียก
 * เพราะหน้านี้เกิดตอนได้ game_started เท่านั้น event ที่มาก่อนหน้าจะหลุด
 */
export default function Game({ room, meId, game, chooseLeft, chooseWord, sendGuess, startGame, onLeave }) {
  const players = room.players;
  const isDrawer = game.drawerId === meId;
  const drawing = Boolean(game.round); // กำลังวาดอยู่ (round_start มาแล้ว ยังไม่ round_end)
  const drawerName = players.find((p) => p.id === game.drawerId)?.name ?? "—";

  // วาดได้เฉพาะคนวาด และเฉพาะช่วงกำลังวาด (โจทย์ข้อ 6)
  // ช่วงเลือกคำ game.round ยังเป็น null จึงวาดไม่ได้ ซึ่งถูกต้อง — ยังไม่รู้คำด้วยซ้ำ
  const canDraw = isDrawer && drawing;

  // เครื่องมือที่เลือกอยู่ — เป็นสถานะของหน้าจอ ไม่เกี่ยวกับ server
  const [tool, setTool] = useState(TOOLS.PEN);
  const [color, setColor] = useState(PAINT_COLORS[0].hex); // เริ่มที่สีดำ (ตัวแรกในพาเลต)
  const [size, setSize] = useState(SIZE_DEFAULT);
  const canvasRef = useRef(null); // ใช้เรียกคำสั่งบนกระดาน (ข้อ 4 จะใช้ตอนรับ action ของคนอื่น)

  // ปุ่มล้างจอ — ส่ง action clear_canvas เข้ากระดานทางช่องทางกลางช่องเดียวกับที่วาด
  // (ไม่ได้เรียก painter ตรงๆ เพราะต้องให้มันเก็บลงลิสต์และส่งออกให้คนอื่นด้วย)
  function handleClear() {
    canvasRef.current?.dispatch(clearBoard());
  }

  return (
    <div className="screen screen--game">
      <header className="topbar">
        <div className="topbar__who">
          <span className="topbar__label">คนวาด</span>
          <span className="topbar__name">{drawerName}</span>
        </div>

        {/* คนวาดเห็นคำจริง (ได้จาก your_word) คนอื่นเห็นคำใบ้เป็นขีด */}
        <div className="topbar__word">
          {isDrawer && game.word ? (
            <span className="topbar__real-word" title="คำที่คุณต้องวาด">
              {game.word}
            </span>
          ) : game.options ? (
            <span className="topbar__idle">กำลังเลือกคำ...</span>
          ) : game.round ? (
            <HintSlots hint={game.round.hint} />
          ) : (
            <span className="topbar__idle">—</span>
          )}
        </div>

        <div className="topbar__meta">
          <span className="topbar__round">
            รอบ {game.roundNo ?? "-"}/{game.totalRounds ?? "-"}
          </span>
          <Timer timeLeft={drawing ? game.timeLeft : null} />
        </div>
      </header>

      {/* เรียงตาม DESIGN.md: รายชื่อซ้าย · กระดานกลาง · เครื่องมือขวา
          มือขวาเอื้อมถึงเครื่องมือได้ถนัด (คนส่วนใหญ่ถนัดขวา) และกระดานได้ที่กว้างที่สุด */}
      <main className="game">
        <aside className="game__players">
          <Scoreboard players={players} drawerId={game.drawerId} guessed={game.guessed} meId={meId} />
        </aside>

        <section className="game__stage">
          <ChallengeBanner challenge={game.round?.challenge} />

          <Canvas
            ref={canvasRef}
            canDraw={canDraw}
            tool={tool}
            color={color}
            size={size}
            resetKey={game.roundKey}
            // ข้อ 4 ต่อ socket ตรงนี้: onAction={(a) => socket.emit(a.type, payload(a))}
          />

          {/* ใต้กระดาน สองกล่องข้างกัน: คำที่คนทาย กับ เรื่องที่เกิดในห้อง */}
          <div className="game__answers">
            <Chat
              messages={game.messages}
              meId={meId}
              // คนวาดพิมพ์ไม่ได้ระหว่างวาด (server ตัดทิ้งอยู่แล้ว ปิดช่องไปเลยจะได้ชัดเจน)
              disabled={isDrawer && drawing}
              onSend={sendGuess}
              focusKey={game.roundKey} // ขึ้นตาใหม่ = โฟกัสช่องพิมพ์ให้เลย
            />
            <RoomLog messages={game.messages} />
          </div>
        </section>

        {/* เครื่องมืออยู่ขวาเสมอ แม้ตอนไม่ใช่ตาของเรา — แค่จางและกดไม่ได้
            ถ้าซ่อนไปเลย กระดานจะกว้างขึ้นแล้วหดกลับทุกครั้งที่สลับคนวาด ภาพที่วาดไว้จะกระโดด */}
        <aside className="game__tools">
          <Toolbar
            tool={tool}
            color={color}
            size={size}
            onTool={setTool}
            onColor={setColor}
            onSize={setSize}
            onClear={handleClear}
            locked={!canDraw}
          />
        </aside>
      </main>

      {/* Modal ทั้งสามแบบ ไม่มีทางเปิดพร้อมกัน จึงเขียนเรียงกันได้ */}
      {game.options && (
        <WordChoiceModal options={game.options} secondsLeft={chooseLeft} onChoose={chooseWord} />
      )}
      {game.summary && <RoundSummaryModal summary={game.summary} players={players} />}
      {game.ranking && (
        <GameOverModal
          ranking={game.ranking}
          isHost={room.hostId === meId}
          onPlayAgain={startGame}
          onLeave={onLeave}
        />
      )}
    </div>
  );
}
