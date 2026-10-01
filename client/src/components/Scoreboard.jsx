import Avatar from "./Avatar";

// แถบคะแนน — เรียงจากคะแนนมากไปน้อย
// 👑 = หัวห้อง  ✏️ = คนวาดตานี้  ✅ = คนที่ทายถูกแล้ว (พื้นเขียวอ่อน)
//
// ที่มาของ guessed มีสองทาง รวมกันแล้วได้ครบทุกกรณี
//   1) อยู่ในห้องตั้งแต่ต้นตา — สะสมเองจาก event correct_guess (ผูกไว้ใน useGame)
//   2) เข้าห้องกลางตา — server แนบ guessedIds มาให้ใน round_start (ข้อ 4 แก้งานค้างของข้อ 2)
// ทางที่ 2 ส่งมาแค่ id ไม่ส่งคำตอบ จึงไม่ทำให้ใครรู้คำก่อนทายถูก
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
