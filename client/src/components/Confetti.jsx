import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { reduceMotion } from "../prefs";

// พลุกระดาษสีพิกเซล — ชิ้นสี่เหลี่ยมเล็กๆ พุ่งขึ้นจากแท่นรางวัลแล้วร่วงลง (CSS ล้วน ไม่มี library)
//
// ทำไมชั้นพลุเป็น position: fixed ทั้งจอ แทนที่จะอยู่ในกล่องแท่น
//   หน้าต่างจบเกม (.modal__panel) เลื่อนได้ ถ้าชิ้นพลุร่วงเลยขอบล่างของมัน เนื้อหาจะ "ยาวขึ้น"
//   แล้วเกิดแถบเลื่อนกระพริบ — fixed ไม่นับเป็นความยาวของกล่อง จึงไม่มีปัญหานี้
//   แต่เพื่อให้พลุเริ่มที่แท่นจริง เราวัดตำแหน่งจุดยึด (.confetti-anchor ในกล่องแท่น) ตอนเกิดแล้วใช้เป็นจุดเริ่ม
// ลดภาพเคลื่อนไหวอยู่ = ไม่แสดงเลย
const COLORS = ["#ffc81e", "#1e6fe8", "#22a559", "#e8553f", "#e85c9e", "#13a3a0", "#7b5ce0"];

export default function Confetti({ count = 44 }) {
  const anchorRef = useRef(null);
  const [origin, setOrigin] = useState(null);

  useLayoutEffect(() => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (r) setOrigin({ x: Math.round(r.left), y: Math.round(r.top) });
  }, []);

  // สุ่มครั้งเดียวตอนเกิด ไม่ให้ชิ้นกระโดดเมื่อ re-render
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        color: COLORS[i % COLORS.length],
        dx: Math.round((Math.random() - 0.5) * 360), // พุ่งซ้าย/ขวา px
        up: Math.round(90 + Math.random() * 130), // พุ่งสูง px
        fall: Math.round(200 + Math.random() * 160), // ร่วงลงต่ำกว่าจุดเริ่ม px
        size: 6 + Math.round(Math.random() * 2) * 2, // 6 / 8 / 10
        delay: Math.round(Math.random() * 400),
        dur: 1700 + Math.round(Math.random() * 900),
        spin: Math.round((Math.random() - 0.5) * 540),
      })),
    [count]
  );

  if (reduceMotion()) return null;

  return (
    <>
      <span className="confetti-anchor" ref={anchorRef} />
      {origin && (
        <div className="confetti" aria-hidden="true">
          {pieces.map((p, i) => (
            <span
              key={i}
              className="confetti__piece"
              style={{
                left: origin.x,
                top: origin.y,
                background: p.color,
                width: p.size,
                height: p.size,
                animationDelay: `${p.delay}ms`,
                animationDuration: `${p.dur}ms`,
                "--dx": `${p.dx}px`,
                "--up": `${-p.up}px`,
                "--fall": `${p.fall}px`,
                "--spin": `${p.spin}deg`,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
