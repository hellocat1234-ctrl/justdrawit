import Modal from "./Modal";
import { Icon } from "./Icons";
import { CHALLENGE_INFO } from "./ChallengeBanner";

// หน้าต่างเลือกคำ — เห็นเฉพาะคนวาด (server ส่ง choose_word มาหาคนเดียว)
// ปุ่มคำ 3 ปุ่ม + นับถอยหลัง 10 วิ ถ้าหมดเวลากดไม่ทัน server จะเลือกคำแรกให้เอง
export default function WordChoiceModal({ options, secondsLeft, onChoose, challenge = null }) {
  // คนวาดรู้ก่อนเลือกคำว่าตานี้มี Mini Challenge อะไร (server ส่งมากับ choose_word)
  const info = CHALLENGE_INFO[challenge?.type];
  return (
    <Modal labelledBy="choose-word-title">
      <h2 className="modal__title" id="choose-word-title">
        เลือกคำที่จะวาด
      </h2>
      {info && (
        <div className="choose-challenge" role="note">
          <Icon name={info.icon} size={26} />
          <span>
            <b>ตานี้มี Mini Challenge: {info.title}</b>
            <small>{info.desc}</small>
          </span>
          {challenge.type === "colour_fix" && challenge.color && (
            <span className="challenge__swatch" style={{ background: challenge.color }} aria-label={`สี ${challenge.color}`} />
          )}
        </div>
      )}
      <p className="modal__note">
        เหลือเวลา <span className="modal__count">{secondsLeft}</span> วินาที
      </p>
      <div className="word-choices">
        {options.map((word) => (
          <button className="btn btn--word" key={word} type="button" onClick={() => onChoose(word)}>
            {word}
          </button>
        ))}
      </div>
    </Modal>
  );
}
