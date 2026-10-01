# Just Drawit

เกมวาดรูปทายคำแบบ multiplayer (ทีม TATA.IO · CP422011 เครือข่ายคอมพิวเตอร์ขั้นแนะนำ มหาวิทยาลัยขอนแก่น)

## รันเกม

```bash
cd server && npm install && npm run get-model   # get-model ทำครั้งเดียว (ดูหัวข้อถัดไป)
cd server && node index.js                       # http://localhost:3000
cd client && npm install && npm run dev          # http://localhost:5173
```

## โมเดล AI ของโหมด Solo (ฟรี รันในเครื่อง ไม่ต้องมี API key)

โหมด Solo ให้ AI ทายภาพที่ผู้เล่นวาด โดย server รันโมเดลจำแนกภาพวาดที่ฝึกจากชุดข้อมูล Quick, Draw! เองด้วย `onnxruntime-node`
(client ไม่ได้ตัดสินอะไรเลย) ไฟล์โมเดลประมาณ 20 MB **ไม่ได้ commit ไว้** ต้องดาวน์โหลดก่อนใช้:

```bash
cd server && npm run get-model
```

สคริปต์โหลดไฟล์ไปไว้ที่ `server/models/` และเช็คสัญญาอนุญาตของโมเดลว่าเป็น MIT ก่อนทุกครั้ง (ไม่ใช่ = หยุด)
ตอนสตาร์ท server จะพิมพ์ `AI Solo: โหมด model` ถ้าโหลดติด

ลำดับสมองของ AI: **โมเดลในเครื่อง → Claude API (ถ้าใส่ `ANTHROPIC_API_KEY` ใน `server/.env`) → โหมดจำลอง (เดาสุ่ม)**
ไม่ได้ดาวน์โหลดโมเดลหรือไฟล์เสีย ก็ยังเล่นได้ด้วยสมองถัดไป server ไม่ล่ม

คำของ Solo อยู่ที่ `server/data/ai-words.json` (คำไทยจับคู่กับชื่ออังกฤษที่โมเดลรู้จัก คัดเฉพาะคำที่โมเดลทายถูกบ่อยพอ)

## เครดิต

- โมเดล: [VinayHajare/quickdraw-mobilevit-small-onnx](https://huggingface.co/VinayHajare/quickdraw-mobilevit-small-onnx) สัญญาอนุญาต MIT (ปรับต่อจาก MobileViT-Small ของ Apple)
- ชุดข้อมูลที่ใช้ฝึก: [Google Quick, Draw! Dataset](https://github.com/googlecreativelab/quickdraw-dataset) สัญญาอนุญาต CC BY 4.0
