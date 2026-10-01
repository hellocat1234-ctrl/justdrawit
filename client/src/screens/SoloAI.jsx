import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import Logo from "../components/Logo";
import Timer from "../components/Timer";
import Canvas from "../components/Canvas";
import Toolbar from "../components/Toolbar";
import Modal from "../components/Modal";
import TimeBar from "../components/TimeBar";
import Ribbon from "../components/Ribbon";
import Mascot, { MascotNote } from "../components/Mascot";
import { clearBoard } from "../canvas/actions";
import { PAINT_COLORS, SIZE_DEFAULT, TOOLS } from "../canvas/palette";

// ส่งภาพให้ AI ดูทุก 5 วินาที (server รับห่างกันได้ไม่ต่ำกว่า 4 วิ)
const SNAPSHOT_MS = 5000;
const SNAPSHOT_WIDTH = 512;
const THINK_TIMEOUT_MS = 20000; // server รอ AI สูงสุด 15 วิ เผื่อไว้อีกนิดกันค้างถ้าตอบหาย
// แปรงหนาสุดใน Solo — วัดแล้วแปรงหนามาก (24px ในภาพ 512px) ทำให้ AI ทายถูกแค่ครึ่งเดียว (84% → 49%)
// เป็นแค่การช่วยผู้เล่น ไม่ใช่กติกากันโกง (server ไม่ได้จำกัด)
const SOLO_MAX_SIZE = 12;

// ข้อความบอกโหมดของ AI ให้ตรงกับ aiMode ที่ server ส่งมาจริงในด่านนี้
const MODE_TEXT = {
  model: "AI ในเครื่อง — ดูภาพจริงด้วยโมเดลทายภาพวาด (ฟรี ไม่ใช้ API key)",
  claude: "AI Claude — ดูภาพจริง",
  mock: "โหมดจำลอง — ไม่มีโมเดลและไม่มี API key AI เดาสุ่ม ไม่ได้ดูภาพจริง",
};
const NEXT_DELAY_S = 4; // server พัก 4 วิก่อนด่านถัดไป (ใช้แสดงนับถอยหลังเฉยๆ)

// การกระทำที่ "ย้อนได้ทีละหนึ่งอัน" — หนึ่งเส้น (start..end) หนึ่งครั้งเทสี หนึ่งครั้งล้างจอ
const OP_START = new Set(["stroke_start", "fill", "clear_canvas"]);
function lastOpIndex(actions) {
  for (let i = actions.length - 1; i >= 0; i--) if (OP_START.has(actions[i].type)) return i;
  return -1;
}

/**
 * หน้า Solo แข่งกับ AI (ข้อ 7 ส่วนที่ 2) — ผู้เล่นวาด AI ทาย
 *
 * ผูก socket เองในหน้านี้ได้ (ต่างจากหน้าเกมปกติ) เพราะ event แรกคือ ai_round_start
 * มาหลังจากเรากด START เอง และเรา "ผูกก่อนแล้วค่อยส่ง ai_start" จึงไม่มีทางหลุด
 *
 * กติกาทุกอย่างอยู่ที่ server: เวลา ชีวิต คะแนน การขึ้นด่าน การบันทึก leaderboard
 * หน้านี้แค่แสดงผลและส่งภาพ — นับเวลาถอยหลังเองเพื่อโชว์เท่านั้น server เป็นคนปิดด่าน
 */
export default function SoloAI({ initialName = "", onBack }) {
  // intro = กรอกชื่อ · starting = ส่ง ai_start แล้วรอด่านแรก · playing · rest = พักระหว่างด่าน · over = จบเกม
  const [phase, setPhase] = useState("intro");
  const [name, setName] = useState(initialName);
  const [round, setRound] = useState(null); // { level, word, time, lives, aiMode }
  const [roundId, setRoundId] = useState(0); // นับขึ้นทุกด่าน ไว้สั่งล้างกระดาน
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [guesses, setGuesses] = useState([]); // คำที่ AI เดาในด่านนี้
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState(null); // ผลด่านล่าสุด { correct, gained, word }
  const [restLeft, setRestLeft] = useState(NEXT_DELAY_S);
  const [final, setFinal] = useState(null); // { totalScore, levelReached, rank }
  const [hist, setHist] = useState({ undo: false, redo: false });

  const [toolChoice, setToolChoice] = useState(TOOLS.PEN);
  const [color, setColor] = useState(PAINT_COLORS[0].hex);
  const [size, setSize] = useState(SIZE_DEFAULT);

  const canvasRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const roundRef = useRef(null);
  const thinkingRef = useRef(false);
  const thinkTimer = useRef(null);
  const redoRef = useRef([]); // กองทำซ้ำ (เก็บฝั่งเครื่องเรา ไม่มี server เก็บให้เหมือนห้องปกติ)

  function setThink(on) {
    thinkingRef.current = on;
    setThinking(on);
    clearTimeout(thinkTimer.current);
    if (on) thinkTimer.current = setTimeout(() => setThink(false), THINK_TIMEOUT_MS);
  }

  // ── ผูก event ของ Solo ครั้งเดียวตอนเปิดหน้า ──
  useEffect(() => {
    const onRoundStart = (d) => {
      roundRef.current = d;
      setRound(d);
      setLives(d.lives);
      setTimeLeft(d.time);
      setGuesses([]);
      setResult(null);
      setThink(false);
      setRoundId((n) => n + 1);
      setPhase("playing");
    };
    const onGuess = (d) => {
      setThink(false);
      setGuesses((g) => [...g, { text: String(d.guess ?? ""), correct: Boolean(d.correct) }]);
    };
    const onRoundEnd = (d) => {
      setThink(false);
      setScore(d.totalScore);
      setLives(d.lives);
      setResult({ correct: d.correct, gained: d.gained, word: roundRef.current?.word ?? "" });
      setRestLeft(NEXT_DELAY_S);
      setPhase("rest");
    };
    const onGameEnd = (d) => {
      setThink(false);
      setScore(d.totalScore);
      setFinal(d);
      setPhase("over");
    };
    const onError = (err) => {
      // AI ไม่ว่าง: ด่านเดินต่อ ไม่เสียชีวิต ส่งภาพใหม่ได้ (App โชว์ Toast ให้แล้ว)
      if (err?.code === "AI_UNAVAILABLE") setThink(false);
      // ชื่อไม่ผ่าน: ยังไม่ได้เริ่มเกมจริง กลับไปกรอกใหม่
      if (err?.code === "INVALID_NAME" && phaseRef.current === "starting") setPhase("intro");
    };
    socket.on("ai_round_start", onRoundStart);
    socket.on("ai_guess", onGuess);
    socket.on("ai_round_end", onRoundEnd);
    socket.on("ai_game_end", onGameEnd);
    socket.on("game_error", onError);
    return () => {
      socket.off("ai_round_start", onRoundStart);
      socket.off("ai_guess", onGuess);
      socket.off("ai_round_end", onRoundEnd);
      socket.off("ai_game_end", onGameEnd);
      socket.off("game_error", onError);
      clearTimeout(thinkTimer.current);
      // ออกจากหน้ากลางเกม = เลิกเล่น (server ไม่บันทึกคะแนน)
      if (phaseRef.current === "starting" || phaseRef.current === "playing" || phaseRef.current === "rest") {
        socket.emit("leave_room");
      }
    };
  }, []);

  // ขึ้นด่านใหม่ = ล้างกระดานและประวัติย้อนกลับ
  useEffect(() => {
    if (roundId === 0) return;
    canvasRef.current?.resetBoard();
    redoRef.current = [];
    setHist({ undo: false, redo: false });
  }, [roundId]);

  // นับเวลาถอยหลังไว้โชว์ (server เป็นคนตัดสินว่าหมดเวลาจริง)
  useEffect(() => {
    if (phase !== "playing" || !round) return undefined;
    const deadline = Date.now() + round.time * 1000;
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [phase, round]);

  // นับถอยหลังช่วงพัก
  useEffect(() => {
    if (phase !== "rest") return undefined;
    const id = setInterval(() => setRestLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ส่งภาพให้ AI ทุก 5 วิ — ข้ามถ้ากระดานยังว่าง (ไม่เปลืองการเรียก AI) หรือ AI ยังคิดภาพก่อนหน้าอยู่
  useEffect(() => {
    if (phase !== "playing") return undefined;
    const id = setInterval(() => {
      if (thinkingRef.current) return;
      const board = canvasRef.current;
      if (!board || board.getActions().length === 0) return;
      const image = board.snapshot(SNAPSHOT_WIDTH);
      if (!image) return;
      setThink(true);
      socket.emit("ai_snapshot", { image });
    }, SNAPSHOT_MS);
    return () => clearInterval(id);
  }, [phase, roundId]);

  function start(e) {
    e?.preventDefault();
    if (!name.trim()) return;
    setScore(0);
    setLives(3);
    setFinal(null);
    setPhase("starting");
    socket.emit("ai_start", { name });
  }

  function handleLeave() {
    // ปิดเกมที่ server ด้วย (จบเกมแล้วไม่มีอะไรค้าง ส่งไปก็ไม่เป็นไร)
    socket.emit("leave_room");
    phaseRef.current = "over"; // กัน cleanup ส่งซ้ำ
    onBack();
  }

  // ── ย้อนกลับ/ทำซ้ำในเครื่อง (Solo ไม่มี server เก็บประวัติให้) ──
  function syncHist() {
    const b = canvasRef.current;
    setHist({ undo: !!b && lastOpIndex(b.getActions()) >= 0, redo: redoRef.current.length > 0 });
  }
  function handleAction(action) {
    if (!OP_START.has(action.type)) return;
    redoRef.current = []; // วาดใหม่หลังย้อน = ทิ้งกองทำซ้ำ (เหมือนโหมดห้อง)
    syncHist();
  }
  function undo() {
    const b = canvasRef.current;
    if (!b) return;
    const all = b.getActions();
    const i = lastOpIndex(all);
    if (i < 0) return;
    redoRef.current.push(all.slice(i));
    b.applyHistory(all.slice(0, i));
    syncHist();
  }
  function redo() {
    const b = canvasRef.current;
    const op = redoRef.current.pop();
    if (!b || !op) return;
    b.applyHistory([...b.getActions(), ...op]);
    syncHist();
  }

  const canDraw = phase === "playing" && (timeLeft ?? 1) > 0;

  useEffect(() => {
    if (!canDraw) return undefined;
    function onKey(e) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── หน้ากรอกชื่อ ──
  if (phase === "intro") {
    return (
      <div className="screen">
        <Logo />
        <Ribbon tone="purple">SOLO VS AI</Ribbon>
        <form className="panel solo-intro" onSubmit={start}>
          <h2 className="panel__title">🤖 Solo แข่งกับ AI</h2>
          <p className="solo-intro__text">
            คุณวาดตามคำที่ได้ AI ดูภาพแล้วทาย · ทายถูกขึ้นด่านถัดไป ยิ่งผ่านมากยิ่งยาก
            ทายไม่ออกในเวลาเสีย 1 ชีวิต (มี 3 ชีวิต)
          </p>
          <label className="field__label" htmlFor="solo-name">
            CHOOSE YOUR NAME
          </label>
          <input
            id="solo-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="ชื่อเล่นของคุณ"
            autoComplete="off"
            autoFocus
          />
          <button type="submit" className="btn btn--primary btn--wide" disabled={!name.trim()}>
            START
          </button>
          <button type="button" className="btn btn--wide" onClick={onBack}>
            ← กลับหน้าแรก
          </button>
        </form>
      </div>
    );
  }

  const tool = toolChoice;
  const hearts = Array.from({ length: 3 }, (_, i) => (i < lives ? "❤️" : "🖤")).join("");
  const lastGuess = guesses[guesses.length - 1];

  return (
    <div className="screen screen--game">
      <header className="topbar">
        <div className="topbar__who">
          <span className="topbar__label">ด่าน</span>
          <span className="topbar__name">{round?.level ?? "-"}</span>
        </div>
        <div className="topbar__who">
          <span className="topbar__label">ชีวิต</span>
          <span className="topbar__name" aria-label={`เหลือ ${lives} ชีวิต`}>
            {hearts}
          </span>
        </div>
        <div className="topbar__who">
          <span className="topbar__label">คะแนน</span>
          <span className="topbar__name">{score}</span>
        </div>

        <div className="topbar__word">
          {round && phase !== "starting" ? (
            <span className="topbar__real-word" title="คำที่คุณต้องวาด">
              {round.word}
            </span>
          ) : (
            <span className="topbar__idle">กำลังเริ่มเกม...</span>
          )}
        </div>

        <div className="topbar__meta">
          <Timer timeLeft={phase === "playing" ? timeLeft : null} />
        </div>
      </header>

      <main className="game game--solo">
        <section className="game__stage">
          <Canvas
            ref={canvasRef}
            canDraw={canDraw}
            tool={tool}
            color={color}
            size={Math.min(size, SOLO_MAX_SIZE)}
            onAction={handleAction}
            empty={
              phase === "playing" && round ? <MascotNote mood="draw">วาด “{round.word}” เลย!</MascotNote> : null
            }
          />

          <TimeBar timeLeft={phase === "playing" ? timeLeft : null} total={round?.time ?? null} />

          <div className="game__answers game__answers--solo">
            <section className="panel ai-box" aria-live="polite">
              <h2 className="panel__title">AI คิดว่า...</h2>
              <div className="ai-box__body">
                {lastGuess ? (
                  <p className={`ai-box__guess${lastGuess.correct ? " ai-box__guess--ok" : ""}`}>
                    {lastGuess.correct ? "✅" : "🤔"} {lastGuess.text}
                  </p>
                ) : (
                  <p className="ai-box__hint">
                    {thinking ? "กำลังดูภาพ..." : "วาดเลย AI จะดูภาพทุก 5 วินาที"}
                  </p>
                )}
                {lastGuess && thinking && <p className="ai-box__hint">กำลังดูภาพใหม่...</p>}
                {guesses.length > 1 && (
                  <p className="ai-box__past">
                    ก่อนหน้า: {guesses.slice(0, -1).map((g) => g.text).join(" · ")}
                  </p>
                )}
              </div>
              {round && MODE_TEXT[round.aiMode] && (
                <p className={`ai-box__mode${round.aiMode === "mock" ? " ai-box__mode--mock" : ""}`}>
                  {MODE_TEXT[round.aiMode]}
                </p>
              )}
              <button type="button" className="link-btn ai-box__leave" onClick={handleLeave}>
                ออกจากเกม (ไม่บันทึกคะแนน)
              </button>
            </section>
          </div>
        </section>

        <aside className="game__tools">
          <Toolbar
            tool={tool}
            color={color}
            size={size}
            onTool={setToolChoice}
            onColor={setColor}
            onSize={setSize}
            onClear={() => canvasRef.current?.dispatch(clearBoard())}
            onUndo={undo}
            onRedo={redo}
            canUndo={hist.undo}
            canRedo={hist.redo}
            locked={!canDraw}
            maxSize={SOLO_MAX_SIZE}
          />
        </aside>
      </main>

      {/* พักระหว่างด่าน — บอกผลด่านที่เพิ่งจบให้ชัด server เปลี่ยนด่านเอง ไม่มีปุ่มกด */}
      {phase === "rest" && result && (
        <Modal labelledBy="solo-rest-title">
          <Mascot mood={result.correct ? "happy" : "shock"} className="mascot--modal" />
          <h2 className="modal__title" id="solo-rest-title">
            {result.correct ? "🎉 AI ทายถูก!" : "💔 AI ทายไม่ออก"}
          </h2>
          <p className="modal__note">คำที่ให้วาดคือ</p>
          <p className="answer">{result.word}</p>
          {result.correct ? (
            <p className="solo-result solo-result--ok">+{result.gained} คะแนน · ขึ้นด่านถัดไป</p>
          ) : (
            <p className="solo-result solo-result--bad">เสียไป 1 ชีวิต · เหลือ {hearts}</p>
          )}
          <p className="modal__note">
            รวม {score} คะแนน · ด่านถัดไปใน <span className="modal__count">{restLeft}</span>
          </p>
        </Modal>
      )}

      {phase === "over" && final && (
        <Modal labelledBy="solo-over-title">
          <Mascot mood="trophy" className="mascot--modal" />
          <h2 className="modal__title" id="solo-over-title">
            จบเกม
          </h2>
          {result && (
            <p className="modal__note">
              {result.correct ? "" : `ด่านสุดท้าย AI ทายไม่ออก (คำว่า "${result.word}")`}
            </p>
          )}
          <p className="solo-final__score">{final.totalScore}</p>
          <p className="modal__note">คะแนนรวม · ถึงด่าน {final.levelReached}</p>
          <p className="solo-result solo-result--ok">
            {final.rank ? `🏆 อันดับ ${final.rank} ของตลอดกาล` : "บันทึกคะแนนไม่สำเร็จ"}
          </p>
          <div className="modal__actions">
            <button type="button" className="btn btn--primary" onClick={start}>
              เล่นอีกครั้ง
            </button>
            <button type="button" className="btn" onClick={handleLeave}>
              กลับหน้าแรก
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
