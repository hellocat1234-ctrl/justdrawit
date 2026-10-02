import { useSyncExternalStore } from "react";
import * as sfx from "../sound/sfx";
import { reduceMotion, setReduceMotion, subscribeMotion } from "../prefs";

// ค่าตั้งของผู้ใช้ที่จำไว้ในเบราว์เซอร์ — เสียงเปิด/ปิด · ลดภาพเคลื่อนไหว
export function useSoundMuted() {
  return [useSyncExternalStore(sfx.subscribe, sfx.isMuted), sfx.setMuted];
}

export function useMusicOn() {
  return [useSyncExternalStore(sfx.subscribeMusic, sfx.isMusicOn), sfx.setMusic];
}

export function useReduceMotion() {
  return [useSyncExternalStore(subscribeMotion, reduceMotion), setReduceMotion];
}
