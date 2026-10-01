import { useState } from "react";
import Logo from "../components/Logo";
import Ribbon from "../components/Ribbon";
import RankTable from "../components/RankTable";
import { monthKey, useLeaderboard } from "../hooks/useLeaderboard";

// หน้า Leaderboard เต็ม (ข้อ 6) — 20 อันดับ เลือกย้อนหลังได้ 12 เดือน + ตลอดกาล
// หน้าแรกมีกล่องย่อ (Top 10) อยู่แล้ว หน้านี้เปิดจากลิงก์ "ดูทั้งหมด" ใต้กล่องนั้น
const ALL_TIME = "";

// "2026-10" → "ตุลาคม 2569" (ปี พ.ศ. ตามที่คนไทยคุ้น)
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

function recentMonths(count = 12) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}

export default function Leaderboard({ onBack }) {
  const [months] = useState(recentMonths);
  const [month, setMonth] = useState(months[0]); // เปิดมาเห็นเดือนนี้ก่อน
  const board = useLeaderboard(month);

  const periodText = month === ALL_TIME ? "ตลอดกาล" : `เดือน${monthLabel(month)}`;

  return (
    <div className="screen">
      <Logo />
      <Ribbon tone="blue">LEADERBOARD</Ribbon>

      <section className="panel board-panel">
        <div className="board-panel__head">
          <h2 className="panel__title board-panel__title">🏆 Leaderboard</h2>
          <div className="board-panel__picker">
            <label className="field__label board-panel__label" htmlFor="lb-month">
              MONTH
            </label>
            <select
              id="lb-month"
              className="input board-panel__select"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {months.map((key) => (
                <option key={key} value={key}>
                  {monthLabel(key)}
                </option>
              ))}
              <option value={ALL_TIME}>ตลอดกาล</option>
            </select>
          </div>
        </div>

        <p className="hint-text">คะแนนจากโหมด Solo แข่งกับ AI · {periodText} · 20 อันดับแรก</p>

        <RankTable board={board} limit={20} emptyText={`ยังไม่มีใครติดอันดับ${periodText}`} />

        <button type="button" className="btn btn--wide board-panel__back" onClick={onBack}>
          ← กลับหน้าแรก
        </button>
      </section>
    </div>
  );
}
