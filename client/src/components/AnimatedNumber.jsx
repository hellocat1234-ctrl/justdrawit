import { useEffect, useRef, useState } from "react";
import { reduceMotion } from "../prefs";

// ตัวเลขที่ "วิ่ง" จากค่าเก่าไปค่าใหม่ (ใช้กับคะแนน) ใช้เวลา ~0.7 วิ
// ค่าจริงมาจาก server เสมอ นี่แค่ทำให้ตัวเลขเปลี่ยนแบบมีชีวิต
// ลดภาพเคลื่อนไหวอยู่ = ข้ามไปค่าใหม่ทันที · ตอนเปิดหน้าครั้งแรกไม่วิ่งจาก 0 (โชว์ค่าจริงเลย)
export default function AnimatedNumber({ value, ms = 700 }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const shownRef = useRef(value);
  shownRef.current = shown;

  useEffect(() => {
    if (reduceMotion() || shownRef.current === value) {
      setShown(value);
      return undefined;
    }
    const from = shownRef.current;
    fromRef.current = from;
    const t0 = performance.now();
    let raf = 0;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - p) * (1 - p); // เริ่มเร็วแล้วค่อยชะลอ
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return <>{shown}</>;
}
