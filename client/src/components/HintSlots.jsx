// คำใบ้สองแถวตาม DESIGN.md
// slot หนึ่งช่องมาจาก server มีได้ 3 แบบ: { tone: true } { tone: false } { space: true }
//   แถวบน  ขีดเฉพาะช่องที่มีวรรณยุกต์ (tone)
//   แถวล่าง ขีดทุกช่องที่เป็นตัวอักษร
//   ช่องว่าง (space) เว้นว่างทั้งสองแถว เพื่อให้เห็นว่าคำนี้มีสองคำ
export default function HintSlots({ hint = [] }) {
  return (
    <div className="hint" aria-label="คำใบ้">
      <div className="hint__row">
        {hint.map((slot, i) => (
          <span className="hint__slot" key={i}>
            {!slot.space && slot.tone ? "_" : ""}
          </span>
        ))}
      </div>
      <div className="hint__row">
        {hint.map((slot, i) => (
          <span className="hint__slot" key={i}>
            {slot.space ? "" : "_"}
          </span>
        ))}
      </div>
    </div>
  );
}
