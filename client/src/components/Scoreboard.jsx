import Avatar from "./Avatar";

// แถบคะแนน — เรียงจากคะแนนมากไปน้อย
// 👑 = หัวห้อง  ✏️ = คนวาดตานี้  ✅ = คนที่ทายถูกแล้ว (พื้นเขียวอ่อน)
//
// หมายเหตุ: server ไม่ได้บอกมาใน room_update ว่าใครทายถูกแล้ว (roomState ไม่มีช่องนั้น)
// เลยต้องสะสมเอาเองจาก event correct_guess ที่ผูกไว้ใน useGame
// ผลคือคนที่เข้าห้องกลางตาจะไม่เห็น ✅ ของคนที่ทายถูกไปก่อนหน้า — บอกผู้ใช้แล้ว
export default function Scoreboard({ players, drawerId, guessed = [], meId }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <ul className="score-list">
      {sorted.map((p) => {
        const isDrawer = p.id === drawerId;
        const hasGuessed = guessed.includes(p.id);
        const classes = ["score-row"];
        if (isDrawer) classes.push("score-row--drawer");
        if (hasGuessed) classes.push("score-row--guessed");
        if (p.id === meId) classes.push("score-row--me");

        return (
          <li className={classes.join(" ")} key={p.id}>
            <Avatar index={p.avatar} />
            <span className="score-row__name">{p.name}</span>
            <span className="score-row__icons">
              {p.isHost && <span title="หัวห้อง">👑</span>}
              {isDrawer && <span title="กำลังวาด">✏️</span>}
              {hasGuessed && <span title="ทายถูกแล้ว">✅</span>}
            </span>
            <span className="score-row__score">{p.score}</span>
          </li>
        );
      })}
    </ul>
  );
}
