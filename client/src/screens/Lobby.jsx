import { useState } from "react";
import { socket } from "../socket";
import { AVATARS } from "../avatars";
import Logo from "../components/Logo";

// หน้าแรก: แท็บ CREATE / JOIN · เลือกอวตาร · ใส่ชื่อ · (แท็บ JOIN มีช่องรหัสห้อง)
// ฝั่งนี้แค่ช่วยให้ใช้ง่าย ของจริง server เป็นคนตรวจซ้ำเสมอ (server-authoritative)
export default function Lobby({ connected, onEntered, onError }) {
  const [tab, setTab] = useState("create"); // create | join
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [busy, setBusy] = useState(false);

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
        <form className="panel" onSubmit={submit}>
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

        <aside className="panel">
          <h2 className="panel__title">วิธีเล่น</h2>
          <ol className="rules">
            <li>คนหนึ่งเป็นคนวาด คนอื่นเห็นภาพสดๆ แล้วพิมพ์ทายในช่องแชท</li>
            <li>ทายถูกเร็วได้คะแนนมาก คนวาดก็ได้คะแนนเมื่อมีคนทายถูก</li>
            <li>สลับกันวาดจนครบรอบ ใครคะแนนมากที่สุดชนะ</li>
          </ol>
          <p className="rules-tip">
            🎨 <strong>Mini Challenge</strong> — บางตาจะมีกติกาพิเศษสุ่มมา เช่น วาดได้สีเดียว (Colour Fix)
            หรือห้ามยกปากกา (Don&apos;t Lift Pen)
          </p>
        </aside>
      </div>
    </div>
  );
}
