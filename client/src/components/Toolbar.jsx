import { useState } from "react";
import {
  PAINT_COLORS,
  SIZE_MIN,
  SIZE_MAX,
  TOOLS,
  HUE_MIN,
  HUE_MAX,
  HUE_DEFAULT,
  RAINBOW_GRADIENT,
  hslToHex,
} from "../canvas/palette";

/**
 * แถบเครื่องมือวาด — อยู่คอลัมน์ขวาของหน้าเกม (DESIGN.md)
 *
 * ตัวนี้ไม่รู้จัก canvas เลย มันแค่บอกพ่อแม่ (Game) ว่า "ผู้ใช้เลือกอะไร"
 * แล้วพ่อแม่ส่งค่าลงไปให้ Canvas อีกที — แยกหน้าที่กันชัด จะได้หาที่ผิดง่าย
 *
 * สองโหมด
 *   ปกติ (จอใหญ่)  แนวตั้ง อยู่ในคอลัมน์ขวา มือขวาเอื้อมถึงง่าย
 *   มือถือ          แนวนอน เป็นแถบใต้กระดาน (Game เป็นคนสลับด้วย CSS)
 *
 * คนที่ไม่ใช่คนวาดยังเห็นแถบนี้ แต่จางและกดไม่ได้ (locked)
 * เหตุผล: ถ้าซ่อนไปเลย กระดานจะเปลี่ยนความกว้างทุกครั้งที่สลับคนวาด ภาพที่วาดไว้จะกระโดด
 */
export default function Toolbar({
  tool,
  color,
  size,
  onTool,
  onColor,
  onSize,
  onClear,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  locked = false,
}) {
  // สีที่เลือกเองจากแถบสีรุ้ง — เก็บเป็น "องศาสี" (0–360) แล้วแปลงเป็น hex ตอนใช้
  // เก็บเป็น hue ไม่ใช่ hex เพราะแถบสีรุ้งต้องรู้ว่าจะวางหัวเลื่อนไว้ตรงไหน
  const [hue, setHue] = useState(HUE_DEFAULT);
  const custom = hslToHex(hue, 1, 0.5);
  const customPicked = color.toLowerCase() === custom.toLowerCase();

  // ลากแถบสีรุ้งแล้วได้สีนั้นทันที ไม่ต้องกดยืนยันอีกที (โจทย์อยากให้เลือกง่าย)
  function handleHue(e) {
    const h = Number(e.target.value);
    setHue(h);
    onColor(hslToHex(h, 1, 0.5));
  }

  return (
    <div
      className={`toolbar${locked ? " toolbar--locked" : ""}`}
      // aria-disabled บอกโปรแกรมอ่านหน้าจอว่าตอนนี้ใช้ไม่ได้ (ตัวกันการกดจริงคือ CSS pointer-events)
      aria-disabled={locked || undefined}
    >
      {/* ── เครื่องมือ 4 ปุ่ม เรียง 2 คอลัมน์ ── */}
      <div className="toolbar__group toolbar__group--tools" role="group" aria-label="เครื่องมือ">
        <button
          type="button"
          className={`tool${tool === TOOLS.PEN ? " tool--on" : ""}`}
          aria-label="ปากกา"
          aria-pressed={tool === TOOLS.PEN}
          onClick={() => onTool(TOOLS.PEN)}
        >
          ✏️
        </button>
        <button
          type="button"
          className={`tool${tool === TOOLS.ERASER ? " tool--on" : ""}`}
          aria-label="ยางลบ"
          aria-pressed={tool === TOOLS.ERASER}
          onClick={() => onTool(TOOLS.ERASER)}
        >
          🧽
        </button>
        <button
          type="button"
          className={`tool${tool === TOOLS.BUCKET ? " tool--on" : ""}`}
          aria-label="ถังสี"
          aria-pressed={tool === TOOLS.BUCKET}
          onClick={() => onTool(TOOLS.BUCKET)}
        >
          🪣
        </button>
        {/* ล้างจอทำทันที ไม่ใช่โหมด จึงไม่ได้ค้างสถานะกดไว้แบบสามปุ่มบน */}
        <button type="button" className="tool tool--danger" aria-label="ล้างจอ" onClick={onClear}>
          🗑️
        </button>
      </div>

      {/* ── สีสำเร็จรูป 8 สี ── */}
      <div className="toolbar__group toolbar__group--colors" role="group" aria-label="สี">
        {PAINT_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            className={`swatch${color === c.hex ? " swatch--on" : ""}`}
            style={{ background: c.hex }}
            aria-label={`สี${c.name}`}
            aria-pressed={color === c.hex}
            onClick={() => onColor(c.hex)}
          />
        ))}
      </div>

      {/* ── เลือกสีเองด้วยแถบสีรุ้ง ──
          เดิมใช้วงล้อสีของเบราว์เซอร์ (input[type=color]) ซึ่งเปิดเป็นหน้าต่างใหญ่ ต้องกดหลายที
          แถบนี้กดหรือลากตรงไหนก็ได้สีตรงนั้นทันที จึงเลือกสีผสมเองได้ง่ายกว่ามาก */}
      <div className="toolbar__group toolbar__group--hue">
        <span className="toolbar__label">สีเอง</span>
        <input
          type="range"
          className="rainbow"
          style={{ background: RAINBOW_GRADIENT }} // ไล่สีทั้งแถบ ตั้งจาก palette.js (สีทั้งหมดอยู่ในไฟล์นั้นไฟล์เดียว)
          min={HUE_MIN}
          max={HUE_MAX}
          value={hue}
          aria-label="เลือกสีเองจากแถบสีรุ้ง"
          onChange={handleHue}
        />
        {/* ตัวอย่างสีที่เลือกเอง — กดเพื่อกลับมาใช้สีนี้ หลังเผลอไปกดสีอื่น */}
        <button
          type="button"
          className={`swatch${customPicked ? " swatch--on" : ""}`}
          style={{ background: custom }}
          aria-label="ใช้สีที่เลือกเอง"
          aria-pressed={customPicked}
          onClick={() => onColor(custom)}
        />
      </div>

      {/* ── ขนาดแปรง 2–40 ── */}
      <div className="toolbar__group toolbar__group--size">
        <span className="toolbar__label">ขนาด</span>
        <input
          type="range"
          className="toolbar__range"
          min={SIZE_MIN}
          max={SIZE_MAX}
          value={size}
          aria-label="ขนาดแปรง"
          onChange={(e) => onSize(Number(e.target.value))}
        />
        <span className="toolbar__size-value">{size}</span>
      </div>

      {/* ── ปุ่มย้อนกลับ / ทำซ้ำ (ข้อ 4) ──
          ทั้งคู่เป็นปุ่ม "สั่ง" ไม่ใช่โหมด จึงไม่ค้างสถานะกดไว้แบบปุ่มเครื่องมือ
          กดไม่ได้เมื่อไม่มีอะไรให้ย้อน/ทำซ้ำ (server เป็นคนบอกว่าเหลืออะไรบ้าง)
          ดูคีย์ลัด ⌘Z / ⌘⇧Z ได้ที่ screens/Game.jsx */}
      <div className="toolbar__group toolbar__group--history" role="group" aria-label="ย้อนกลับและทำซ้ำ">
        <button
          type="button"
          className="tool"
          aria-label="ย้อนกลับ"
          title="ย้อนกลับ (⌘Z)"
          disabled={locked || !canUndo}
          onClick={onUndo}
        >
          ↶
        </button>
        <button
          type="button"
          className="tool"
          aria-label="ทำซ้ำ"
          title="ทำซ้ำ (⌘⇧Z)"
          disabled={locked || !canRedo}
          onClick={onRedo}
        >
          ↷
        </button>
      </div>
    </div>
  );
}
