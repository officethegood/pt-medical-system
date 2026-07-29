# Version Log — The Good System V.5 (pt-medical-system)
> กติกา: bump `APP_VERSION` ใน `shared/config.js` ทุกอัปเดตสำคัญ + จดสรุปที่นี่ 1 entry
> (รูปแบบ: เวอร์ชัน · วันที่ · commit · สรุปสั้น ๆ ว่าแก้อะไร/เพราะอะไร)

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
