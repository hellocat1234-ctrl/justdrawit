import { useState } from "react";
import { socket } from "../socket";
import Avatar from "../components/Avatar";
import Logo from "../components/Logo";
import Ribbon from "../components/Ribbon";
import { MascotNote } from "../components/Mascot";

// ค่าที่ server ยอมรับ ตาม events.md (ค่าอื่น server จะเมิน)
const ROUND_CHOICES = [1, 2, 3, 4, 5];
const TIME_CHOICES = [30, 45, 60, 90];
const MAX_PLAYERS = 8;

export default function WaitingRoom({ room, me, onLeave }) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === me?.playerId;
  const canStart = room.players.length >= 2;

  function copyCode() {
    navigator.clipboard?.writeText(room.code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {} // เบราว์เซอร์บางตัวไม่ให้คัดลอก ก็ไม่เป็นไร ให้ผู้ใช้จดเอง
    );
  }

  // แก้ตั้งค่าได้เฉพาะหัวห้อง — server เช็คซ้ำอีกชั้นเสมอ
  // ส่งไปทั้งก้อนตามหน้าตาใน events.md (server อ่านแค่ rounds กับ drawTime)
  function changeSetting(patch) {
    socket.emit("update_settings", { ...room.settings, ...patch });
  }

  return (
    <div className="screen">
      <Logo />
      <Ribbon tone="teal">ห้องรอ</Ribbon>

      <div className="room">
        <div className="panel">
          <button
            type="button"
            className="code-badge"
            onClick={copyCode}
            aria-label={`คัดลอกรหัสห้อง ${room.code}`}
          >
            {room.code}
          </button>
          <p className="code-hint">
            {copied ? "คัดลอกรหัสห้องแล้ว!" : "กดรหัสเพื่อคัดลอก แล้วส่งให้เพื่อน"}
          </p>
        </div>

        <div className="panel">
          <h2 className="panel__title">
            ผู้เล่น ({room.players.length}/{MAX_PLAYERS})
          </h2>
          <div className="player-list">
            {room.players.map((player) => (
              <div
                key={player.id}
                className={player.id === me?.playerId ? "player-card player-card--me" : "player-card"}
              >
                <Avatar index={player.avatar} />
                <span className="player-card__name">
                  {player.name}
                  {player.id === me?.playerId ? " (คุณ)" : ""}
                </span>
                <span className="player-card__badges">
                  {/* ใช้ hostId เป็นหลัก เพราะ server เป็นคนตัดสินว่าใครเป็นหัวห้อง */}
                  {player.id === room.hostId && (
                    <span title="หัวห้อง" aria-label="หัวห้อง">
                      👑
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          {/* อยู่คนเดียว = มาสคอตถือนาฬิการอเพื่อน */}
          {room.players.length < 2 && <MascotNote mood="wait">รอเพื่อนเข้าห้อง...</MascotNote>}
        </div>

        <div className="panel">
          {isHost ? (
            <div className="settings">
              <div className="settings__row">
                <span className="field__label">จำนวนรอบ</span>
                <div className="segmented" role="group" aria-label="จำนวนรอบ">
                  {ROUND_CHOICES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={room.settings.rounds === n ? "seg seg--active" : "seg"}
                      aria-pressed={room.settings.rounds === n}
                      onClick={() => changeSetting({ rounds: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings__row">
                <span className="field__label">เวลาวาด (วินาที)</span>
                <div className="segmented" role="group" aria-label="เวลาวาดต่อตา">
                  {TIME_CHOICES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={room.settings.drawTime === n ? "seg seg--active" : "seg"}
                      aria-pressed={room.settings.drawTime === n}
                      onClick={() => changeSetting({ drawTime: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="hint-text">รอหัวห้องเริ่มเกม...</p>
          )}

          <div className="actions">
            {isHost && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canStart}
                onClick={() => socket.emit("start_game")}
              >
                เริ่มเกม
              </button>
            )}
            <button type="button" className="btn" onClick={onLeave}>
              ออกจากห้อง
            </button>
          </div>

          {isHost && !canStart && (
            <p className="form-note">ต้องมีผู้เล่นอย่างน้อย 2 คนจึงเริ่มได้</p>
          )}
        </div>
      </div>
    </div>
  );
}
