// สร้างไอคอนแอป (PNG) จากรูปพิกเซลดินสอ — ใช้ sharp ของ server (มีอยู่แล้ว ไม่เพิ่ม library)
// รัน: node client/scripts/make-app-icons.mjs  → client/public/icons/*.png + icon.svg
// ดินสอวาดเป็นตารางพิกเซล 16×16 (ทุกช่อง = สี่เหลี่ยมหนึ่งอัน) เข้ากับธีมพิกเซลของเกม
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../server/package.json"));
const sharp = require("sharp");
const OUT = path.join(here, "..", "public", "icons");
fs.mkdirSync(OUT, { recursive: true });

const BG = "#6b5bff"; // พื้นหลังหน้าเกม (ม่วงน้ำเงิน)
// ดินสอเอียง 45° : ตัวอักษรแทนสี  . = โปร่ง  K = ขอบดำ  Y = เหลือง  O = เหลืองเข้ม  P = ชมพู(ยางลบ)  G = เทา(ปลอกโลหะ)  S = เนื้อไม้  L = ไส้ดินสอ(ดำ)
const GRID = [
  "..........KKK...",
  ".........KPPPK..",
  "........KPPPPPK.",
  ".......KKGGGGKK.",
  "......KGGGGGGK..",
  ".....KYYKKKKYK..",
  "....KYYYYYYYYK..",
  "...KYYYYYYYYOK..",
  "..KYYYYYYYYOK...",
  ".KYYYYYYYYOK....",
  ".KYYYYYYYOK.....",
  "KSSYYYYYOK......",
  "KSSSSYYOK.......",
  "KSSSSSSK........",
  "KLSSSSK.........",
  ".KKKKK..........",
];
const COLORS = { K: "#2b2b2b", Y: "#ffc81e", O: "#e0a500", P: "#ff8fb7", G: "#c9ced6", S: "#f3d7a8", L: "#2b2b2b" };

function svg(size, pad) {
  const cell = (size - pad * 2) / 16;
  let rects = "";
  GRID.forEach((row, y) => [...row].forEach((ch, x) => {
    if (COLORS[ch]) rects += `<rect x="${(pad + x * cell).toFixed(2)}" y="${(pad + y * cell).toFixed(2)}" width="${(cell + 0.6).toFixed(2)}" height="${(cell + 0.6).toFixed(2)}" fill="${COLORS[ch]}"/>`;
  }));
  // ดาวประกายสองดวงให้ดูมีชีวิต
  const star = (cx, cy, r) => `<path d="M${cx} ${cy - r}L${cx + r * 0.3} ${cy - r * 0.3}L${cx + r} ${cy}L${cx + r * 0.3} ${cy + r * 0.3}L${cx} ${cy + r}L${cx - r * 0.3} ${cy + r * 0.3}L${cx - r} ${cy}L${cx - r * 0.3} ${cy - r * 0.3}Z" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${BG}"/>${rects}${star(size * 0.2, size * 0.22, size * 0.07)}${star(size * 0.84, size * 0.78, size * 0.05)}</svg>`;
}

fs.writeFileSync(path.join(OUT, "icon.svg"), svg(512, 56));
// pad: ไอคอนปกติเว้นขอบน้อย · maskable ต้องเว้นขอบ ~20% (ระบบอาจตัดมุม/วงกลม)
for (const [name, size, pad] of [["icon-192.png", 192, 20], ["icon-512.png", 512, 56], ["icon-maskable-512.png", 512, 110], ["apple-touch-icon.png", 180, 18]]) {
  await sharp(Buffer.from(svg(size, pad))).png().toFile(path.join(OUT, name));
  console.log("สร้าง", name);
}
