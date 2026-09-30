// ตัวจับเวลา เม็ดยาสีแดง ตัวเลข Silkscreen รูปแบบ 01:00
// timeLeft เป็น null แปลว่ายังไม่รู้เวลา (ยังไม่เริ่มวาด) ให้โชว์ --:--
function formatTime(seconds) {
  const s = Math.max(0, seconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function Timer({ timeLeft = null }) {
  const urgent = timeLeft !== null && timeLeft <= 10;
  return (
    <div className={`timer${urgent ? " timer--urgent" : ""}`} aria-label="เวลาที่เหลือ">
      {timeLeft === null ? "--:--" : formatTime(timeLeft)}
    </div>
  );
}
