import { useEffect, useRef } from "react";
import { PICK_BACKGROUND, PICK_HUE_BAR, PICK_L_BOTTOM, PICK_L_TOP, hslToHex } from "../canvas/palette";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * ช่องเลือกสีเองแบบสองแกน — แผงลอยข้างแถบเครื่องมือ (ไม่ดันความสูงของคอลัมน์)
 * ลาก/แตะตรงไหนได้สีตรงนั้นทันที: แนวนอน = เปลี่ยนสี · แนวตั้ง = อ่อนเข้ม
 * ใช้ pointer events (เมาส์ นิ้ว Apple Pencil ทางเดียวกัน) + setPointerCapture ลากออกนอกช่องแล้วยังต่อ
 * จุดจับเป็นสี่เหลี่ยมใหญ่ 30px จับง่ายด้วยนิ้ว · touch-action: none กันหน้าเลื่อนระหว่างลาก
 */
export default function ColorPicker({ hue, light, onChange, onClose }) {
  const areaRef = useRef(null);
  const barRef = useRef(null);
  const dragging = useRef(null); // "area" | "bar" | null

  // ช่องสองแกน: x → สี, y → อ่อนเข้ม · แถบสีรุ้งด้านบน: x → สีอย่างเดียว (ความอ่อนเข้มคงเดิม)
  function pick(e, which) {
    const el = which === "bar" ? barRef.current : areaRef.current;
    const r = el.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1);
    const h = Math.round(x * 360);
    if (which === "bar") return onChange(h, light);
    const y = clamp((e.clientY - r.top) / r.height, 0, 1);
    onChange(h, PICK_L_TOP - y * (PICK_L_TOP - PICK_L_BOTTOM));
  }

  const handlers = (which) => ({
    onPointerDown: (e) => {
      dragging.current = which;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* จับไม่ได้ก็ยังเลือกสีได้ */
      }
      pick(e, which);
    },
    onPointerMove: (e) => dragging.current === which && pick(e, which),
    onPointerUp: () => (dragging.current = null),
    onPointerCancel: () => (dragging.current = null),
  });

  // ปิดด้วย Esc หรือแตะนอกแผง (ยกเว้นปุ่ม "สีเอง" เอง ที่สลับเปิด/ปิดของมันเอง)
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    const onDown = (e) => {
      if (!(e.target instanceof Element) || e.target.closest(".color-pop, .swatch--custom")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  const hex = hslToHex(hue, 1, light);
  return (
    <div className="color-pop" role="dialog" aria-label="เลือกสีเอง">
      <div className="color-pop__head">
        <span className="toolbar__label">สีเอง</span>
        <span className="color-pop__hex">{hex.toUpperCase()}</span>
        <button type="button" className="color-pop__close" onClick={onClose} aria-label="ปิดช่องเลือกสี">
          เสร็จ
        </button>
      </div>
      {/* แกนนอน: แถบสีรุ้งสดเต็มแถบ (ลากเปลี่ยนสีอย่างเดียวได้) มีขีดบอกตำแหน่งสีปัจจุบัน */}
      <div
        ref={barRef}
        className="color-pop__bar"
        style={{ background: PICK_HUE_BAR }}
        aria-label="แถบสีรุ้ง ลากเพื่อเปลี่ยนสี"
        {...handlers("bar")}
      >
        <span className="color-pop__tick" style={{ left: `${(hue / 360) * 100}%` }} />
      </div>
      <div
        ref={areaRef}
        className="color-pop__area"
        style={{ background: PICK_BACKGROUND }}
        aria-label="ช่องเลือกสี แนวนอนเปลี่ยนสี แนวตั้งปรับอ่อนเข้ม"
        {...handlers("area")}
      >
        <span
          className="color-pop__thumb"
          style={{
            left: `${(hue / 360) * 100}%`,
            top: `${((PICK_L_TOP - light) / (PICK_L_TOP - PICK_L_BOTTOM)) * 100}%`,
            background: hex,
          }}
        />
      </div>
    </div>
  );
}
