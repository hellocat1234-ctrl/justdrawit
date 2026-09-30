import HintSlots from "../components/HintSlots";
import Timer from "../components/Timer";
import Scoreboard from "../components/Scoreboard";
import Chat from "../components/Chat";
import ChallengeBanner from "../components/ChallengeBanner";
import WordChoiceModal from "../components/WordChoiceModal";
import RoundSummaryModal from "../components/RoundSummaryModal";
import GameOverModal from "../components/GameOverModal";

/**
 * หน้าเกมทั้งหมด (ข้อ 2) — ยังไม่มีกระดานวาดจริง ใส่กล่องขาว 4:3 ไว้แทน (ข้อ 3)
 *
 * หน้านี้ไม่ผูก socket เอง รับสถานะสำเร็จรูปมาจาก useGame ที่ App เรียก
 * เพราะหน้านี้เกิดตอนได้ game_started เท่านั้น event ที่มาก่อนหน้าจะหลุด
 */
export default function Game({ room, meId, game, chooseLeft, chooseWord, sendGuess, startGame, onLeave }) {
  const players = room.players;
  const isDrawer = game.drawerId === meId;
  const drawing = Boolean(game.round); // กำลังวาดอยู่ (round_start มาแล้ว ยังไม่ round_end)
  const drawerName = players.find((p) => p.id === game.drawerId)?.name ?? "—";

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

      <main className="game">
        <aside className="game__scores">
          <Scoreboard players={players} drawerId={game.drawerId} guessed={game.guessed} meId={meId} />
        </aside>

        <section className="game__stage">
          <ChallengeBanner challenge={game.round?.challenge} />
          {/* กระดานวาดของจริงเป็นงานข้อ 3 ตอนนี้เป็นกล่องขาว 4:3 เปล่าๆ ก่อน */}
          <div className="board" role="img" aria-label="กระดานวาด (ยังไม่เปิดใช้งานในข้อนี้)" />
        </section>

        <aside className="game__chat">
          <Chat
            messages={game.messages}
            meId={meId}
            // คนวาดพิมพ์ไม่ได้ระหว่างวาด (server ตัดทิ้งอยู่แล้ว ปิดช่องไปเลยจะได้ชัดเจน)
            disabled={isDrawer && drawing}
            onSend={sendGuess}
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
