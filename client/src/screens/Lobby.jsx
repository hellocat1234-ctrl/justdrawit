import { useState } from "react";
import Logo from "../components/Logo";
import Critter, { GrassStrip, Sparkles } from "../components/Critter";
import Ribbon from "../components/Ribbon";
import RankTable from "../components/RankTable";
import AvatarPicker from "../components/AvatarPicker";
import JoinModal from "../components/JoinModal";
import { Icon } from "../components/Icons";
import { randomName, NAME_MAX_LEN } from "../playerName";
import { useEnterRoom } from "../hooks/useEnterRoom";
import { monthKey, useLeaderboard } from "../hooks/useLeaderboard";

// หน้าแรก (หน้าเดียว ไม่รก)
// ซ้าย: ริบบิ้น PLAY · อวตารใหญ่ + ลูกศร · ชื่อ · ปุ่มใหญ่ 3 ปุ่ม (สร้างห้อง / เข้าห้อง / Solo)
// ขวา: Top 10 (เดือนนี้/ตลอดกาล)
// ชื่อกับอวตารอยู่ที่ App (profile) เพื่อให้ติดไปหน้า SET UP ได้ ฝั่งนี้แค่ช่วยให้ใช้ง่าย server ตรวจซ้ำเสมอ
export default function Lobby({
  connected,
  profile,
  onProfile,
  inviteCode,
  onEntered,
  onError,
  onOpenSetup,
  onOpenLeaderboard,
  onOpenSolo,
}) {
  // เปิดจากลิงก์เชิญ (?room=12345) → กล่องใส่รหัสขึ้นเองพร้อมรหัสที่เติมไว้แล้ว
  const [joining, setJoining] = useState(Boolean(inviteCode));
  const { busy, enter } = useEnterRoom({ connected, onEntered, onError });
  // กล่อง Top 10 — Lobby ถูกสร้างใหม่ทุกครั้งที่กลับมาหน้าแรก จึงโหลดคะแนนใหม่ทุกครั้งเอง
  const [period, setPeriod] = useState("month"); // month | all
  const board = useLeaderboard(period === "month" ? monthKey() : "");

  const name = profile.name;

  function join(code) {
    const who = name.trim() || randomName(); // กันกรณีชื่อว่าง
    enter("join_room", { code, name: who, avatar: profile.avatar }, { name: who, avatar: profile.avatar });
  }

  return (
    <div className="screen screen--home">
      <GrassStrip />
      <div className="logo-wrap">
        <Logo />
        <Sparkles spots={[[-8, 10, 3, 0], [104, 0, 4, 0.7], [-2, 78, 2, 1.4], [98, 82, 3, 0.35], [50, -22, 2, 1.1]]} />
      </div>

      <div className="lobby">
        <section className="panel home deco-host" aria-label="เริ่มเล่น">
          <Critter name="cat" className="crit crit--top-left" />
          <Critter name="star" className="crit crit--side-left" />
          <Ribbon tone="red">PLAY</Ribbon>

          <AvatarPicker value={profile.avatar} onChange={(avatar) => onProfile({ ...profile, avatar })} />

          <label className="field__label" htmlFor="player-name">
            CHOOSE YOUR NAME
          </label>
          {/* ช่องชื่อมีชื่อสุ่มใส่ไว้ให้แล้ว (ไม่ต้องพิมพ์ก็เล่นได้) · ปุ่มลูกเต๋า = สุ่มชื่อใหม่ · ปล่อยช่องว่างไว้ = สุ่มให้เองตอนออกจากช่อง */}
          <div className="name-row">
            <input
              id="player-name"
              className="input"
              value={name}
              onChange={(e) => onProfile({ ...profile, name: e.target.value })}
              onBlur={() => !name.trim() && onProfile({ ...profile, name: randomName() })}
              maxLength={NAME_MAX_LEN}
              placeholder="ชื่อเล่นของคุณ"
              autoComplete="off"
            />
            <button
              type="button"
              className="icon-btn name-row__dice"
              onClick={() => onProfile({ ...profile, name: randomName() })}
              aria-label="สุ่มชื่อใหม่"
              title="สุ่มชื่อใหม่"
            >
              <Icon name="dice" size={30} />
            </button>
          </div>

          <div className="home__buttons">
            <button type="button" className="big-btn big-btn--green" disabled={!connected} onClick={onOpenSetup}>
              <Icon name="star" size={44} />
              <span>สร้างห้อง</span>
            </button>
            <button type="button" className="big-btn big-btn--blue" disabled={!connected} onClick={() => setJoining(true)}>
              <Icon name="door" size={44} />
              <span>เข้าห้อง</span>
            </button>
            <button type="button" className="big-btn big-btn--pink" disabled={!connected} onClick={onOpenSolo}>
              <Icon name="robot" size={46} />
              <span>
                SOLO <small>แข่งกับ AI</small>
              </span>
            </button>
          </div>

          {!connected && (
            <p className="form-note">
              ยังต่อ server ไม่ได้ — เปิด server ด้วย <code>cd server && node index.js</code> ก่อน
            </p>
          )}
        </section>

        <section className="panel lobby__board deco-host" aria-labelledby="lobby-board-title">
          <Critter name="parrot" className="crit crit--top-right" />
          <Critter name="trophy" className="crit crit--side-right" />
          <div className="lobby__board-head">
            <h2 className="panel__title lobby__board-title" id="lobby-board-title">
              <Icon name="trophy" size={26} /> Top 10
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
            meName={name.trim()}
            compact
            emptyText={period === "month" ? "เดือนนี้ยังไม่มีใครติดอันดับ" : "ยังไม่มีใครติดอันดับเลย"}
          />

          {/* หน้า Leaderboard เต็ม (20 อันดับ เลือกเดือนย้อนหลังได้) */}
          <button type="button" className="link-btn lobby__see-all" onClick={onOpenLeaderboard}>
            ดูทั้งหมด <Icon name="arrowR" size={12} />
          </button>
        </section>
      </div>

      {joining && <JoinModal initialCode={inviteCode ?? ""} busy={busy} onSubmit={join} onClose={() => setJoining(false)} />}
    </div>
  );
}
