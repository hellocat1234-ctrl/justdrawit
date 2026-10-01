import Avatar from "./Avatar";
import AnimatedNumber from "./AnimatedNumber";

// แถบคะแนน — เรียงจากคะแนนมากไปน้อย
// 👑 = หัวห้อง  ✏️ = คนวาดตานี้  ✅ = คนที่ทายถูกแล้ว (พื้นเขียวอ่อน)
//
// ที่มาของ guessed มีสองทาง รวมกันแล้วได้ครบทุกกรณี
//   1) อยู่ในห้องตั้งแต่ต้นตา — สะสมเองจาก event correct_guess (ผูกไว้ใน useGame)
//   2) เข้าห้องกลางตา — server แนบ guessedIds มาให้ใน round_start (ข้อ 4 แก้งานค้างของข้อ 2)
// ทางที่ 2 ส่งมาแค่ id ไม่ส่งคำตอบ จึงไม่ทำให้ใครรู้คำก่อนทายถูก
//
// ป้ายสถานะใต้ชื่อ (ข้อความล้วน ไม่ใช่แค่ไอคอน — อ่านง่ายบนจอเล็ก/ไอแพด)
//   หัวห้อง · กำลังวาด · วาดคนถัดไป
// "กำลังวาด/วาดคนถัดไป" โชว์เฉพาะตอนกำลังวาด (drawing) เพราะระหว่างพักตา drawerId ยังเป็นคนเก่าค้างอยู่
// nextDrawerId มาจาก server (round_start) client เดาไม่ได้ · เช็คว่ายังอยู่ในห้องก่อนโชว์ เพราะอาจออกไประหว่างตา
export default function Scoreboard({ players, drawerId, nextDrawerId = null, drawing = false, guessed = [], meId }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <ul className="score-list">
      {sorted.map((p) => {
        const isDrawer = p.id === drawerId;
        const hasGuessed = guessed.includes(p.id);
        const isNext = drawing && !isDrawer && nextDrawerId === p.id;
        const tags = [];
        if (p.isHost) tags.push(["host", "👑 หัวห้อง"]);
        if (drawing && isDrawer) tags.push(["drawing", "✏️ กำลังวาด"]);
        if (isNext) tags.push(["next", "⏭ วาดคนถัดไป"]);
        const classes = ["score-row"];
        if (isDrawer) classes.push("score-row--drawer");
        if (hasGuessed) classes.push("score-row--guessed");
        if (p.id === meId) classes.push("score-row--me");

        return (
          <li className={classes.join(" ")} key={p.id}>
            <Avatar index={p.avatar} />
            <span className="score-row__main">
              <span className="score-row__name">{p.name}</span>
              {tags.length > 0 && (
                <span className="score-row__tags">
                  {tags.map(([kind, text]) => (
                    <span className={`tag tag--${kind}`} key={kind}>
                      {text}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className="score-row__icons">{hasGuessed && <span title="ทายถูกแล้ว">✅</span>}</span>
            <span className="score-row__score">
              <AnimatedNumber value={p.score} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
