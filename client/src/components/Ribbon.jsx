// ป้ายริบบิ้นสไตล์พิกเซลบนหัวหน้า (PLAY · ห้องรอ · SOLO VS AI · LEADERBOARD)
// ปลายสองข้างหยักเป็นรูปตัว V ด้วย clip-path ในธีมสี ไม่มีภาพประกอบ · tone เลือกสีพื้น
export default function Ribbon({ children, tone = "red" }) {
  // ข้อความไทยต้องใช้ฟอนต์ไทย (Silkscreen ไม่มีตัวอักษรไทย)
  const thai = /[\u0E00-\u0E7F]/.test(String(children));
  return (
    <div className={`ribbon ribbon--${tone}${thai ? " ribbon--th" : ""}`}>
      <span className="ribbon__text">{children}</span>
    </div>
  );
}
