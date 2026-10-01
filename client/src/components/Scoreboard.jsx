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
//
// โหมดทีม (teamScores มีค่า): จัดกลุ่มตามทีม A / B หัวกลุ่มบอกคะแนนทีม (ผลรวมสมาชิก) · ในทีมเรียงตามคะแนนเหมือนเดิม
// หมายเหตุ: ใน round_start ของโหมดทีม drawerId/nextDrawerId เป็นของ "ทีมเรา" เท่านั้น
//   ป้าย ✏️ ของทีมอื่นจึงอาศัย drawerIds (คนวาดของทั้งสองทีม) ซึ่ง server ส่งมาให้
export default function Scoreboard({
  players,
  drawerId,
  drawerIds = null,
  nextDrawerId = null,
  drawing = false,
  guessed = [],
  meId,
  teamScores = null,
  myTeam = null,
}) {
  const byScore = (list) => [...list].sort((a, b) => b.score - a.score);
  const drawerSet = new Set([drawerId, ...(drawerIds ? Object.values(drawerIds) : [])].filter(Boolean));

  if (teamScores) {
    return (
      <div className="score-teams">
        {["A", "B"].map((t) => (
          <section className={`score-team score-team--${t}`} key={t} aria-label={`ทีม ${t}`}>
            <h3 className="score-team__head">
              <span>
                ทีม {t}
                {myTeam === t ? " (ทีมคุณ)" : ""}
              </span>
              <span className="score-team__total">
                <AnimatedNumber value={teamScores[t] ?? 0} />
              </span>
            </h3>
            {renderList(byScore(players.filter((p) => p.team === t)))}
          </section>
        ))}
      </div>
    );
  }
  return renderList(byScore(players));

  function renderList(sorted) {
  return (
    <ul className="score-list">
      {sorted.map((p) => {
        const isDrawer = drawerSet.has(p.id);
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
}
