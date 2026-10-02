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

## ช่วง "ดูภาพแล้วทาย" ของโหมด Solo

ทุกด่านของ Solo มีสองช่วง: ช่วงแรกผู้เล่นวาด AI ทาย ช่วงสอง server เล่นซ้ำภาพวาดที่ **คนจริงเคยวาด** (จากชุดข้อมูล Quick, Draw!)
ทีละเส้น ผู้เล่นพิมพ์ทาย **ไม่ใช่ AI สร้างภาพเอง** ภาพเก็บที่ `server/data/ai-drawings.json` (พิกัดเส้นล้วน ไม่มีชื่อคำติดมา ประมาณ 2 MB commit ไว้แล้ว)
สร้างไฟล์ใหม่ได้ด้วย (ต้อง `get-model` ก่อน เพราะใช้โมเดลกรองเฉพาะภาพที่ทายถูกอันดับหนึ่ง ใช้เวลาราว 3 นาที):

```bash
cd server && npm run get-drawings
```

ไม่มีไฟล์ภาพหรือไฟล์เสีย ก็ยังเล่นได้ เพียงข้ามช่วงสอง

## เครดิต

- โมเดล: [VinayHajare/quickdraw-mobilevit-small-onnx](https://huggingface.co/VinayHajare/quickdraw-mobilevit-small-onnx) สัญญาอนุญาต MIT (ปรับต่อจาก MobileViT-Small ของ Apple)
- ชุดข้อมูลที่ใช้ฝึก: [Google Quick, Draw! Dataset](https://github.com/googlecreativelab/quickdraw-dataset) สัญญาอนุญาต CC BY 4.0
- ภาพวาดในช่วง "ดูภาพแล้วทาย" (`server/data/ai-drawings.json`): คัดและแปลงพิกัดจากชุดข้อมูล Google Quick, Draw! เดียวกัน (CC BY 4.0) ภาพเป็นผลงานของผู้เล่นทั่วโลกที่ร่วมวาดให้ชุดข้อมูลนี้
- เพลงพื้นหลัง: [Children's March Theme](https://opengameart.org/content/childrens-march-theme) โดย Cleyton Kauffman ([SoundCloud](https://soundcloud.com/cleytonkauffman)) จาก OpenGameArt.org สัญญาอนุญาต [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (ไม่บังคับให้เครดิต แต่ใส่ไว้เพื่อขอบคุณ) · ไฟล์อยู่ที่ `client/public/music/` เกมวนเล่นซ้ำเพลงนี้ และถ้าอยากเปลี่ยน/เพิ่มเพลง แค่ใส่ไฟล์ในโฟลเดอร์เดียวกัน
