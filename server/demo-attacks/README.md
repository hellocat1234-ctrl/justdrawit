# สคริปต์สาธิตการโจมตี (สำหรับนำเสนอหัวข้อ Security)

สคริปต์สองตัวนี้ใช้สาธิต "ก่อนแก้ vs หลังแก้" ให้อาจารย์ดูว่าช่องโหว่ถูกปิดแล้วจริง

> ⚠️ **รันกับ server ของเราเองบน localhost เท่านั้น** ห้ามยิงเครื่อง/บริการของคนอื่น

## ไฟล์
| ไฟล์ | ทำอะไร |
|---|---|
| `attack-guess-flood.js` | ยิงคำทั้งคลัง (130 คำ) ใส่ event `guess` จนทายถูกโดยไม่ต้องรู้คำจริง |
| `attack-room-scan.js` | ไล่เดารหัสห้อง 5 หลักด้วย `rejoin` หาห้อง Private โดยไม่รู้รหัสล่วงหน้า |
| `before.txt` | ผลตอนรันกับโค้ด**ก่อน**ใส่ rate limit (โจมตีสำเร็จทั้งคู่) |
| `after.txt` | ผลตอนรันกับโค้ด**หลัง**ใส่ rate limit (โจมตีถูกบล็อกทั้งคู่) |

## วิธีรัน
เปิด server ไว้ก่อน (`npm start` หรือ `cd server && node index.js`) แล้ว:
```bash
cd server
node demo-attacks/attack-guess-flood.js
node demo-attacks/attack-room-scan.js
```
ชี้ไป server อื่น (เช่นตอนทดสอบแยกพอร์ต): `TARGET=http://localhost:3077 node demo-attacks/attack-guess-flood.js`

## ช่องโหว่ที่สาธิต และการแก้ (ทั้งคู่อยู่ใน `server/index.js`)
1. **ยิง `guess` รัว ๆ** → จำกัด 10 ครั้ง/5 วิ ต่อ socket (`GUESS_MAX` / `GUESS_WINDOW_MS`) เกินแล้วทิ้งเงียบ
2. **ไล่เดารหัสห้อง** → `join_room` + `rejoin` รวมกันจำกัด 15 ครั้ง/10 วิ ต่อ socket (`LOOKUP_MAX` / `LOOKUP_WINDOW_MS`) เกินแล้วตอบ `TOO_MANY_ATTEMPTS`

ทั้งสองค่าตั้งให้ "สูงกว่าที่คนเล่นจริงทำได้ แต่ต่ำกว่าที่สคริปต์ยิงรัว ๆ มาก" ปรับได้ที่ค่าคงที่ในไฟล์ (หัวข้อ "จำกัดความถี่")
