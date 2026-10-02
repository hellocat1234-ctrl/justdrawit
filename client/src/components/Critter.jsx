import { PAL, toRects } from "./Icons";
import { SPRITES, grassRows } from "../art/sprites";

// ตัวการ์ตูนพิกเซลตกแต่ง (แมวนอน นกแก้ว ดาวยิ้ม ถ้วยรางวัล ประกาย) — วาดเองเป็น SVG จากตารางใน art/sprites.js
// ตกแต่งล้วน: aria-hidden + pointer-events: none (ไม่บังปุ่ม ไม่ให้โปรแกรมอ่านจออ่าน)
// ขยับเบาๆ ด้วย CSS (สลับท่า a/b) · ปิดอัตโนมัติเมื่อผู้ใช้เลือก "ลดภาพเคลื่อนไหว" (กฎ data-motion ใน theme.css)
function Frame({ rows, mirror, className }) {
  const { rects } = toRects(rows, mirror);
  return (
    <g className={className}>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />
      ))}
    </g>
  );
}

export default function Critter({ name, scale = 4, className = "" }) {
  const s = SPRITES[name];
  if (!s) return null;
  return (
    <svg
      className={`critter critter--${name} ${s.anim ? `critter--${s.anim}` : ""} ${className}`.trim()}
      width={s.w * scale}
      height={s.h * scale}
      viewBox={`0 0 ${s.w} ${s.h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <Frame rows={s.a} mirror={s.mirror} className="critter__a" />
      {s.b && <Frame rows={s.b} mirror={s.mirror} className="critter__b" />}
    </svg>
  );
}

// ประกายวิบวับ: วางหลายจุดในกรอบที่ตำแหน่งสัมพัทธ์ (คลาส .sparkles ต้องอยู่ในพ่อแม่ที่ position: relative)
export function Sparkles({ spots, className = "" }) {
  return (
    <div className={`sparkles ${className}`.trim()} aria-hidden="true">
      {spots.map(([x, y, size, delay], i) => (
        <span key={i} className="sparkles__s" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}>
          <Critter name="sparkle" scale={size} />
        </span>
      ))}
    </div>
  );
}

// แถบหญ้าพิกเซลด้านล่างหน้าแรก — ลายซ้ำตามแนวนอน
const GRASS = grassRows();
const GRASS_SCALE = 3;
export function GrassStrip() {
  const { rects, w, h } = toRects(GRASS, false);
  return (
    <svg className="grass" height={h * GRASS_SCALE} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="grass-tile" width={w * GRASS_SCALE} height={h * GRASS_SCALE} patternUnits="userSpaceOnUse">
          {rects.map((r, i) => (
            <rect key={i} x={r.x * GRASS_SCALE} y={r.y * GRASS_SCALE} width={r.w * GRASS_SCALE} height={GRASS_SCALE} fill={r.fill} />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grass-tile)" />
    </svg>
  );
}

export { PAL };

// ประกายสองข้างหน้าเกม (ตกแต่งน้อยๆ: อยู่ในขอบจอนอกพื้นที่เล่น ซ่อนเมื่อจอแคบ)
export const PAGE_SPARKLES = [
  [2, 28, 3, 0],
  [97, 62, 3, 0.8],
  [3, 72, 2, 1.5],
  [96, 18, 2, 0.4],
];
