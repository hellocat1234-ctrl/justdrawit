// แถวปุ่มเลือกหนึ่งค่า (ปุ่มเรียงติดกัน ตัวที่เลือกอยู่กดยุบ) — ใช้คลาส .segmented/.seg เดิมของแอป
// choices = [[ค่า, ป้าย], ...] · value = ค่าที่เลือกอยู่ · onChange(ค่าใหม่)
export default function OptionRow({ label, choices, value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {choices.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          className={value === v ? "seg seg--active" : "seg"}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
