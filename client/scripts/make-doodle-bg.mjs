// สร้างไทล์พื้นหลังลาย "วาดเล่น" เป็น SVG พิกเซล: node scripts/make-doodle-bg.mjs
// ไอคอนทั้ง 6 (ดาว หัวใจ เมฆ ดินสอ จานสี ถังสี) วาดเองเป็นตารางพิกเซล สีจางมากเพื่อไม่รบกวนการอ่าน
// ผลลัพธ์อยู่ที่ src/assets/doodle-yellow.svg (พื้นเหลือง · เส้นสีดำจาง) และ doodle-blue.svg (พื้นฟ้า · เส้นสีขาวจาง)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICONS = {
  star: ["....#....", "....#....", "...###...", "#########", ".#######.", "..#####..", "..##.##..", ".##...##.", ".#.....#."],
  heart: [".##...##.", "####.####", "#########", "#########", ".#######.", "..#####..", "...###...", "....#...."],
  cloud: ["....###....", "..#######..", ".#########.", "###########", "###########", ".#########."],
  pencil: ["......##.", ".....####", "....####.", "...####..", "..####...", ".####....", ".###.....", "#.#......", "##......."],
  palette: ["..######..", ".########.", "##..###.##", "#.#.####.#", "##..#####.", "#######.#.", ".#########", "..######.."],
  bucket: ["..#####..", ".#.....#.", "#.......#", "#########", "#########", ".#######.", ".#######.", "..#####..", "..#####.."],
};

const TILE = 200; // ขนาดไทล์ (px) ซ้ำไปเรื่อย ๆ
const PX = 4; // หนึ่งช่องพิกเซล = 4px
// ตำแหน่งสลับฟันปลา (x, y) ของไอคอนแต่ละตัวในไทล์ — ห่างกันพอไม่แน่น
const PLACE = [
  ["star", 14, 12],
  ["heart", 118, 22],
  ["cloud", 62, 76],
  ["pencil", 150, 96],
  ["palette", 12, 120],
  ["bucket", 100, 150],
];

function tile(color, opacity) {
  const rects = [];
  for (const [name, ox, oy] of PLACE) {
    ICONS[name].forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch === "#") rects.push(`<rect x="${ox + i * PX}" y="${oy + j * PX}" width="${PX}" height="${PX}"/>`);
      })
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}" shape-rendering="crispEdges"><g fill="${color}" fill-opacity="${opacity}">${rects.join("")}</g></svg>\n`;
}

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "assets");
fs.writeFileSync(path.join(out, "doodle-yellow.svg"), tile("#2b2b2b", 0.09));
fs.writeFileSync(path.join(out, "doodle-blue.svg"), tile("#ffffff", 0.13));
console.log("สร้าง doodle-yellow.svg / doodle-blue.svg แล้ว");
