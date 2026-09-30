import { useEffect, useRef } from "react";

/**
 * กล่อง "ในห้อง" — ใต้กระดาน ฝั่งขวา (DESIGN.md หัวข้อหน้าเกม)
 *
 * เก็บเฉพาะ "เรื่องที่เกิดขึ้นในห้อง" ไม่ใช่คำที่คนพิมพ์ทาย (นั่นอยู่กล่องซ้าย)
 *   ใครเข้าห้อง ใครออกจากห้อง   — useGame เทียบรายชื่อผู้เล่นเองแล้วส่งมาเป็น system
 *   ใครทายถูก                   — useGame รับ correct_guess แล้วส่งมาเป็น system
 *
 * ข้อความระบบล้วน ๆ จึงไม่มีช่องพิมพ์ และอ่านย้อนหลังได้อย่างเดียว
 */
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
        {notes.map((m, i) => (
          <p className="chat__row chat__row--system" key={i}>
            {m.text}
          </p>
        ))}
      </div>
    </section>
  );
}
