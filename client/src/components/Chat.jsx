import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";

/**
 * แชทของห้อง — คอลัมน์ขวาของหน้าเกม (DESIGN.md หัวข้อหน้าเกม)
 *
 * รวมสองอย่างไว้ในกล่องเดียว (เดิมแยกเป็น "คำตอบ" กับ "ในห้อง")
 *   ข้อความผู้เล่น  ทายผิดดำปกติ · ทายถูกพื้นเขียวอ่อนตัวเขียว (คำของตัวเองเห็นคำจริง คนอื่นเห็น ****** — server ตัดสิน) · ของตัวเองขอบซ้ายสีฟ้า
 *   ข้อความระบบ     เรื่องที่เกิดในห้อง (ใครเข้าออก ใครทายถูก คำใบ้ หมดเวลา) แถวเทาเอียงพร้อมไอคอนตามชนิด (`kind` ที่ useGame ใส่มา)
 *
 * คนวาดพิมพ์ไม่ได้ระหว่างวาด server ตัดทิ้งอยู่แล้ว แต่ฝั่งเราปิดช่องไปเลยจะได้เข้าใจง่าย
 */
// ชนิดข้อความระบบ → ไอคอน (ชนิดที่ไม่รู้จัก/ไม่มี = info)
const KINDS = {
  join: "door",
  leave: "door",
  correct: "check",
  timeout: "clock",
  hint: "bulb",
  pen: "pen",
  team: "flag",
  info: "info",
};

export default function Chat({ messages = [], meId, disabled = false, onSend, focusKey = 0 }) {
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // ข้อความใหม่มา ให้เลื่อนลงล่างสุดเสมอ
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  // ขึ้นตาใหม่ = เริ่มทายใหม่ ให้เคอร์เซอร์อยู่ที่ช่องพิมพ์เลย จะได้พิมพ์ได้ทันทีไม่ต้องกดก่อน
  // ข้ามตอนที่พิมพ์ไม่ได้ (เราเป็นคนวาด) ไม่งั้นจะไปแย่งโฟกัสทั้งที่พิมพ์ไม่ได้
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  function handleSubmit(e) {
    e.preventDefault(); // กด Enter ในช่องนี้ = ส่ง (ฟอร์มจัดการให้เอง ไม่ต้องดักคีย์เอง)
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
  }

  return (
    <section className="panel panel--chat" aria-label="แชท">
      <h2 className="panel__title">แชท</h2>

      <div className="chat__list" ref={listRef}>
        {messages.length === 0 && <p className="chat__empty">พิมพ์ทายคำที่นี่</p>}
        {messages.map((m, i) => {
          if (m.system) {
            const kind = KINDS[m.kind] ? m.kind : "info";
            return (
              <p className={`chat__row chat__row--system note note--${kind}`} key={i}>
                <span className="note__icon" aria-hidden="true">
                  <Icon name={KINDS[kind]} size={16} />
                </span>
                <span className="note__text">{m.text}</span>
              </p>
            );
          }
          const classes = ["chat__row"];
          if (m.correct) classes.push("chat__row--correct");
          if (m.playerId === meId) classes.push("chat__row--mine");
          return (
            <p className={classes.join(" ")} key={i}>
              <span className="chat__name">{m.name}:</span> {m.text}
            </p>
          );
        })}
      </div>

      <form className="chat__form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="input chat__input"
          type="text"
          value={text}
          maxLength={100}
          disabled={disabled}
          placeholder={disabled ? "คุณกำลังวาดอยู่" : "ทายคำ..."}
          aria-label="ช่องทายคำ"
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn--primary" type="submit" disabled={disabled || !text.trim()}>
          ส่ง
        </button>
      </form>
    </section>
  );
}
