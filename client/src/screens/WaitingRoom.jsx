import { useState } from "react";
import { socket } from "../socket";
import Avatar from "../components/Avatar";
import Logo from "../components/Logo";
import Critter from "../components/Critter";
import Ribbon from "../components/Ribbon";
import { MascotNote } from "../components/Mascot";
import { InfoModal } from "../components/TopIcons";
import YouTag from "../components/YouTag";
import TeamRules from "../components/TeamRules";
import { markRulesSeen, rulesSeen } from "../prefs";
import { Icon } from "../components/Icons";
import { copyText, inviteUrl } from "../invite";

// ค่าที่ server ยอมรับ ตาม events.md (ค่าอื่น server จะเมิน)
const ROUND_CHOICES = [1, 2, 3, 4, 5];
const TIME_CHOICES = [30, 45, 60, 90];
const MAX_PLAYERS = 8;
const TEAMS = ["A", "B"];
const TEAM_MIN = 2; // โหมดทีมต้องมีทีมละอย่างน้อย 2 คน (server เช็คซ้ำ)

export default function WaitingRoom({ room, me, onLeave }) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // กล่องกติกาโชว์เองครั้งแรกที่เข้าห้อง (จำไว้ในเบราว์เซอร์) ครั้งต่อไปกดดูเองได้จากปุ่ม ℹ️ ในหน้าเกม
  const [showRules, setShowRules] = useState(() => !rulesSeen());
  const isHost = room.hostId === me?.playerId;
  const teamMode = room.settings.mode === "team";
  const teamSize = (t) => room.players.filter((p) => p.team === t).length;
  const teamsReady = TEAMS.every((t) => teamSize(t) >= TEAM_MIN);
  const canStart = teamMode ? teamsReady : room.players.length >= 2;
  const myTeam = room.players.find((p) => p.id === me?.playerId)?.team ?? null;

  // ลิงก์เชิญ: เพื่อนเปิดแล้วหน้าแรกเติมรหัสห้องให้เอง
  async function copyLink() {
    if (await copyText(inviteUrl(room.code))) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    }
  }

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

  function renderPlayer(player) {
    return (
      <div
        key={player.id}
        className={player.id === me?.playerId ? "player-card player-card--me" : "player-card"}
      >
        <Avatar index={player.avatar} />
        <span className="player-card__name">
          {player.name}
        </span>
        {player.id === me?.playerId && <YouTag />}
        <span className="player-card__badges">
          {/* ใช้ hostId เป็นหลัก เพราะ server เป็นคนตัดสินว่าใครเป็นหัวห้อง */}
          {player.id === room.hostId && (
            <span title="หัวห้อง" aria-label="หัวห้อง">
              <Icon name="crown" size={22} />
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="screen">
      <Logo />
      <Ribbon tone="teal">ห้องรอ</Ribbon>

      <div className="room">
        <div className="panel deco-host">
          <Critter name="cat" className="crit crit--top-left" />
          <Critter name="parrot" className="crit crit--top-right" />
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
          <button type="button" className="btn btn--invite" onClick={copyLink}>
            <Icon name="share" size={20} /> {linkCopied ? "คัดลอกลิงก์แล้ว!" : "คัดลอกลิงก์เชิญ"}
          </button>
        </div>

        <div className="panel">
          <h2 className="panel__title">
            ผู้เล่น ({room.players.length}/{MAX_PLAYERS})
          </h2>
          {teamMode && myTeam && (
            <p className={`team-me-banner team-me-banner--${myTeam}`}>
              คุณอยู่ทีม {myTeam} · อยากย้ายทีม กดปุ่ม "ย้ายมาทีม {myTeam === "A" ? "B" : "A"}" ได้เลย
            </p>
          )}
          {teamMode ? (
            // โหมดทีม: สองฝั่ง ทีม A แดง ทีม B ฟ้า · ย้ายได้เฉพาะตัวเอง (set_team ของ server เป็นของตัวเองเท่านั้น)
            <div className="team-cols">
              {TEAMS.map((t) => (
                <section className={`team-col team-col--${t}`} key={t} aria-label={`ทีม ${t}`}>
                  <h3 className="team-col__title">
                    <span>ทีม {t}</span>
                    <span className="team-col__count">{teamSize(t)} คน</span>
                  </h3>
                  <div className="player-list">
                    {room.players.filter((p) => p.team === t).map(renderPlayer)}
                    {teamSize(t) === 0 && <p className="team-col__empty">ยังไม่มีใคร</p>}
                  </div>
                  {myTeam !== t && (
                    <button type="button" className="btn team-col__join" onClick={() => socket.emit("set_team", { team: t })}>
                      ย้ายมาทีม {t}
                    </button>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="player-list">{room.players.map(renderPlayer)}</div>
          )}
          {/* อยู่คนเดียว = มาสคอตถือนาฬิการอเพื่อน */}
          {room.players.length < 2 && <MascotNote mood="wait">รอเพื่อนเข้าห้อง...</MascotNote>}
        </div>

        {teamMode && (
          <div className="panel">
            <h2 className="panel__title">กติกาโหมดทีม</h2>
            <TeamRules />
          </div>
        )}

        <div className="panel">
          {isHost ? (
            <div className="settings">
              <div className="settings__row">
                <span className="field__label">โหมด</span>
                <div className="segmented" role="group" aria-label="โหมดเกม">
                  {[
                    ["classic", "แข่งเดี่ยว"],
                    ["team", "ทีม A vs B"],
                  ].map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      className={room.settings.mode === m ? "seg seg--active" : "seg"}
                      aria-pressed={room.settings.mode === m}
                      onClick={() => changeSetting({ mode: m })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

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
            <p className="hint-text">
              โหมด: {teamMode ? "ทีม A vs B" : "แข่งเดี่ยว"} · รอหัวห้องเริ่มเกม...
            </p>
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
            <p className="form-note">
              {teamMode
                ? `ต้องมีทีมละอย่างน้อย ${TEAM_MIN} คนจึงเริ่มได้ (ตอนนี้ทีม A ${teamSize("A")} คน · ทีม B ${teamSize("B")} คน)`
                : "ต้องมีผู้เล่นอย่างน้อย 2 คนจึงเริ่มได้"}
            </p>
          )}
          {!isHost && teamMode && !teamsReady && (
            <p className="form-note">โหมดทีมต้องมีทีมละอย่างน้อย {TEAM_MIN} คนถึงจะเริ่มได้</p>
          )}
        </div>
      </div>

      {showRules && (
        <InfoModal
          onClose={() => {
            markRulesSeen();
            setShowRules(false);
          }}
        />
      )}
    </div>
  );
}
