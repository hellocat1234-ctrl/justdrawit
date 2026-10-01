// แถบเวลาใต้กระดาน วิ่งลดลงตามเวลาที่เหลือ (ใช้ทั้งเกมปกติและ Solo)
// timeLeft/total มาจาก server (round_start.time กับ timer) แถบเป็นแค่ตัวแสดงผล
// เหลือ ≤ 10 วิ = เปลี่ยนเป็นสีแดง (เกณฑ์เดียวกับตัวเลขจับเวลา Timer)
// ยังไม่รู้เวลา (null) ก็ยังโชว์ราง เพื่อให้ที่ใต้กระดานไม่ขยับตอนเริ่มตา
export default function TimeBar({ timeLeft = null, total = null }) {
  const known = timeLeft !== null && total > 0;
  const ratio = known ? Math.max(0, Math.min(1, timeLeft / total)) : 0;
  const urgent = known && timeLeft <= 10;
  return (
    <div
      className="timebar"
      role="progressbar"
      aria-label="เวลาที่เหลือ"
      aria-valuemin={0}
      aria-valuemax={known ? total : 0}
      aria-valuenow={known ? timeLeft : 0}
    >
      <div className={`timebar__fill${urgent ? " timebar__fill--urgent" : ""}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
