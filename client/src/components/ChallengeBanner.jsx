// ป้าย Mini Challenge เหนือกระดาน (ข้อ 5)
// แถบสีม่วง ตัวหนังสือขาว ถอดความจาก events.md หัวข้อ 5 ตรง ๆ
//
// ป้ายนี้ขึ้นกับ "challenge ของตานี้" ที่ server ส่งมากับ round_start เท่านั้น
// type "none" (หรือไม่มีก้อนมาเลย) = ไม่มีป้าย ไม่ต้องแสดงอะไร
// คนที่เข้าห้องกลางตาก็ได้ challenge ชุดเดียวกัน เพราะ server ส่ง round_start ให้เขาใหม่พร้อมค่านั้น
const CHALLENGES = {
  colour_fix: "🎨 COLOUR FIX วาดได้สีเดียว",
  dont_lift_pen: "✏️ DON'T LIFT PEN ห้ามยกปากกา",
};

export default function ChallengeBanner({ challenge }) {
  const text = CHALLENGES[challenge?.type];
  if (!text) return null;
  return (
    <div className="challenge">
      {text}
      {/* colour_fix โชว์ตัวอย่างสีที่ล็อกไว้ด้วย เพราะ "วาดได้สีเดียว" ไม่ได้บอกว่าสีอะไร
          ถ้าไม่โชว์ ผู้เล่นต้องเดาเองว่าสีที่ใช้ได้คือสีไหน (client ที่ไม่โชว์ = ผู้เล่นกดผิดแล้วงงว่าทำไมไม่ขึ้น)
          สีมาจาก server เท่านั้น ห้ามให้ client สุ่มหรือเดาเอง */}
      {challenge.type === "colour_fix" && challenge.color && (
        <span
          className="challenge__swatch"
          style={{ background: challenge.color }}
          title={`สีที่ใช้ได้ตานี้: ${challenge.color}`}
          aria-label={`สีที่ใช้ได้ตานี้ ${challenge.color}`}
        />
      )}
    </div>
  );
}
