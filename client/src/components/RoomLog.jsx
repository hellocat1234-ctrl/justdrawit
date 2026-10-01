import { useEffect, useRef } from "react";

/**
 * กล่อง "ในห้อง" — ใต้กระดาน ฝั่งขวา (DESIGN.md หัวข้อหน้าเกม)
 *
 * เก็บเฉพาะ "เรื่องที่เกิดขึ้นในห้อง" ไม่ใช่คำที่คนพิมพ์ทาย (นั่นอยู่กล่องซ้าย)
 * แต่ละข้อความมีชนิด (kind) ที่ useGame ใส่มา → ได้ไอคอนและสีประจำชนิด
 * ชนิดที่รู้จัก: join · leave · correct · timeout · hint · pen  (ชนิดอื่น/ไม่มี = info)
 *
 * ข้อความระบบล้วน ๆ จึงไม่มีช่องพิมพ์ และอ่านย้อนหลังได้อย่างเดียว
 */
const KINDS = {
  join: "🚪",
  leave: "👋",
  correct: "✅",
  timeout: "⏰",
  hint: "💡",
  pen: "🖊️",
  info: "ℹ️",
};

export default function RoomLog({ messages = [] }) {
  const listRef = useRef(null);

  // เรื่องใหม่มา ให้เลื่อนลงล่างสุดเสมอ
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const notes = messages.filter((m) => m.system);

  return (
    <section className="panel panel--room" aria-label="ในห้อง">
      <h2 className="panel__title">ในห้อง</h2>
      <div className="chat__list" ref={listRef}>
        {notes.length === 0 && <p className="chat__empty">ยังไม่มีอะไรเกิดขึ้น</p>}
        {notes.map((m, i) => {
          const kind = KINDS[m.kind] ? m.kind : "info";
          return (
            <p className={`chat__row chat__row--system note note--${kind}`} key={i}>
              <span className="note__icon" aria-hidden="true">
                {KINDS[kind]}
              </span>
              <span className="note__text">{m.text}</span>
            </p>
          );
        })}
      </div>
    </section>
  );
}
