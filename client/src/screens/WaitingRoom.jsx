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
import OptionRow from "../components/OptionRow";
import ChallengeCards from "../components/ChallengeCards";
import { DIFFICULTY_CHOICES, VISIBILITY_CHOICES, DEFAULT_CHALLENGES, difficultyLabel } from "../roomOptions";

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
  const myTeam = room.players.find((p) => p.id === me?.playerId)?.team ?? null;
  const myReady = room.players.find((p) => p.id === me?.playerId)?.ready ?? false;
  // ผู้เล่นคนอื่น (ไม่ใช่หัวห้อง) ต้องกด Ready ครบทุกคน หัวห้องจึงเริ่มได้ (หัวห้องไม่ต้องกด)
  const others = room.players.filter((p) => p.id !== room.hostId);
  const allReady = others.length > 0 && others.every((p) => p.ready);
  const enoughPlayers = teamMode ? teamsReady : room.players.length >= 2;
  const canStart = enoughPlayers && allReady;

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
        className={`player-card${player.id === me?.playerId ? " player-card--me" : ""}${player.connected === false ? " player-card--away" : ""}`}
      >
        <Avatar index={player.avatar} />
        <span className="player-card__name">
          {player.name}
          {/* หลุดอยู่: server ยังเก็บที่ไว้ให้ 30 วิ เผื่อรีเฟรชแล้วกลับมา */}
          {player.connected === false && <small className="player-card__away"> (หลุด กำลังรอ...)</small>}
        </span>
        {player.id === me?.playerId && <YouTag />}
        <span className="player-card__badges">
          {/* ใช้ hostId เป็นหลัก เพราะ server เป็นคนตัดสินว่าใครเป็นหัวห้อง */}
          {player.id === room.hostId ? (
            <span title="หัวห้อง" aria-label="หัวห้อง">
              <Icon name="crown" size={22} />
            </span>
          ) : (
            // ผู้เล่นคนอื่นโชว์สถานะ READY / WAITING
            <span className={`ready-badge ready-badge--${player.ready ? "on" : "off"}`}>
              {player.ready ? "READY" : "WAITING"}
            </span>
          )}
          {/* หัวห้องเห็นปุ่มเตะออกข้างชื่อคนอื่น (ไม่ใช่ตัวเอง) — server ตรวจซ้ำว่าเป็นหัวห้อง */}
          {isHost && player.id !== me?.playerId && (
            <button
              type="button"
              className="kick-btn"
              aria-label={`เตะ ${player.name} ออกจากห้อง`}
              title="เตะออกจากห้อง"
              onClick={() => socket.emit("kick_player", { playerId: player.id })}
            >
              <Icon name="x" size={16} />
            </button>
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
          {/* ค่าที่ตั้งไว้ของห้อง — ทุกคนในห้องเห็น (มาจาก room.settings ที่ server เก็บ) */}
          <ul className="room-facts" aria-label="ตั้งค่าของห้องนี้">
            <li>{teamMode ? "ทีม A vs B" : "แข่งเดี่ยว"}</li>
            <li>{room.settings.rounds} รอบ</li>
            <li>{room.settings.drawTime} วิ/ตา</li>
            <li>คำระดับ{difficultyLabel(room.settings.difficulty)}</li>
            <li>{room.settings.visibility === "public" ? "Public" : "Private"}</li>
            <li>Challenge {(room.settings.challenges ?? DEFAULT_CHALLENGES).length}/4</li>
          </ul>
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

              <div className="settings__row">
                <span className="field__label">ความยากของคำ</span>
                <OptionRow
                  label="ระดับความยากของคำ"
                  choices={DIFFICULTY_CHOICES}
                  value={room.settings.difficulty}
                  onChange={(difficulty) => changeSetting({ difficulty })}
                />
              </div>
              <div className="settings__row">
                <span className="field__label">ประเภทห้อง</span>
                <OptionRow
                  label="ประเภทห้อง"
                  choices={VISIBILITY_CHOICES}
                  value={room.settings.visibility}
                  onChange={(visibility) => changeSetting({ visibility })}
                />
              </div>
            </div>
          ) : (
            <p className="hint-text">รอหัวห้องเริ่มเกม...</p>
          )}

          {/* การ์ด Mini Challenge — ทุกคนเห็น (หัวห้องกดสลับได้ คนอื่นดูอย่างเดียว) */}
          <ChallengeCards enabled={room.settings.challenges ?? DEFAULT_CHALLENGES} isHost={isHost} />

          <div className="actions">
            {isHost ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canStart}
                onClick={() => socket.emit("start_game")}
              >
                START GAME
              </button>
            ) : (
              // ผู้เล่นคนอื่นกดพร้อม/ยกเลิก (สลับได้) — รอหัวห้องเริ่มเกม
              <button
                type="button"
                className={myReady ? "btn btn--ready-on" : "btn btn--primary"}
                onClick={() => socket.emit("set_ready", { ready: !myReady })}
              >
                {myReady ? "ยกเลิกพร้อม" : "พร้อม (READY)"}
              </button>
            )}
            <button type="button" className="btn" onClick={onLeave}>
              ออกจากห้อง
            </button>
          </div>

          {isHost && !enoughPlayers && (
            <p className="form-note">
              {teamMode
                ? `ต้องมีทีมละอย่างน้อย ${TEAM_MIN} คนจึงเริ่มได้ (ตอนนี้ทีม A ${teamSize("A")} คน · ทีม B ${teamSize("B")} คน)`
                : "ต้องมีผู้เล่นอย่างน้อย 2 คนจึงเริ่มได้"}
            </p>
          )}
          {isHost && enoughPlayers && !allReady && (
            <p className="form-note">รอผู้เล่นคนอื่นกด "พร้อม" ให้ครบทุกคนก่อนเริ่มเกม</p>
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
