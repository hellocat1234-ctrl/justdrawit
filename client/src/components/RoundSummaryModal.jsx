import Modal from "./Modal";
import Mascot from "./Mascot";

// สรุปจบตา — เฉลยคำ + คะแนนที่แต่ละคนได้ในตานี้
// results จาก server มีแค่ { playerId, gained } ต้องไปหาชื่อจากรายชื่อผู้เล่นเอง
export default function RoundSummaryModal({ summary, players }) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? "?";
  const gains = summary.results ?? [];

  return (
    <Modal labelledBy="round-end-title">
      {/* ไม่มีใครทายถูก = มาสคอตตกใจ · มีคนทายถูก = ดีใจ */}
      <Mascot mood={gains.length === 0 ? "shock" : "happy"} className="mascot--modal" />
      <h2 className="modal__title" id="round-end-title">
        เฉลยคำตอบ
      </h2>
      <p className="answer">{summary.word}</p>

      {gains.length === 0 ? (
        <p className="modal__note">ตานี้ไม่มีใครทายถูก</p>
      ) : (
        <ul className="gains">
          {gains.map((g) => (
            <li className="gains__row" key={g.playerId}>
              <span>{nameOf(g.playerId)}</span>
              <span className="gains__value">+{g.gained}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="modal__note">ตาต่อไปกำลังจะเริ่ม...</p>
    </Modal>
  );
}
