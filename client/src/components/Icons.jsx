// ชุดไอคอนพิกเซลของเราเอง — ที่เดียวที่เก็บรูปทั้งหมด ทุกหน้าเรียกผ่าน <Icon name="..."/> หรือ <AvatarArt index={n}/>
// วิธีวาด: แต่ละรูปคือตารางตัวอักษร 1 ตัว = 1 พิกเซล (จุด . = โปร่งใส) แล้วแปลงเป็น <rect> ใน SVG
//   ใช้ shapeRendering="crispEdges" ให้ขอบคมเวลาขยาย · ขอบดำหนา 1 พิกเซลตามธีม
// รูปสมมาตร (อวตาร มงกุฎ หัวใจ ...) เขียนแค่ครึ่งซ้าย แล้วสะท้อนอัตโนมัติ (mirror)

// ตัวอักษร → สี (สีทุกตัวมาจากชุดสีของธีมใน theme.css)
export const PAL = {
  k: "#2b2b2b", // ดำ (ขอบ)
  w: "#ffffff",
  c: "#fbf6e6", // ครีม
  y: "#ffc81e", // เหลือง
  Y: "#ffe27a", // เหลืองอ่อน
  o: "#f08a24", // ส้ม
  O: "#c9622a", // ส้มเข้ม
  r: "#e8553f", // แดง
  R: "#f07a66", // แดงอ่อน
  g: "#22a559", // เขียว
  G: "#7fd39b", // เขียวอ่อน
  b: "#1e6fe8", // น้ำเงิน
  B: "#6fa6f2", // ฟ้า
  p: "#e85c9e", // ชมพู
  P: "#f6a6cc", // ชมพูอ่อน
  t: "#13a3a0", // เขียวน้ำทะเล
  u: "#7b5ce0", // ม่วง
  U: "#a994ee", // ม่วงอ่อน
  n: "#8a5a3c", // น้ำตาล
  N: "#c28a5e", // น้ำตาลอ่อน
  s: "#f5cfa0", // สีเนื้อ
  a: "#b9b4a6", // เทา
  A: "#dcd7c8", // เทาอ่อน
};

// ── อวตาร 6 ตัว 16×16 (ครึ่งซ้าย 8 ช่อง) ──
const AVATAR_ART = [
  {
    name: "แพนด้า",
    rows: [
      ".kkk....",
      "kkkkk...",
      "kkkkkkkk",
      "kkkkwwww",
      ".kwwwwww",
      "kwwwwwww",
      "kwkkkwww",
      "kwkwkwww",
      "kwkkkwww",
      "kwwwwwww",
      "kwwwwwkk",
      "kwwwwwkk",
      ".kwwwwwk",
      ".kwwwwww",
      "..kkwwww",
      "....kkkk",
    ],
  },
  {
    name: "แมว",
    rows: [
      "kk......",
      "kok.....",
      "kook....",
      "koookkkk",
      "kooooooo",
      "kooooooo",
      "kooooooo",
      "kowkoooo",
      "kokkoooo",
      "kooooopp",
      "kooookkp",
      "kooowwkk",
      ".kooowww",
      ".koooooo",
      "..kkoooo",
      "....kkkk",
    ],
  },
  {
    name: "จิ้งจอก",
    rows: [
      "kk......",
      "kkk.....",
      "kokk....",
      "kookkkkk",
      "kooooooo",
      "kooooooo",
      "kowkoooo",
      "kokkoooo",
      "kooooooo",
      "kowoooww",
      "kwwwwwww",
      ".kwwwwww",
      ".kwwwwkk",
      "..kwwwkk",
      "...kkwww",
      ".....kkk",
    ],
  },
  {
    name: "กบ",
    rows: [
      "..kkkk..",
      ".kwwwwk.",
      "kwwkkwwk",
      "kwkkkwwk",
      "kggkkggg",
      "kggggggg",
      "kggggggg",
      "kggggggg",
      "kggggggg",
      "kgkgggkg",
      "kggkkkkk",
      "kgggggGG",
      ".kggggGG",
      ".kgggggg",
      "..kkgggg",
      "....kkkk",
    ],
  },
  {
    name: "ลิง",
    rows: [
      "..kkkk..",
      ".knnnnnk",
      "kssknnnn",
      "kssknnnn",
      "kssnnnnn",
      ".knnkkkk",
      ".knsssss",
      ".knsksss",
      ".knsssss",
      ".knssssk",
      ".knsssnn",
      ".knssssk",
      "..knnsss",
      "..knnnnn",
      "...kknnn",
      ".....kkk",
    ],
  },
  {
    name: "ปลาหมึก",
    rows: [
      "....kkkk",
      "..kkuuuu",
      ".kuuuuuU",
      ".kuuuuUU",
      "kuuuuuuu",
      "kuuwwuuu",
      "kuuwkwuu",
      "kuuwwuuu",
      "kuuuuuuu",
      "kuuuuuuu",
      "kukuukuu",
      "kukuukuu",
      "kuk.kuuk",
      ".kk.kuk.",
      "....kk..",
      "........",
    ],
  },
];

// ── ไอคอนทั่วไป ──
// size = ขนาดตารางจริง · mirror = เขียนแค่ครึ่งซ้าย
const ART = {
  arrowL: [
    ".....kk.",
    "....kkk.",
    "...kkkk.",
    "..kkkkk.",
    ".kkkkkk.",
    "kkkkkkk.",
    ".kkkkkk.",
    "..kkkkk.",
    "...kkkk.",
    "....kkk.",
    ".....kk.",
  ],
  // ภาพบ้านเล็กๆ ใช้เป็นภาพวาดในการ์ดโหมดแข่งเดี่ยว
  house: [
    "......kk......",
    ".....krrk.....",
    "....krrrrk....",
    "...krrrrrrk...",
    "..krrrrrrrrk..",
    ".kkkkkkkkkkkk.",
    "..kYYYYYYYYk..",
    "..kYnnYYYbbk..",
    "..kYnnYYYbbk..",
    "..kYnnYYYbbk..",
    "..kkkkkkkkkk..",
  ],
  users: [
    ".kkkk....kkkk.",
    "kbbbbk..kooook",
    "kbbbbk..kooook",
    ".kkkk....kkkk.",
    "kbbbbbkkoooook",
    "kbbbbbkkoooook",
    "kkkkkkkkkkkkkk",
  ],
  music: [
    "........kkkk",
    "........kwwk",
    "........kk.k",
    "........kk..",
    "........kk..",
    "........kk..",
    "...kkkk.kk..",
    "..kwwwwkkk..",
    "..kwwwwwk...",
    "...kkkkk....",
  ],
  share: [
    ".....kk.....",
    "....kwwk....",
    "...kwwwwk...",
    "..kkkwwkkk..",
    "....kwwk....",
    "....kwwk....",
    "k...kwwk...k",
    "k...kkkk...k",
    "k..........k",
    "k..........k",
    "kkkkkkkkkkkk",
  ],
  clock: [
    "...kkkkkk...",
    "..kwwwwwwk..",
    ".kwwwwkwwwk.",
    "kwwwwwkwwwwk",
    "kwwwwwkwwwwk",
    "kwwwwwkkkkwk",
    "kwwwwwwwwwwk",
    "kwwwwwwwwwwk",
    ".kwwwwwwwwk.",
    "..kwwwwwwk..",
    "...kkkkkk...",
  ],
  question: [
    "...kkkkkk...",
    "..kbbbbbbk..",
    ".kbbbbbbbbk.",
    "kbbbwwwwbbbk",
    "kbbbwbbwbbbk",
    "kbbbbbbwbbbk",
    "kbbbbwwbbbbk",
    "kbbbbwbbbbbk",
    "kbbbbbbbbbbk",
    ".kbbbwbbbbk.",
    "..kbbbbbbk..",
    "...kkkkkk...",
  ],
  // เครื่องมือ (12×12)
  pen: [
    ".........kkk",
    "........kppp",
    ".......kpppk",
    "......kaaak.",
    ".....kyyyk..",
    "....kyyyk...",
    "...kyyyk....",
    "..kyyyk.....",
    ".ksssk......",
    "ksskk.......",
    "kkk.........",
    "k...........",
  ],
  eraser: [
    "............",
    "............",
    "......kkkkk.",
    ".....kBBBBBk",
    "....kBBBBBk.",
    "...kBBBBBk..",
    "..kBBBBBk...",
    ".kwwwwwk....",
    "kwwwwwk.....",
    "wwwwwk......",
    "wwwwk.......",
    "kkkk........",
  ],
  // ถังสี: ถังเอียงน้ำสีหยดลงด้านข้าง (หยดสีแดงให้อ่านออกแม้ตัวเล็ก)
  bucket: [
    "..kkkkkk....",
    ".kRRRRRRkk..",
    "kkrrrrrrrrk.",
    "k.kkkkkkkkrk",
    "k.kBBBBBBkrk",
    "k.kBwBBBBkrk",
    ".kkBwBBBBkkk",
    "..kBBBBBBk.r",
    "...kBBBBBk.r",
    "...kBBBBBk..",
    "....kkkkkk..",
    "............",
  ],
  // เครื่องมือรูปทรง: เส้นตรง สี่เหลี่ยม วงกลม
  "shape-line": [
    "............",
    "..........kk",
    ".........kkk",
    "........kkk.",
    ".......kkk..",
    "......kkk...",
    ".....kkk....",
    "....kkk.....",
    "...kkk......",
    "..kkk.......",
    "kkkk........",
    "kk..........",
  ],
  "shape-rect": [
    "............",
    "............",
    ".kkkkkkkkkk.",
    ".kBBBBBBBBk.",
    ".kBBBBBBBBk.",
    ".kBBBBBBBBk.",
    ".kBBBBBBBBk.",
    ".kBBBBBBBBk.",
    ".kBBBBBBBBk.",
    ".kkkkkkkkkk.",
    "............",
    "............",
  ],
  "shape-circle": [
    "............",
    "....kkkk....",
    "..kkBBBBkk..",
    ".kBBBBBBBBk.",
    ".kBBBBBBBBk.",
    "kBBBBBBBBBBk",
    "kBBBBBBBBBBk",
    ".kBBBBBBBBk.",
    ".kBBBBBBBBk.",
    "..kkBBBBkk..",
    "....kkkk....",
    "............",
  ],
  trash: [
    "....kkkk....",
    "..kkkkkkkk..",
    "kkkkkkkkkkkk",
    "..kaaaaaak..",
    "..kawakwak..",
    "..kawakwak..",
    "..kawakwak..",
    "..kawakwak..",
    "..kawakwak..",
    "..kaaaaaak..",
    "..kkkkkkkk..",
    "............",
  ],
  undo: [
    "............",
    "...k........",
    "..kk........",
    ".kkkkkkkk...",
    "kkkkkkkkkk..",
    ".kk.....kkk.",
    "..k......kk.",
    "..........k.",
    "..........k.",
    ".........kk.",
    "...kkkkkkk..",
    "............",
  ],
  redo: [
    "............",
    "........k...",
    "........kk..",
    "...kkkkkkkk.",
    "..kkkkkkkkkk",
    ".kkk.....kk.",
    ".kk......k..",
    "k...........",
    ".k..........",
    ".kk.........",
    "..kkkkkkk...",
    "............",
  ],
  // แถบบน (12×12)
  sound: [
    "............",
    "....k.......",
    "...kk...k...",
    "kkkkk....k..",
    "kwwkk.k..k..",
    "kwwkk..k.k..",
    "kwwkk..k.k..",
    "kwwkk.k..k..",
    "kkkkk....k..",
    "...kk...k...",
    "....k.......",
    "............",
  ],
  mute: [
    "............",
    "....k.......",
    "...kk.......",
    "kkkkk.k...k.",
    "kwwkk..k.k..",
    "kwwkk...k...",
    "kwwkk...k...",
    "kwwkk..k.k..",
    "kkkkk.k...k.",
    "...kk.......",
    "....k.......",
    "............",
  ],
  // สัญลักษณ์ทั่วไป
  heartBroken: [
    "..kkk.kkk..",
    ".krrrkrrrk.",
    "krRRrkrrrrk",
    "krRrrkrrrrk",
    "krrrkrrrrrk",
    ".krrrkrrrk.",
    "..krrkrrk..",
    "...krkrk...",
    "....kkk....",
    ".....k.....",
  ],
  check: [
    "..........kk",
    ".........kgk",
    "........kggk",
    "kk.....kgGk.",
    "kgk...kggk..",
    "kggk.kgGk...",
    ".kggkggk....",
    "..kggggk....",
    "...kgGk.....",
    "....kk......",
  ],
  flag: [
    "kkkkkkkk....",
    "krrrrrrrkk..",
    "krRRrrrrrrk.",
    "krrrrrrrrk..",
    "krrrrrrkk...",
    "kkkkkkk.....",
    "kk..........",
    "k...........",
    "k...........",
    "kk..........",
  ],
  skip: [
    "kk......kk..",
    "kkk.....kk..",
    "kkkk....kk..",
    "kkkkk...kk..",
    "kkkk....kk..",
    "kkk.....kk..",
    "kk......kk..",
  ],
  palette: [
    "...kkkkkkk..",
    ".kkcccccccck",
    "kcccrrcccccc",
    "kccrrrccbbck",
    "kccccccbbbck",
    "kcgggcccbbck",
    "kcggggccccck",
    "kcccggccykck",
    ".kcccccckkyk",
    "..kkkkkkkkk.",
  ],
  hourglass: [
    "kkkkkkkkkk",
    "kYYYYYYYYk",
    ".kYYYYYYk.",
    "..kYYYYk..",
    "...kkkk...",
    "...kyyk...",
    "..kyyyyk..",
    ".kyyyyyyk.",
    "kyyyyyyyyk",
    "kkkkkkkkkk",
  ],
};

// เหรียญ 1–3 (14×17) — สร้างจากโค้ด: ริบบิ้นสองแถบ + วงกลม + ตัวเลขฟอนต์พิกเซล 3×5
const DIGITS = {
  1: [".#.", "##.", ".#.", ".#.", "###"],
  2: ["###", "..#", "###", "#..", "###"],
  3: ["###", "..#", "###", "..#", "###"],
};
function medalRows(n, face, dark) {
  const g = Array.from({ length: 17 }, () => Array(14).fill("."));
  for (let y = 0; y < 4; y++) "...kbbkkrrk...".split("").forEach((ch, x) => (g[y][x] = ch));
  const inside = (x, y) => (x - 6.5) ** 2 + (y - 10) ** 2 <= 6.3 ** 2;
  for (let y = 4; y < 17; y++) {
    for (let x = 0; x < 14; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      g[y][x] = edge ? "k" : face;
    }
  }
  DIGITS[n].forEach((row, dy) =>
    row.split("").forEach((ch, dx) => {
      if (ch === "#") g[8 + dy][6 + dx - 1] = dark;
    }),
  );
  return g.map((r) => r.join(""));
}

// รวมช่องสีเดียวกันติดกันในแถวเดียวกันเป็น <rect> เดียว
export function toRects(rows, mirror) {
  const full = mirror ? rows.map((r) => r + [...r].reverse().join("")) : rows;
  const rects = [];
  full.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== "." && PAL[ch]) rects.push({ x, y, w: end - x, fill: PAL[ch] });
      x = end;
    }
  });
  return { rects, w: full[0].length, h: full.length };
}

function Pix({ rows, mirror = false, size = 20, className = "", label }) {
  const { rects, w, h } = toRects(rows, mirror);
  return (
    <svg
      className={`pix ${className}`.trim()}
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={Math.round((size * h) / w)}
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />
      ))}
    </svg>
  );
}

// ครึ่งซ้ายของรูปสมมาตร (เขียนสั้นๆ ที่เดียว)
const HALF = {
  trophy: [
    "kkkkkkk",
    "kkyyyyy",
    "k.kyYyy",
    "k.kyYyy",
    "kkkyyyy",
    ".kkyyyy",
    "...kyyy",
    "....kyy",
    ".....ky",
    ".....ky",
    "....kky",
    "...kkkk",
    "...koooo",
    "...kkkk",
  ],
  heart: [
    "..kkk.k",
    ".krrrkr",
    "krRRrrr",
    "krRrrrr",
    "krrrrrr",
    ".krrrrr",
    "..krrrr",
    "...krrr",
    "....krr",
    ".....kr",
    "......k",
  ],
  heartOff: [
    "..kkk.k",
    ".kaaaka",
    "kaAAaaa",
    "kaAaaaa",
    "kaaaaaa",
    ".kaaaaa",
    "..kaaaa",
    "...kaaa",
    "....kaa",
    ".....ka",
    "......k",
  ],
  crown: [
    "k.....",
    "kk....",
    "kyk...",
    "kyyk.k",
    "kyyykk",
    "kyyyyy",
    "kyrYyy",
    "kyyyyy",
    "kkkkkk",
  ],
  robot: [
    ".....k",
    ".....r",
    "..kkkk",
    ".kBBBB",
    "kkBwkB",
    "kBBkkB",
    "kkBBBB",
    ".kBkkk",
    ".kBBBB",
    "..kkkk",
  ],
  door: [
    "..kkkk",
    ".krrrr",
    ".krRRR",
    ".krRRR",
    ".krrrr",
    ".krRRR",
    ".krRRR",
    ".krRRR",
    ".krrrr",
    "kkkkkk",
  ],
  info: [
    "....kk",
    "..kkbb",
    ".kbbbw",
    ".kbbbw",
    "kbbbbb",
    "kbbbww",
    "kbbbbw",
    "kbbbbw",
    ".kbbbw",
    ".kbbww",
    "..kkbb",
    "....kk",
  ],
  star: [
    ".....k",
    ".....k",
    "....ky",
    "kkkkky",
    "kyyyyy",
    ".kyyyy",
    "..kyyy",
    "..kyyy",
    ".kyyyk",
    ".kkkk.",
  ],
  bulb: [
    "...kkk",
    "..kyyy",
    ".kyYYy",
    ".kyYyy",
    ".kyyyy",
    ".kyyyy",
    "..kyyy",
    "...kyy",
    "...kaa",
    "...kkk",
    "....ka",
    ".....k",
  ],
  x: [
    "kk...",
    "krk..",
    ".krk.",
    "..krk",
    "...kr",
    "...kr",
    "..krk",
    ".krk.",
    "krk..",
    "kk...",
  ],
};

// รายชื่อไอคอนที่ใช้ได้ (ใช้ตรวจตอนเขียนโค้ด)
export const ICON_NAMES = [...new Set([...Object.keys(ART), ...Object.keys(HALF), "medal1", "medal2", "medal3"])];

// <Icon name="trophy" size={20} /> — size คือความกว้างเป็นพิกเซลหน้าจอ
// label ใส่เมื่อไอคอนสื่อความหมายเองโดยไม่มีข้อความอยู่ข้างๆ (ไม่ใส่ = ซ่อนจากโปรแกรมอ่านหน้าจอ)
export function Icon({ name, size = 20, className = "", label }) {
  let rows;
  let mirror = false;
  if (name === "medal1") rows = medalRows(1, "y", "O");
  else if (name === "medal2") rows = medalRows(2, "A", "k");
  else if (name === "medal3") rows = medalRows(3, "N", "k");
  else if (HALF[name]) ({ rows, mirror } = { rows: HALF[name], mirror: true });
  else if (ART[name]) rows = ART[name];
  else if (name === "arrowR") rows = ART.arrowL.map((r) => [...r].reverse().join(""));
  else return null;
  // ทุกแถวต้องกว้างเท่ากัน (กันพิมพ์พลาดแล้วรูปเบี้ยว)
  const w = rows[0].length;
  const fixed = rows.map((r) => r.padEnd(w, ".").slice(0, w));
  return <Pix rows={fixed} mirror={mirror} size={size} className={`icon icon--${name} ${className}`.trim()} label={label} />;
}

export const AVATAR_COUNT = AVATAR_ART.length;
export const AVATAR_NAMES = AVATAR_ART.map((a) => a.name);

// อวตาร 16×16 · index 0–5 ตรงกับค่า avatar ที่ส่งไป server (events.md)
export function AvatarArt({ index = 0, size = 40, label }) {
  const safe = Number.isInteger(index) && index >= 0 && index < AVATAR_COUNT ? index : 0;
  return <Pix rows={AVATAR_ART[safe].rows} mirror size={size} className="avatar-art" label={label} />;
}

