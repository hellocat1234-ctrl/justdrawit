import { useSyncExternalStore } from "react";
import * as sfx from "../sound/sfx";
import * as music from "../sound/music";
import { reduceMotion, setReduceMotion, subscribeMotion } from "../prefs";

// ค่าตั้งของผู้ใช้ที่จำไว้ในเบราว์เซอร์ — เสียงเปิด/ปิด · ลดภาพเคลื่อนไหว
export function useSoundMuted() {
  return [useSyncExternalStore(sfx.subscribe, sfx.isMuted), sfx.setMuted];
}

export function useMusicOn() {
  return [useSyncExternalStore(music.subscribeMusic, music.isMusicOn), music.setMusic];
}

export function useReduceMotion() {
  return [useSyncExternalStore(subscribeMotion, reduceMotion), setReduceMotion];
}

// มีไฟล์เพลงให้เล่นไหม — ไม่มี = ซ่อนปุ่มเพลง
export function useHasMusic() {
  return useSyncExternalStore(music.subscribeMusic, music.hasMusic);
}
