// หน้าต่างลอยกลางจอ พื้นหลังดำโปร่ง 50%
// ใช้ซ้ำทั้ง เลือกคำ / สรุปตา / จบเกม เนื้อหาข้างในส่งเข้ามาเป็น children
export default function Modal({ children, labelledBy }) {
  return (
    <div className="modal">
      <div className="modal__panel" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  );
}
