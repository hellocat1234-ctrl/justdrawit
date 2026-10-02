import { Icon } from "./Icons";
import { useHasMusic, useMusicOn, useSoundMuted } from "../hooks/usePrefs";

// ปุ่มเปิด/ปิด "เพลง" กับ "เสียงเอฟเฟกต์" — ชุดเดียวกันทุกหน้า
//   - หน้าที่มีแถบบน (เกม Solo): อยู่ในกลุ่มไอคอนมุมขวาบนของแถบ (TopIcons ใส่ <AudioButtons/> ให้)
//   - หน้าที่ไม่มีแถบบน (หน้าแรก SET UP ห้องรอ Leaderboard): <AudioDock/> วางมุมขวาบนของหน้า
//   ตำแหน่งจึงเป็น "มุมขวาบน" เหมือนกันทุกหน้า และไม่ลอยทับกล่องอื่น
// ปุ่มเพลงโชว์เฉพาะตอนมีไฟล์เพลง (public/music/) — ไม่มีไฟล์ = ซ่อน
export function AudioButtons() {
  const [muted, setMuted] = useSoundMuted();
  const [music, setMusic] = useMusicOn();
  const hasMusic = useHasMusic();
  return (
    <>
      {hasMusic && (
        <button
          type="button"
          className={`icon-btn${music ? "" : " icon-btn--off"}`}
          onClick={() => setMusic(!music)}
          aria-pressed={music}
          aria-label={music ? "ปิดเพลง" : "เปิดเพลง"}
          title={music ? "ปิดเพลง" : "เปิดเพลง"}
        >
          <Icon name="music" size={26} />
        </button>
      )}
      <button
        type="button"
        className="icon-btn"
        onClick={() => setMuted(!muted)}
        aria-pressed={!muted}
        aria-label={muted ? "เปิดเสียงเอฟเฟกต์" : "ปิดเสียงเอฟเฟกต์"}
        title={muted ? "เปิดเสียงเอฟเฟกต์" : "ปิดเสียงเอฟเฟกต์"}
      >
        <Icon name={muted ? "mute" : "sound"} size={26} />
      </button>
    </>
  );
}

export default function AudioDock() {
  return (
    <div className="audio-dock" role="group" aria-label="เสียง">
      <AudioButtons />
    </div>
  );
}
