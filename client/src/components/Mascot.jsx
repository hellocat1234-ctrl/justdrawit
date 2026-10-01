import { useMemo } from "react";

// มาสคอตของเรา "ก้อนกลมสีเหลืองตาโต" วาดเป็นพิกเซลด้วย SVG เอง (ไม่ได้ใช้ภาพหรือตัวการ์ตูนของใคร)
// ทุกอารมณ์สร้างจากโค้ดบนตาราง 32×24 ช่อง: วาดตัวก้อนกลม → ตา → ปาก → ของที่ถือ
// แล้วรวมช่องที่สีเดียวกันติดกันเป็นแถบ <rect> (ไม่ใช้รูปภาพ จึงคมทุกขนาดจอ)
//
// อารมณ์ (mood)  wait ถือนาฬิกา · draw ถือดินสอ · think กำลังคิด · shock ตกใจ · happy ดีใจ · trophy ถือถ้วย

const W = 32;
const H = 24;

const COLORS = {
  "#": "#2b2b2b", // ขอบ/ตาดำ (--ink)
  y: "#ffd23f", // ตัว
  Y: "#f0a800", // เงาใต้ตัว
  L: "#fff1a8", // ไฮไลต์
  w: "#ffffff",
  r: "#e8553f",
  p: "#ff9fbf", // แก้ม
  b: "#4aa8ff", // หยดเหงื่อ
  o: "#ef8a2b", // ตัวดินสอ
  n: "#e8c28a", // เนื้อไม้ปลายดินสอ
  g: "#ffc81e", // ทอง
  G: "#d49a00", // ทองเข้ม
};

const makeGrid = () => Array.from({ length: H }, () => Array(W).fill(null));
const put = (g, x, y, c) => {
  if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c;
};
const rect = (g, x, y, w, h, c) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, c);
};
const stamp = (g, x, y, rows, map = {}) => {
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch !== ".") put(g, x + i, y + j, map[ch] ?? ch);
    })
  );
};

// เติมขอบดำรอบของที่วาดไว้ในชั้นนี้ (เฉพาะช่องว่างที่ติดกับของ 4 ทิศ)
function outline(g) {
  const edge = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (g[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx])) edge.push([x, y]);
    }
  edge.forEach(([x, y]) => put(g, x, y, "#"));
}

function body() {
  const g = makeGrid();
  const cx = 12, cy = 12, rx = 10, ry = 9;
  const inside = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (inside(x, y)) g[y][x] = "y";
  // เงาด้านล่างขวา + ไฮไลต์ด้านบนซ้าย ให้ดูเป็นก้อนนูน
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (g[y][x] !== "y") continue;
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d > 0.62 && x + y > cx + cy) g[y][x] = "Y";
    }
  [[5, 6], [6, 5], [5, 7], [7, 4]].forEach(([x, y]) => put(g, x, y, "L"));
  // ขอบดำ: ช่องตัวที่ติดกับข้างนอก
  const edge = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !g[y + dy]?.[x + dx])) edge.push([x, y]);
  edge.forEach(([x, y]) => put(g, x, y, "#"));
  return g;
}

// ตากล่อง 5×6 ขอบดำ ข้างในขาว 3×4 มีตาดำ 2×3 มองไปทิศ look = [ซ้ายขวา 0..1, บนล่าง 0..1]
function eyes(mood) {
  const g = makeGrid();
  const look = { wait: [1, 0], draw: [1, 1], think: [0, 0], happy: null, shock: "wide", trophy: [0, 1] }[mood];
  for (const x0 of [6, 14]) {
    if (look === null) {
      // ตายิ้มโค้ง ^
      stamp(g, x0, 8, ["..#..", ".#.#.", "#...#"]);
    } else if (look === "wide") {
      // ตกใจ: ตากว้างขึ้น ตาดำเม็ดเดียว
      rect(g, x0, 6, 5, 8, "#");
      rect(g, x0 + 1, 7, 3, 6, "w");
      put(g, x0 + 2, 10, "#");
    } else {
      rect(g, x0, 7, 5, 6, "#");
      rect(g, x0 + 1, 8, 3, 4, "w");
      rect(g, x0 + 1 + look[0], 8 + look[1], 2, 3, "#");
    }
  }
  return g;
}

function mouth(g, mood) {
  if (mood === "happy" || mood === "trophy") {
    stamp(g, 9, 15, ["#######", "#rrrrr#", ".#rrr#.", "..###.."]);
    if (mood === "happy") {
      rect(g, 4, 14, 2, 1, "p");
      rect(g, 19, 14, 2, 1, "p");
    }
  } else if (mood === "shock") {
    stamp(g, 11, 15, ["###", "#r#", "#r#", "###"]);
  } else if (mood === "think") {
    stamp(g, 10, 15, [".#.#.", "#.#.#"]);
  } else if (mood === "draw") {
    stamp(g, 10, 15, ["#...#", ".###."]);
  } else {
    stamp(g, 11, 16, ["###"]); // wait: ปากเรียบ
  }
}

function prop(mood) {
  const g = makeGrid();
  if (mood === "wait") {
    // นาฬิกาปลุกกลม
    const cx = 26.5, cy = 14, r = 4.6;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) g[y][x] = "w";
    stamp(g, 26, 11, ["#", "#", "#"]); // เข็มยาว
    stamp(g, 26, 14, ["###"]); // เข็มสั้น
    stamp(g, 23, 8, ["r.r"]); // หูกระดิ่ง
    outline(g);
  } else if (mood === "draw") {
    for (let t = 0; t < 8; t++) {
      put(g, 29 - t, 5 + t, "o");
      put(g, 30 - t, 5 + t, "o");
    }
    put(g, 30, 4, "p");
    put(g, 31, 4, "p"); // ยางลบ
    put(g, 22, 13, "n");
    put(g, 23, 13, "n");
    put(g, 21, 14, "#"); // ไส้ดินสอ
    outline(g);
  } else if (mood === "think") {
    rect(g, 24, 2, 7, 7, "w");
    stamp(g, 26, 3, ["###", "..#", ".##", "...", ".#."], { "#": "#" });
    put(g, 22, 10, "w");
    put(g, 21, 12, "w");
    outline(g);
    // เฉพาะเม็ดฟองเล็ก ๆ ไม่ต้องมีขอบหนา แต่ยังอ่านออก
  } else if (mood === "shock") {
    stamp(g, 21, 3, [".b.", "bbb", "bbb", ".b."]); // หยดเหงื่อ
    stamp(g, 25, 3, ["##", "##", "##", "##", "..", "##"]); // เครื่องหมาย !
  } else if (mood === "happy") {
    [[24, 6], [29, 11], [25, 18], [30, 3]].forEach(([x, y]) => {
      stamp(g, x - 1, y - 1, [".g.", "ggg", ".g."]);
    });
  } else if (mood === "trophy") {
    rect(g, 24, 6, 6, 6, "g");
    rect(g, 25, 12, 4, 1, "g");
    rect(g, 26, 13, 2, 3, "G");
    rect(g, 24, 16, 6, 2, "G");
    stamp(g, 22, 7, ["g", ".g", ".g", "g"]); // หูจับซ้าย
    stamp(g, 30, 7, ["g", "g.", "g.", "g"]);
    put(g, 25, 7, "w");
    put(g, 25, 8, "w");
    outline(g);
  }
  return g;
}

// รวมช่องเป็นแถบสีเดียวกันติดกันในแถวเดียวกัน → ลดจำนวน <rect>
function toRects(grid) {
  const out = [];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const c = grid[y][x];
      if (!c) {
        x++;
        continue;
      }
      let len = 1;
      while (x + len < W && grid[y][x + len] === c) len++;
      out.push({ x, y, len, fill: COLORS[c] });
      x += len;
    }
  }
  return out;
}

function build(mood) {
  const base = body();
  const faceLayer = makeGrid();
  mouth(faceLayer, mood);
  const eyeLayer = eyes(mood);
  // ของที่ถือต้องอยู่เหนือตัวเสมอ ตากับปากแยกชั้นไว้ให้ตากระพริบได้ด้วย CSS
  return { base: toRects(base), mouth: toRects(faceLayer), eyes: toRects(eyeLayer), prop: toRects(prop(mood)) };
}

const LABELS = {
  wait: "มาสคอตถือนาฬิกา รอผู้เล่น",
  draw: "มาสคอตถือดินสอ",
  think: "มาสคอตกำลังคิด",
  shock: "มาสคอตตกใจ",
  happy: "มาสคอตดีใจ",
  trophy: "มาสคอตถือถ้วยรางวัล",
};

export const MASCOT_MOODS = Object.keys(LABELS);

export default function Mascot({ mood = "wait", className = "" }) {
  const parts = useMemo(() => build(MASCOT_MOODS.includes(mood) ? mood : "wait"), [mood]);
  const draw = (list, key) =>
    list.map((r, i) => <rect key={`${key}${i}`} x={r.x} y={r.y} width={r.len} height="1" fill={r.fill} />);
  return (
    <svg
      className={`mascot mascot--${mood} ${className}`.trim()}
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={LABELS[mood]}
    >
      <g className="mascot__bob">
        <g>{draw(parts.base, "b")}</g>
        <g className="mascot__eyes">{draw(parts.eyes, "e")}</g>
        <g>{draw(parts.mouth, "m")}</g>
        <g className="mascot__prop">{draw(parts.prop, "p")}</g>
      </g>
    </svg>
  );
}

// มาสคอต + ป้ายข้อความสั้น ๆ ใต้ตัว ใช้วางกลางกระดานหรือในหน้าต่างผลลัพธ์
export function MascotNote({ mood, children }) {
  return (
    <div className="mascot-note">
      <Mascot mood={mood} />
      {children && <p className="mascot-note__text">{children}</p>}
    </div>
  );
}
