import Modal from "./Modal";

// หน้าต่างเลือกคำ — เห็นเฉพาะคนวาด (server ส่ง choose_word มาหาคนเดียว)
// ปุ่มคำ 3 ปุ่ม + นับถอยหลัง 10 วิ ถ้าหมดเวลากดไม่ทัน server จะเลือกคำแรกให้เอง
export default function WordChoiceModal({ options, secondsLeft, onChoose }) {
  return (
    <Modal labelledBy="choose-word-title">
      <h2 className="modal__title" id="choose-word-title">
        เลือกคำที่จะวาด
      </h2>
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
