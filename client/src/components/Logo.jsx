// โลโก้สองบรรทัด JUST สีฟ้า / DRAW IT สีเหลือง ขอบตัวอักษรดำ (ตาม DESIGN.md)
export default function Logo() {
  return (
    <h1 className="logo" aria-label="Just Drawit">
      <span className="logo__just">JUST</span>
      <span className="logo__drawit">DRAW IT</span>
    </h1>
  );
}
