// ป้าย Mini Challenge เหนือกระดาน
// ตอนนี้ server ส่ง challenge.type มาเป็น "none" เสมอ (Mini Challenge เป็นงานข้อ 5)
// เขียนรองรับไว้เลย พอข้อ 5 ทำเสร็จป้ายจะขึ้นเองโดยไม่ต้องแก้ไฟล์นี้
const CHALLENGES = {
  colour_fix: "🎨 COLOUR FIX วาดได้สีเดียว",
  dont_lift_pen: "✏️ DON'T LIFT PEN ห้ามยกปากกา",
};

export default function ChallengeBanner({ challenge }) {
  const text = CHALLENGES[challenge?.type];
  if (!text) return null;
  return <div className="challenge">{text}</div>;
}
