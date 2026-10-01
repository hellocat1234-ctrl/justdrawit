import { useEffect, useRef } from "react";
import Modal from "./Modal";
import TeamRules from "./TeamRules";
import { useReduceMotion, useSoundMuted } from "../hooks/usePrefs";

// รูปประตูพิกเซลของเราเอง (วาดจากสี่เหลี่ยมล้วน เหมือนมาสคอต) ใช้ในกล่องยืนยันออก
// ตารางกว้าง 12 สูง 14 · crispEdges ให้ขอบคม ไม่เบลอเมื่อขยาย
export function DoorArt({ className = "" }) {
  return (
    <svg
      className={`door ${className}`.trim()}
      viewBox="0 0 12 14"
      shapeRendering="crispEdges"
      role="img"
      aria-label="ประตู"
    >
      <rect x="0" y="0" width="12" height="14" fill="#2b2b2b" />
      <rect x="1" y="1" width="10" height="12" fill="#e8553f" />
      <rect x="2" y="2" width="8" height="5" fill="#c9402c" />
      <rect x="2" y="8" width="8" height="5" fill="#c9402c" />
      <rect x="3" y="3" width="6" height="3" fill="#f07a66" />
      <rect x="3" y="9" width="6" height="3" fill="#f07a66" />
      <rect x="8" y="7" width="2" height="2" fill="#ffc81e" />
      <rect x="8" y="7" width="1" height="1" fill="#fbf6e6" />
      <rect x="0" y="13" width="12" height="1" fill="#2b2b2b" />
    </svg>
  );
}

// ปิดกล่องด้วยปุ่ม Esc (คีย์บอร์ดคอม) — ไอแพดใช้ปุ่มในกล่องแทน
function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

// ── กล่องกติกาสั้นๆ + ตัวเลือกเสียง/ลดภาพเคลื่อนไหว ──
export function InfoModal({ onClose, teamMode = false }) {
  const [muted, setMuted] = useSoundMuted();
  const [reduce, setReduce] = useReduceMotion();
  useEscape(onClose);

  return (
    <Modal labelledBy="info-title">
      <h2 className="modal__title" id="info-title">
        กติกาการวาด
      </h2>
      <ul className="rules-list">
        <li>
          <b>ห้ามเขียนตัวหนังสือ ตัวเลข หรือสัญลักษณ์</b> ลงบนภาพ ต้องวาดเป็นรูปเท่านั้น
        </li>
        <li>คนทายพิมพ์คำตอบในช่อง “คำตอบ” ทายถูกเร็วได้คะแนนเยอะ</li>
        <li>บางตามี Mini Challenge พิเศษ ดูป้ายสีม่วงเหนือกระดาน</li>
      </ul>

      {teamMode && (
        <>
          <h3 className="modal__subtitle">โหมดทีม A vs B</h3>
          <TeamRules />
        </>
      )}

      <div className="info-settings">
        <label className="check">
          <input type="checkbox" checked={!muted} onChange={(e) => setMuted(!e.target.checked)} />
          <span>เปิดเสียงเอฟเฟกต์</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={reduce} onChange={(e) => setReduce(e.target.checked)} />
          <span>ลดภาพเคลื่อนไหว</span>
        </label>
      </div>

      <div className="modal__actions">
        <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
          เข้าใจแล้ว
        </button>
      </div>
    </Modal>
  );
}

// ── กล่องยืนยันออก — ปุ่ม "ไม่" ได้โฟกัสก่อน กดเบิ้ลพลาดแล้วไม่หลุดออกจากเกม ──
export function ExitModal({ onYes, onNo, note }) {
  const noRef = useRef(null);
  useEscape(onNo);
  useEffect(() => noRef.current?.focus(), []);

  return (
    <Modal labelledBy="exit-title">
      <DoorArt className="door--modal" />
      <h2 className="modal__title" id="exit-title">
        ออกจากเกมจริงไหม
      </h2>
      {note && <p className="modal__note">{note}</p>}
      <div className="modal__actions modal__actions--row">
        <button type="button" className="btn btn--primary" ref={noRef} onClick={onNo}>
          ไม่
        </button>
        <button type="button" className="btn btn--danger" onClick={onYes}>
          ใช่
        </button>
      </div>
    </Modal>
  );
}

// ── ไอคอนสามปุ่มบนแถบบน: 🔊 ℹ️ ออก (สูง ≥44px ให้นิ้วแตะบนไอแพดได้) ──
export function TopIcons({ onInfo, onExit }) {
  const [muted, setMuted] = useSoundMuted();
  return (
    <div className="top-icons">
      <button
        type="button"
        className="icon-btn"
        onClick={() => setMuted(!muted)}
        aria-pressed={!muted}
        aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}
        title={muted ? "เปิดเสียง" : "ปิดเสียง"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <button type="button" className="icon-btn" onClick={onInfo} aria-label="กติกา" title="กติกา">
        ℹ️
      </button>
      <button type="button" className="icon-btn icon-btn--exit" onClick={onExit} title="ออกจากเกม">
        <DoorArt className="door--icon" />
        <span>ออก</span>
      </button>
    </div>
  );
}
