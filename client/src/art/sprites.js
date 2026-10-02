// ตัวการ์ตูนพิกเซลของเราเอง (วาดเองทีละช่อง ไม่ได้ก๊อปจากเกมไหน) — ข้อมูลล้วน ไม่มี React
// 1 ตัวอักษร = 1 พิกเซล (จุด . = โปร่งใส) สีตามชุด PAL ใน components/Icons.jsx เช่นเดียวกับไอคอน
// ตัวที่ขยับได้มีสองท่า a / b: anim "wag" = สลับท่าครึ่งต่อครึ่ง (ส่ายหาง) · "blink" = ท่า b โผล่แค่ช่วงสั้นๆ (กระพริบตา)
// ท่า b สร้างจากท่า a โดยแก้ไม่กี่พิกเซล (patch) จึงไม่ต้องเขียนซ้ำทั้งตัว

// แก้พิกเซลของตารางตัวอักษร: patch = [[แถว, คอลัมน์, ตัวอักษรใหม่], ...]
function patch(rows, edits) {
  const g = rows.map((r) => r.split(""));
  for (const [y, x, c] of edits) g[y][x] = c;
  return g.map((r) => r.join(""));
}

// ── แมวส้มนอนเล่น 24×12 (นั่งบนขอบบนของแผง) หลับตาตลอด หางส่าย ──
const CAT_A = [
  "........................",
  "...............k....k...",
  "..............kok..kok..",
  "......kkkkkkk.kooookook.",
  "....kkooooooookoooooook.",
  "...kooOooOooookooookkook",
  "...koooooooooooookoooook",
  "...kooOooOoooookoopppook",
  "kk.kooooooooooooowwwwwk.",
  "kokkkoowwwwwwwwwwkkkkk..",
  ".kkkkkkkkkkkkkkkk.......",
  "........................",
];
const CAT_B = patch(CAT_A, [
  [8, 0, "."],
  [8, 1, "."],
  [9, 0, "k"],
  [9, 1, "o"],
  [7, 0, "k"],
  [7, 1, "k"],
  [8, 2, "."],
  [9, 2, "k"],
]);

// ── นกแก้ว 14×20 ยืนบนคอน กระพริบตา ──
const PARROT_A = [
  "......kkkk....",
  ".....krrrrk...",
  "....krrrrrrk..",
  "....krwkrrrrk.",
  "....krkkrrkyyk",
  "....krrrrkyyyk",
  ".....krrrrkkyk",
  "....kggggggk..",
  "...kgGGggbbbk.",
  "...kgGGggbbbbk",
  "...kgggggbbbbk",
  "...kgGgggbbbk.",
  "....kgggggbbk.",
  "....kgggggkk..",
  ".....kgggkgk..",
  "......kgkk.kk.",
  "nnnnnnnnnnnnnn",
  "knnnnnnnnnnnnk",
  ".kkkkkkkkkkkk.",
  "..............",
];
const PARROT_B = patch(PARROT_A, [[3, 6, "k"]]);

// ── ดาวยิ้ม 18×17 (ครึ่งซ้าย 9 ช่อง สะท้อนอัตโนมัติ) กระพริบตา ──
const STAR_HALF_A = [
  "........k",
  ".......kc",
  ".......kc",
  "......kcc",
  "kkkkkkkcc",
  ".kccccccc",
  "..kcccccc",
  "..kcckkcc",
  "..kcckkcc",
  "...kpcccc",
  "...kcckcc",
  "...kccckk",
  "..kcccccc",
  ".kcccckkk",
  ".kccck...",
  "kccck....",
  "kkkk.....",
];
// ท่า b: ตาปิด (เหลือแถวล่างแถวเดียว)
const STAR_HALF_B = patch(STAR_HALF_A, [
  [7, 5, "c"],
  [7, 6, "c"],
]);

// ── ถ้วยรางวัล 16×18 (ครึ่งซ้าย 8 ช่อง สะท้อนอัตโนมัติ) ──
const TROPHY_HALF = [
  "........",
  "..kkkkkk",
  "kkkYYyyy",
  "k.kYyyyy",
  "k.kYyyyy",
  "kkkYyyyy",
  ".kkYyyyy",
  "..kYyyyy",
  "...kyyyy",
  "....kyyy",
  ".....kyy",
  "......ky",
  "......ky",
  ".....kyy",
  "...kkkkk",
  "..kppppp",
  "..kppppp",
  "..kkkkkk",
];

// ── ประกาย (จะวางหลายตัวแล้วให้กะพริบสลับกัน) 7×7 ──
const SPARKLE = [
  "...k...",
  "...k...",
  "..kYk..",
  "kkYwYkk",
  "..kYk..",
  "...k...",
  "...k...",
];

export const SPRITES = {
  cat: { w: 24, h: 12, anim: "wag", a: CAT_A, b: CAT_B },
  parrot: { w: 14, h: 20, anim: "blink", a: PARROT_A, b: PARROT_B },
  star: { w: 18, h: 17, anim: "blink", mirror: true, a: STAR_HALF_A, b: STAR_HALF_B },
  trophy: { w: 16, h: 18, mirror: true, a: TROPHY_HALF },
  sparkle: { w: 7, h: 7, a: SPARKLE },
};

// ── แถบหญ้าพิกเซล (วนซ้ำตามแนวนอนได้) กว้าง 64 สูง 22 ──
// ไล่ความสูงใบหญ้าจากสูตรคงที่ (ไม่สุ่ม) เพื่อให้ผลเหมือนเดิมทุกครั้งที่โหลด · ดอกไม้วางตามตำแหน่งที่กำหนด
export function grassRows(w = 64, h = 22) {
  const g = Array.from({ length: h }, () => Array(w).fill("."));
  const blade = (x) => 2 + ((x * 7 + ((x * x) % 5)) % 3); // 2–4 พิกเซลเหนือเส้นพื้น
  const base = 12; // แถวที่เริ่มเป็นผืนหญ้าเต็ม
  for (let x = 0; x < w; x++) {
    const top = base - (x % 4 === 1 || x % 9 === 5 ? blade(x) - 1 : 0);
    for (let y = top; y < h; y++) {
      g[y][x] = y === top ? "k" : y === top + 1 ? "G" : y < h - 3 ? "g" : y < h - 1 ? "n" : "O";
    }
  }
  // เส้นขอบบนให้ต่อเนื่อง: เติมขอบดำข้างใบหญ้า
  const flower = (cx, color, stem = 3) => {
    const top = base - 4 - stem;
    g[top][cx] = "k";
    g[top + 1][cx - 1] = "k";
    g[top + 1][cx] = color;
    g[top + 1][cx + 1] = "k";
    g[top + 2][cx] = "k";
    for (let y = top + 3; y < base - 1; y++) g[y][cx] = "g";
  };
  flower(8, "p");
  flower(25, "y");
  flower(43, "r");
  flower(57, "w");
  return g.map((r) => r.join(""));
}
