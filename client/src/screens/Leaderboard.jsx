import { useEffect, useState } from "react";
import Logo from "../components/Logo";

// หน้า Leaderboard (ข้อ 6) — ขอข้อมูลด้วย HTTP ธรรมดา ไม่ใช่ socket เพราะขอดูครั้งเดียว ไม่ต้องสด
// ตัวเลือกเดือน: เดือนนี้ย้อนหลัง 12 เดือน + "ตลอดกาล" (ค่าว่าง = ไม่ส่ง month = ตลอดกาล)
const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };
const ALL_TIME = "";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

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
  const [state, setState] = useState({ status: "loading", top: [] }); // loading | ready | error
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    // เปลี่ยนเดือนเร็วๆ คำขอเก่าอาจตอบมาทีหลังแล้วทับของใหม่ → ยกเลิกคำขอเก่าทิ้งทุกครั้ง
    const controller = new AbortController();
    setState((s) => ({ ...s, status: "loading" }));
    const query = month === ALL_TIME ? "" : `?month=${month}`;

    fetch(`/api/leaderboard${query}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setState({ status: "ready", top: Array.isArray(data?.top) ? data.top : [] }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ status: "error", top: [] });
      });

    return () => controller.abort();
  }, [month, retry]);

  const periodText = month === ALL_TIME ? "ตลอดกาล" : `เดือน${monthLabel(month)}`;

  return (
    <div className="screen">
      <Logo />

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

        {state.status === "error" && (
          <div className="board-empty">
            <p>ต่อ server ไม่ได้ ลองใหม่อีกครั้ง</p>
            <button type="button" className="btn" onClick={() => setRetry((n) => n + 1)}>
              ลองใหม่
            </button>
          </div>
        )}

        {state.status === "ready" && state.top.length === 0 && (
          <div className="board-empty">
            <p className="board-empty__icon">🎨</p>
            <p>ยังไม่มีใครติดอันดับ{periodText}</p>
            <p className="muted">ไปแข่งกับ AI แล้วมาเป็นคนแรกบนกระดานนี้กัน!</p>
          </div>
        )}

        {state.status !== "error" && state.top.length > 0 && (
          // ตอนกำลังโหลดเดือนใหม่ ยังโชว์ตารางเดิมแบบจางไว้ จอจะได้ไม่กระพริบ
          <table className={state.status === "loading" ? "rank-table rank-table--loading" : "rank-table"}>
            <thead>
              <tr>
                <th scope="col">อันดับ</th>
                <th scope="col">ชื่อ</th>
                <th scope="col">ด่าน</th>
                <th scope="col">คะแนน</th>
              </tr>
            </thead>
            <tbody>
              {state.top.map((row) => (
                <tr key={row.rank} className={row.rank <= 3 ? `rank-row rank-row--${row.rank}` : "rank-row"}>
                  <td className="rank-row__rank">{MEDALS[row.rank] ?? row.rank}</td>
                  {/* ชื่อแสดงผ่าน {} ของ React = ข้อความธรรมดาเสมอ
                      ชื่อแบบ <b>x</b> จะขึ้นเป็นตัวอักษรตามนั้น ไม่ถูกตีความเป็น HTML
                      (ห้ามเปลี่ยนไปใช้ dangerouslySetInnerHTML ที่นี่เด็ดขาด) */}
                  <td className="rank-row__name">{row.name}</td>
                  <td className="rank-row__level">{row.levelReached}</td>
                  <td className="rank-row__score">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {state.status === "loading" && state.top.length === 0 && <p className="board-empty">กำลังโหลด...</p>}

        <button type="button" className="btn btn--wide board-panel__back" onClick={onBack}>
          ← กลับหน้าแรก
        </button>
      </section>
    </div>
  );
}
