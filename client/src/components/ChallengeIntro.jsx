import { Icon } from "./Icons";
import Mascot from "./Mascot";
import { CHALLENGE_INFO } from "./ChallengeBanner";

// ป้ายใหญ่กลางกระดานตอนเริ่มตาที่มี Mini Challenge (~2 วินาที ทุกคนเห็นพร้อมกัน)
// อยู่จนกว่า server ส่ง intro_end (ช่วงนี้คนวาดยังวาดไม่ได้ และเวลายังไม่เดิน) แล้วค่อยย่อเหลือแถบเล็กเหนือกระดานเหมือนเดิม
// มาสคอตทำท่าตกใจ + เสียงเตือน (เสียงเล่นที่ Game) · ลดภาพเคลื่อนไหวอยู่ = ยังขึ้นป้ายแต่ไม่มีอนิเมชัน (กฎ data-motion ใน theme.css)
export default function ChallengeIntro({ challenge }) {
  const info = CHALLENGE_INFO[challenge?.type];
  if (!info) return null;
  return (
    <div className="challenge-intro" role="status" aria-live="assertive">
      <div className="challenge-intro__card">
        <div className="challenge-intro__mascot">
          <Mascot mood="shock" />
        </div>
        <p className="challenge-intro__kicker">MINI CHALLENGE!</p>
        <h2 className="challenge-intro__title">
          <Icon name={info.icon} size={44} /> {info.title}
          {challenge.type === "colour_fix" && challenge.color && (
            <span className="challenge-intro__swatch" style={{ background: challenge.color }} aria-label={`สี ${challenge.color}`} />
          )}
        </h2>
        <p className="challenge-intro__desc">{info.desc}</p>
      </div>
    </div>
  );
}
