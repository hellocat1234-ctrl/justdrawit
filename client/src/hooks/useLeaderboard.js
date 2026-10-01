import { useEffect, useState } from "react";

// ดึงอันดับจาก GET /api/leaderboard — ใช้ร่วมกันทั้งกล่องในหน้าแรกและหน้า Leaderboard
// month = "YYYY-MM" หรือ "" (ตลอดกาล = ไม่ส่ง month)
// ขอใหม่ทุกครั้งที่ month เปลี่ยน หรือคอมโพเนนต์ถูกสร้างใหม่ (เช่นกลับมาหน้าแรก) จึงเห็นคะแนนล่าสุดเสมอ
export function useLeaderboard(month) {
  const [state, setState] = useState({ status: "loading", top: [] }); // loading | ready | error
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    // เปลี่ยนเดือนเร็วๆ คำขอเก่าอาจตอบมาทีหลังแล้วทับของใหม่ → ยกเลิกคำขอเก่าทิ้งทุกครั้ง
    const controller = new AbortController();
    setState((s) => ({ ...s, status: "loading" }));
    const query = month ? `?month=${month}` : "";

    fetch(`/api/leaderboard${query}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setState({ status: "ready", top: Array.isArray(data?.top) ? data.top : [] }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ status: "error", top: [] });
      });

    return () => controller.abort();
  }, [month, retryKey]);

  return { ...state, retry: () => setRetryKey((n) => n + 1) };
}

// "YYYY-MM" ของเดือนที่มี date อยู่ (ตามนาฬิกาเครื่อง)
export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
