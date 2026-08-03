# Spec: First Aid — V/S หลายรอบ + ใบปฏิเสธการรักษา (2 ภาษา)
> 2026-08-03 · อนุมัติแบบโดย Pex (ปรับ: ใบปฏิเสธ 2 ภาษา ไทย/อังกฤษ)

## 1. V/S หลายรอบ (Registry หน้าหลัก + หน้า staff)

**ข้อมูล** — ใช้คอลัมน์ `fa_registry.vitals_json` (JSONB) เดิม ไม่ต้องรัน SQL:
```json
{ "rounds": [ { "time": "HH:MM", "bp": "", "hr": "", "rr": "", "spo2": "", "temp": "", "gcs": "", "glucose": "", "pain": "" } ] }
```
- Backward compat: record เก่าที่เป็น object เดี่ยว (`{bp:...}`) อ่านเป็น `rounds[0]` โดย `time = time_in` ของ record
- เขียนกลับเป็นรูป `{rounds:[...]}` เสมอ · รอบที่ว่างทุกช่องไม่บันทึก

**UI (ทั้ง firstaid/index.html และ firstaid/staff.html)**
- กล่อง V/S เดิม → รายการรอบ: แถวละ 1 รอบ มีช่องเวลา (default เวลาปัจจุบันตอนกดเพิ่ม แก้ได้) + ช่องชุดเดิม 8 ช่อง + ปุ่มลบรอบ
- ปุ่ม "+ เพิ่มรอบ V/S" ต่อท้าย ไม่จำกัดจำนวน
- แสดงผล (หน้ารายละเอียดผู้ป่วย + รายงาน event): ตาราง Time | BP | PR | RR | SpO2 | Temp | GCS | DTX | Pain

## 2. ใบปฏิเสธการรักษา/นำส่ง (Registry หน้าหลักเท่านั้นในเฟสนี้)

**ตารางใหม่** — `sql/create_fa_refusals.sql` (รันใน Supabase Dashboard):
- `fa_refusals`: id UUID PK, reg_id, event_id, version INT, สถานะ active/superseded (เซ็นใหม่ไม่ทับของเก่า — ตามแบบ `transport_consents`)
- ประเภทที่ปฏิเสธ (เลือกได้หลายข้อ): ปฏิเสธนำส่งโรงพยาบาล / ปฏิเสธหัตถการที่แนะนำ / อื่นๆ + ช่องรายละเอียด
- snapshot ผู้ป่วย (name/age/gender/phone/triage), ชื่อผู้เซ็น + ความสัมพันธ์, `signature_image` + `witness_name` + `witness_signature_image` (base64), `staff_name`, `signed_at`
- RLS แบบ anon full CRUD ตาม pattern ตารางอื่น

**UI**
- ปุ่ม "ใบปฏิเสธ" ต่อรายการ registry → modal:
  - คำประกาศ **2 ภาษาแสดงคู่กัน (ไทยบน / English ล่าง)**: ยืนยันว่าได้รับการอธิบายอาการ ความเสี่ยง และคำแนะนำแล้ว และขอปฏิเสธด้วยความสมัครใจ โดยไม่เอาความกับผู้ปฏิบัติงาน/บริษัท
  - checkbox ประเภทที่ปฏิเสธ (2 ภาษา) + รายละเอียด
  - ผู้เซ็น: ชื่อ + ความสัมพันธ์ (ผู้ป่วยเอง/ผู้ปกครอง/ญาติ ฯลฯ) + signature pad
  - พยาน: ชื่อ + signature pad
  - signature pad = canvas วาดเอง (port จาก transport/consent-prototype.html — ไม่ใช้ lib ภายนอก)
- การ์ด/แถว registry ที่มีใบปฏิเสธ active → badge แดง "ปฏิเสธการรักษา"
- ดูย้อนหลัง: modal แสดงใบ + ประวัติทุกเวอร์ชัน + ปุ่มพิมพ์
- พิมพ์: หน้าต่างใหม่ layout เอกสาร 2 ภาษา (หัวเอกสาร The Good + ข้อมูลผู้ป่วย + คำประกาศ TH/EN + ประเภทที่ปฏิเสธ + ลายเซ็นผู้ปฏิเสธ/พยาน + ชื่อเจ้าหน้าที่ + วันเวลา)

**หมายเหตุ:** ข้อความคำประกาศร่างโดย dev — ให้พยาบาล/เจ้าของตรวจความถูกต้องเชิงกฎหมายก่อนใช้จริง (แก้ข้อความได้ในโค้ดจุดเดียว: ค่าคงที่ `FA_REFUSAL_TEXT`)

## ตัดออกจากเฟสนี้
- ใบปฏิเสธในหน้า staff (part-time) · template แก้ได้ใน admin · แนบรูปในใบปฏิเสธ

## Deploy
- Client: git push (เวอร์ชัน 5.13.0, sw cache bump)
- SQL: Pex รัน `sql/create_fa_refusals.sql` ใน Dashboard เอง
