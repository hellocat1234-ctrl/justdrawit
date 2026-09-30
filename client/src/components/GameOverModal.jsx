import Modal from "./Modal";

const MEDALS = ["🥇", "🥈", "🥉"];

// จบเกม — แท่นรางวัลอันดับ 1-3
// หัวห้องมีปุ่มเล่นอีกรอบ (start_game) ทุกคนมีปุ่มกลับหน้าแรก (leave_room)
export default function GameOverModal({ ranking, isHost, onPlayAgain, onLeave }) {
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  // เรียงให้ที่ 1 อยู่กลาง เวลาตกแต่งด้วย CSS จะได้เหมือนแท่นรางวัลจริง
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <Modal labelledBy="game-over-title">
      <h2 className="modal__title" id="game-over-title">
        จบเกมแล้ว
      </h2>

      <ol className="podium">
        {podiumOrder.map((p) => {
          const place = top3.indexOf(p);
          return (
            <li className={`podium__item podium__item--${place + 1}`} key={p.playerId}>
              <span className="podium__medal">{MEDALS[place]}</span>
              <span className="podium__name">{p.name}</span>
              <span className="podium__score">{p.score}</span>
            </li>
          );
        })}
      </ol>

      {rest.length > 0 && (
        <ul className="gains">
          {rest.map((p, i) => (
            <li className="gains__row" key={p.playerId}>
              <span>
                {i + 4}. {p.name}
              </span>
              <span className="gains__value">{p.score}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="modal__actions">
        {isHost ? (
          <button className="btn btn--primary" type="button" onClick={onPlayAgain}>
            เล่นอีกรอบ
          </button>
        ) : (
          <p className="modal__note">รอหัวห้องกดเล่นอีกรอบ...</p>
        )}
        <button className="btn" type="button" onClick={onLeave}>
          กลับหน้าแรก
        </button>
      </div>
    </Modal>
  );
}
