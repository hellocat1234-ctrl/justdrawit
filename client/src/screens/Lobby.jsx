import { useState } from "react";
import { socket } from "../socket";
import { AVATARS } from "../avatars";
import Logo from "../components/Logo";
import RankTable from "../components/RankTable";
import { monthKey, useLeaderboard } from "../hooks/useLeaderboard";

// หน้าแรก: แท็บ CREATE / JOIN · เลือกอวตาร · ใส่ชื่อ · (แท็บ JOIN มีช่องรหัสห้อง)
// ขวาเป็นกล่อง Top 10 (เดือนนี้/ตลอดกาล) · วิธีเล่นแบบย่ออยู่ใต้ฟอร์ม
// ฝั่งนี้แค่ช่วยให้ใช้ง่าย ของจริง server เป็นคนตรวจซ้ำเสมอ (server-authoritative)
export default function Lobby({ connected, onEntered, onError, onOpenLeaderboard }) {
  const [tab, setTab] = useState("create"); // create | join
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [busy, setBusy] = useState(false);
  // กล่อง Top 10 — Lobby ถูกสร้างใหม่ทุกครั้งที่กลับมาหน้าแรก จึงโหลดคะแนนใหม่ทุกครั้งเอง
  const [period, setPeriod] = useState("month"); // month | all
  const board = useLeaderboard(period === "month" ? monthKey() : "");

  function submit(event) {
    event.preventDefault();
    if (busy || !connected) return;
    setBusy(true);

    // กันตอบซ้ำ: ถ้า server ไม่ตอบใน 6 วิ (เช่น ลืมเปิด server) ให้ปลดล็อกปุ่มแล้วบอกผู้ใช้
    let answered = false;
    const finish = (fn) => {
      if (answered) return;
      answered = true;
      setBusy(false);
      fn();
    };

    const isCreate = tab === "create";
    const payload = isCreate ? { name, avatar } : { code, name, avatar };

    socket.timeout(6000).emit(isCreate ? "create_room" : "join_room", payload, (err, res) => {
      if (err) return finish(() => onError("CONNECT_FAILED"));
      if (!res?.ok) return finish(() => onError(res?.error));
      // join_room ไม่ได้ส่ง code กลับมา เราใช้รหัสที่ผู้ใช้พิมพ์เอง
      finish(() => onEntered({ playerId: res.playerId, code: res.code ?? code, name, avatar }));
    });
  }

  return (
    <div className="screen">
      <Logo />

      <div className="lobby">
        <form className="panel lobby__form" onSubmit={submit}>
          <div className="tabs">
            <button
              type="button"
              className={tab === "create" ? "tab tab--active" : "tab"}
              onClick={() => setTab("create")}
            >
              CREATE GAME
            </button>
            <button
              type="button"
              className={tab === "join" ? "tab tab--active" : "tab"}
              onClick={() => setTab("join")}
            >
              JOIN GAME
            </button>
          </div>

          <label className="field__label" htmlFor="player-name">
            CHOOSE YOUR NAME
          </label>
          <input
            id="player-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="ชื่อเล่นของคุณ"
            autoComplete="off"
          />

          {tab === "join" && (
            <>
              <label className="field__label" htmlFor="room-code">
                ROOM CODE
              </label>
              <input
                id="room-code"
                className="input input--code"
                value={code}
                // รับเฉพาะตัวเลข 5 หลัก (server ยังตรวจซ้ำอีกชั้น)
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                placeholder="12345"
                autoComplete="off"
              />
            </>
          )}

          <span className="field__label" id="avatar-label">
            PICK YOUR AVATAR
          </span>
          <div className="avatars" role="group" aria-labelledby="avatar-label">
            {AVATARS.map((emoji, index) => (
              <button
                type="button"
                key={emoji}
                className={avatar === index ? "avatar avatar--selected" : "avatar"}
                aria-label={`อวตาร ${emoji}`}
                aria-pressed={avatar === index}
                onClick={() => setAvatar(index)}
              >
                {emoji}
              </button>
            ))}
          </div>

          <button type="submit" className="btn btn--primary btn--wide" disabled={!connected || busy}>
            {busy ? "กำลังเข้า..." : tab === "create" ? "START" : "JOIN"}
          </button>

          {!connected && (
            <p className="form-note">
              ยังต่อ server ไม่ได้ — เปิด server ด้วย <code>cd server && node index.js</code> ก่อน
            </p>
          )}
        </form>

        <section className="panel lobby__board" aria-labelledby="lobby-board-title">
          <div className="lobby__board-head">
            <h2 className="panel__title lobby__board-title" id="lobby-board-title">
              🏆 Top 10
            </h2>
            <div className="period-toggle" role="group" aria-label="ช่วงเวลา">
              <button
                type="button"
                className={period === "month" ? "period-toggle__btn period-toggle__btn--active" : "period-toggle__btn"}
                aria-pressed={period === "month"}
                onClick={() => setPeriod("month")}
              >
                เดือนนี้
              </button>
              <button
                type="button"
                className={period === "all" ? "period-toggle__btn period-toggle__btn--active" : "period-toggle__btn"}
                aria-pressed={period === "all"}
                onClick={() => setPeriod("all")}
              >
                ตลอดกาล
              </button>
            </div>
          </div>

          <RankTable
            board={board}
            limit={10}
            compact
            emptyText={period === "month" ? "เดือนนี้ยังไม่มีใครติดอันดับ" : "ยังไม่มีใครติดอันดับเลย"}
          />

          {/* หน้า Leaderboard เต็ม (20 อันดับ เลือกเดือนย้อนหลังได้) */}
          <button type="button" className="link-btn lobby__see-all" onClick={onOpenLeaderboard}>
            ดูทั้งหมด →
          </button>
        </section>

        {/* วิธีเล่นแบบย่อ ให้หน้าแรกไม่ต้องเลื่อนบนจอคอม */}
        <aside className="panel lobby__rules">
          <h2 className="panel__title">วิธีเล่น</h2>
          <p className="rules-short">คนหนึ่งวาด คนอื่นพิมพ์ทาย ทายถูกเร็วได้คะแนนเยอะ</p>
          <p className="rules-tip">
            🎨 <strong>Mini Challenge</strong> บางตาสุ่มกติกาพิเศษ
          </p>
        </aside>
      </div>
    </div>
  );
}
