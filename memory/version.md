# Version Log — The Good System V.5 (pt-medical-system)
> กติกา: bump `APP_VERSION` ใน `shared/config.js` ทุกอัปเดตสำคัญ + จดสรุปที่นี่ 1 entry
> (รูปแบบ: เวอร์ชัน · วันที่ · commit · สรุปสั้น ๆ ว่าแก้อะไร/เพราะอะไร)

## 5.13.2 · 2026-08-03
- First Aid: รายงาน event (พิมพ์รายงาน) แสดง V/S ทุกรอบเป็น**แถวย่อยใต้ผู้ป่วยแต่ละคน** (ตารางเล็ก เวลา/BP/HR/RR/SpO2/Temp/GCS/DTX/Pain — เฉพาะคนที่มีบันทึก) (cache v23)

## 5.13.1 · 2026-08-03
- **ต้นตอจริงของ "อัปรูป First Aid ไม่ได้บนเครื่อง Apple":** service worker intercept POST ไป Cloudinary แล้ว WebKit ทำ FormData/ไฟล์ใน body หายตอนส่งต่อ → Cloudinary ได้ฟอร์มว่าง ("Upload preset must be specified") — ไม่ใช่ cache เก่าอย่างที่วินิจฉัยรอบแรก (Android/Chrome ไม่เป็นเพราะ forward body ถูกต้อง) · แก้: SW ไม่แตะ request ที่ไม่ใช่ GET อีกเลย (cache v22)

## 5.13.0 · 2026-08-03
- First Aid: **V/S บันทึกได้หลายรอบ** (Registry หน้าหลัก + หน้า staff) — แต่ละรอบมีเวลา + ชุดเดิม 8 ช่อง, ปุ่มเพิ่ม/ลบรอบ, หน้ารายละเอียดแสดงเป็นตาราง · เก็บใน `vitals_json.rounds` (JSONB เดิม ไม่ต้องรัน SQL) ข้อมูลเก่ารอบเดียวอ่านต่อได้
- First Aid: **ใบปฏิเสธการรักษา/นำส่ง 2 ภาษา (TH/EN)** — ตารางใหม่ `fa_refusals` (`sql/create_fa_refusals.sql` ต้องรันใน Dashboard), เซ็นบนจอ (ผู้ปฏิเสธ + พยาน), เก็บทุกฉบับไม่ทับ, badge แดงบนรายการ, ดู/พิมพ์ย้อนหลังได้ · spec: `docs/SPEC_firstaid_vitals_rounds_refusal_2026-08-03.md` (cache v21)

## 5.12.9 · 2026-07-26
- Transport/Monitor: GCS ในตาราง vitals แสดง `E4VVTM6` เมื่อ verbal = on tube — gcs_v เก็บค่า `'VT'` มาพร้อมตัว V แล้ว โค้ด print/monitor เติม `V` ซ้ำ (จุด GCS หลักเขียนถูกอยู่แล้ว) — แก้ 2 จุด: transport print vitals, monitor vitals table
- First Aid (ทั้ง 4 จุดอัปรูป: event/patient/registry/staff): รูปอัปโหลดไม่สำเร็จ**ไม่ทำให้งานทั้งใบพังอีกต่อไป** — บันทึกข้อมูลต่อ แล้วเตือน "เข้ามาแก้ไขเพิ่มรูปภายหลังได้" (ข้อเสนอภาคสนาม: เดิมต้องคีย์ใหม่ทั้งหมด) — เพิ่ม `uploadToCloudinarySafe()` ใน shared/cloudinary.js (cache v20)
- หมายเหตุเครื่องที่อัปรูปไม่ได้ค้างคา: ใช้ไอคอน Add to Home Screen ซึ่ง iOS แยก storage จาก Safari — ล้าง Safari ไม่ช่วย ต้องลบไอคอนแล้วเพิ่มใหม่

## 5.12.8 · 2026-07-25 · f337089
- Location: "ดึงพิกัดปัจจุบัน" เปลี่ยนจากรับ GPS fix แรก (มักหยาบจากเสา/WiFi เพี้ยน 50–500 ม. ซ้ำที่เดิม) → รอเก็บ fix ที่แม่นสุดสูงสุด 12 วิ หยุดเมื่อ ≤15 ม. + โชว์ "แม่นยำ ±X ม." + เตือนห้ามบันทึกถ้าหยาบกว่า 40 ม. (เคสจริง: หมุดลูกค้าตกซอยฝั่งตรงข้าม)

## 5.12.7 · 2026-07-25 · 2fbc69b
- SW: auto-reload ทุกแท็บหนึ่งครั้งเมื่อ service worker เวอร์ชันใหม่ activate — เครื่องภาคสนามที่ติด SW เก่าแบบ cache-first เสิร์ฟโค้ดเก่าค้าง จะได้โค้ดสดเองโดยผู้ใช้ไม่ต้องทำอะไร (cache v18)

## 5.12.6 · 2026-07-24 · 0a2f95c
- Cloudinary: resolve preset แบบมี fallback ชัดเจน + ถ้าว่างให้ throw ภาษาไทยพร้อมเลขเวอร์ชันของเครื่อง (ใช้วินิจฉัยเครื่องที่รันโค้ดเก่า) — จากเคส "Upload preset must be specified" หน้า First Aid (cache v17)

## 5.12.5 · 2026-07-24 · 69af89a
- SW: bump cache v16 บังคับล้าง cache เก่า — เครื่องผู้ใช้ส่ง upload_preset ว่างจากโค้ดเก่าค้าง cache

## 5.12.4 · 2026-07-18 · d61e9ae
- แก้ลิงก์แชร์ Google Maps รุ่นใหม่จากแอป (`?q=<ที่อยู่>&ftid=` — ไม่มีพิกัด) resolve ได้พิกัดมั่ว (จุดกลางแผนที่ตาม IP server = สิงคโปร์):
  - SQL `expand_maps_url` v3 (`sql/fix_expand_maps_url_v3_new_share_links.sql`): ใช้เฉพาะ marker เชื่อถือได้ + คืน `query_text` เมื่อลิงก์ไม่มีพิกัด · กับดัก PG: regex `{m,n}` ห้าม n>255
  - gps/location: รับพิกัด DMS (`13°40'36.7"N ...`), `query_text` → Geocoder ก่อน (Places หาที่อยู่ไทยเต็มรูปไม่เจอ/ผิดที่), guard ผลจาก RPC เก่า
- เปลี่ยน Google Maps API key → โปรเจกต์ `thegood-maps` (บัญชี officethegood@gmail.com) หลัง key เดิม (โปรเจกต์ 629012558533 — ไม่มีใครเข้าถึงได้) ถูกจำกัด API เหลือตัวเดียว (2026-07-24)

## 5.12.3 · 2026-05-25 · b9b331a
- GPS share: รับพิกัดดิบ "lat, lng" เป็นปลายทาง

## 5.12.2 · 83124ff
- GPS share: วางลิงก์ Google Maps เป็นปลายทาง

## 5.12.1 · aef9b6c
- GPS share: toggle โหมดแชร์ live-only vs ปลายทาง+ETA

## 5.12.0 · 645318a
- GPS share: ปลายทาง + live ETA บนลิงก์แชร์

## ก่อนหน้า
ดู `git log --oneline` — commit message เขียนละเอียดต่อเนื่องอยู่แล้ว
