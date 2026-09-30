import { useEffect, useRef, useState } from "react";

// แชท + ช่องทายคำ
// ข้อความ 3 แบบ: ทายผิด (ดำปกติ) · ทายถูก (พื้นเขียวอ่อน) · ข้อความระบบ (เทาเอียง)
// คนวาดพิมพ์ไม่ได้ระหว่างวาด server ตัดทิ้งอยู่แล้ว แต่ฝั่งเราปิดช่องไปเลยจะได้เข้าใจง่าย
export default function Chat({ messages = [], meId, disabled = false, onSend }) {
  const [text, setText] = useState("");
  const listRef = useRef(null);

  // ข้อความใหม่มา ให้เลื่อนลงล่างสุดเสมอ
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
  }

  return (
    <section className="chat" aria-label="แชท">
      <div className="chat__list" ref={listRef}>
        {messages.length === 0 && <p className="chat__empty">พิมพ์ทายคำที่นี่</p>}
        {messages.map((m, i) => {
          if (m.system) {
            return (
              <p className="chat__row chat__row--system" key={i}>
                {m.text}
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
