import { AVATARS } from "../avatars";
import { AvatarArt } from "./Icons";

// อวตารแบบแสดงเฉยๆ (ในห้องรอ และต่อจากนี้คือแถบคะแนน)
// ค่าที่ server ส่งมาควรเป็น 0-5 อยู่แล้ว แต่ถ้าแปลกมาให้ใช้ตัวแรกแทน ไม่ให้จอพัง
export default function Avatar({ index }) {
  const safe = Number.isInteger(index) && index >= 0 && index < AVATARS.length ? index : 0;
  return (
    <span className="avatar-chip" aria-hidden="true">
      <AvatarArt index={safe} size={30} />
    </span>
  );
}
