# Fix Log: ลิงก์ Google Maps รุ่นใหม่ resolve ผิดพิกัด + รองรับพิกัด DMS
> 2026-07-18 · The Good System V.5 (`officethegood/pt-medical-system`) commit `d61e9ae` · แก้โดย Claude
> **สำหรับทีม Supwilai:** โค้ดตระกูลเดียวกัน (`supwilaimedical/pt-medical-system`) มีบั๊กเดียวกัน — เอา log นี้ไปปรับใช้กับ repo + Supabase ของตัวเองได้เลย

## อาการ
1. วางลิงก์ย่อ `maps.app.goo.gl/...` เป็นปลายทาง (GPS share / Location) แล้ว **พิกัดผิดไปไกลมาก** (ไปโผล่สิงคโปร์) หรือ resolve ไม่ได้เลย — เฉพาะลิงก์แชร์จากแอปมือถือรุ่นใหม่ (สังเกต `g_st=ic` ท้ายลิงก์) ลิงก์เก่ายังปกติ
2. วางพิกัดแบบ DMS `13°40'36.7"N 100°37'44.0"E` (รูปแบบที่ Google Maps ให้ copy) ในช่องค้นหาปลายทาง → error `Places API (400): Coordinates are not a valid input`

## Root cause
1. **ลิงก์แชร์รุ่นใหม่ไม่มีพิกัดเลย** — redirect ไป `maps.google.com/?q=<ข้อความที่อยู่>&ftid=...` (ไม่มี lat/lng ทั้งใน URL และใน HTML แบบไม่รัน JS)
   ฟังก์ชัน `expand_maps_url` (Supabase RPC) เดิม grep ตัวเลขจาก **HTML ทั้งหน้า** ด้วย pattern หลวม (`@lat,lng`, `center=`, เลขลอยๆ) → ไปจับ "จุดกลางแผนที่ตาม IP ของเครื่องที่ fetch" ซึ่ง Supabase อยู่สิงคโปร์ → ตอบ `success:true` พร้อม `1.314, 103.844` อย่างมั่นใจ
2. **client ไม่รู้จัก DMS** — parser รับแค่ทศนิยม `13.75, 100.51` ข้อความ DMS เลยหลุดไป Places searchText ซึ่ง Google ปฏิเสธ
3. บั๊กแฝงที่เจอระหว่างเทสต์: Places searchText **หาที่อยู่ไทยเต็มรูปไม่เจอ** (หรือเจอผิดที่ ห่าง ~4 กม.) — ต้องใช้ Google Geocoder (Maps JS SDK) กับข้อความที่อยู่ ถึงได้ระดับ ROOFTOP

## สิ่งที่แก้

### 1) SQL — `sql/fix_expand_maps_url_v3_new_share_links.sql` (รันใน Supabase SQL Editor)
เขียน `expand_maps_url` ใหม่ (v3):
- ใช้เฉพาะ pattern ที่ยึด marker เชื่อถือได้: DMS (ทั้ง `°'"` จริงและ `%C2%B0/%27/%22`), `!3d..!4d..`, `q=lat,lng` (รวม `%2C`), `/search/`, `ll=`, `daddr/saddr/destination=` — ใช้ `[?&;]` นำหน้า param เพราะใน HTML ลิงก์ถูก escape เป็น `&amp;q=`
- **ตัด `@lat,lng` / `center=` / เลขลอยๆ ออกจากการ grep body** ← ต้นเหตุพิกัดสิงคโปร์
- ลิงก์แบบใหม่ที่ไม่มีพิกัด: ดึง "ข้อความที่อยู่" จาก JSON blob ในหน้า (คู่ `["0x<ftid>","<ที่อยู่>"]`) คืนเป็น `{"success":false, "query_text":"<ที่อยู่>"}` ให้ client ไปแปลงต่อ
- เลิกคืน HTML ทั้งก้อนใน `resolved_url` (เดิม client เอาไป regex แล้วได้เลขมั่ว)
- ⚠️ กับดัก PostgreSQL: quantifier `{m,n}` จำกัด n ≤ 255 — ใช้ `{2,300}` แล้วฟังก์ชันพังทั้งเส้น ("invalid repetition count(s)") ต้องใช้ `{2,200}`

### 2) Client — `gps/index.html` (หน้าเลือกปลายทางตอนสร้างลิงก์แชร์)
- เพิ่ม `gpsParseDMS()` — รับ `13°40'36.7"N 100°37'44.0"E` (รวม `′″`, ตัวเล็ก, คั่น comma) ในช่องค้นหาปลายทาง
- `gpsParseMapsUrl()` ลอง decode + parse DMS ใน URL ก่อน pattern ทศนิยม
- เพิ่ม `shareDestFromQueryText()` — รับ `query_text` จาก RPC แล้วแปลงด้วย **google.maps.Geocoder ก่อน** (region TH) ได้ ROOFTOP; ถ้า geocode ไม่ได้ค่อยตกไป Places searchText ให้ผู้ใช้เลือกจากรายการ
- Guard 2 ชั้น: (ก) `resolved_url` จาก RPC เก่าที่เป็น HTML ทั้งหน้า → ไม่เอามา regex (ยาวเกิน 2048 หรือมี `<` = ทิ้ง) (ข) ข้อความที่หน้าตาเป็นพิกัดแต่พิมพ์ยังไม่ครบ → ไม่ยิง Places (กัน 400 เด้งระหว่างพิมพ์)
- `gps/share.html` (หน้าคนรับลิงก์) ไม่ต้องแก้ — อ่าน `dest_lat/dest_lng` จาก token อย่างเดียว

### 3) Client — `location/index.html` (ทะเบียนพิกัดลูกค้า)
- เพิ่ม `loc_parseDMS()` + DMS-first ใน `loc_parseGoogleMapsUrl()` (วาง DMS ในช่องลิงก์ได้เลย)
- เพิ่ม `loc_geocodeQueryText()` — `query_text` จาก RPC → Geocoder → เติม lat/lng อัตโนมัติ
- Guard `resolved_url` แบบเดียวกับ gps

### 4) อื่นๆ
- `shared/config.js` — bump `5.12.3` → `5.12.4`
- `supabase/migrations/001_expand_maps_url.sql` — แปะป้าย DEPRECATED กันเผลอรันเวอร์ชันบั๊กทับ

## จุดต่างที่ฝั่ง Supwilai ต้องระวัง
- **Supabase คนละโปรเจกต์** — ต้องรัน SQL ใน SQL Editor ของโปรเจกต์ตัวเอง (อย่ารันข้ามฝั่ง)
- โครง client ฝั่ง Supwilai ไม่เหมือน 100%: logic วางลิงก์อยู่ที่ `shared/places-api.js` → `decodeGoogleMapsLink()` / `parseMapsUrlPatterns()` และ `v2/location/index.html` — ต้อง port แนวคิดเดียวกัน (DMS-first, `query_text` → Geocoder, guard `resolved_url`) ไม่ใช่ copy ไฟล์ทับ
- ฟังก์ชัน `expand_maps_url` ที่ deploy จริงอาจ**ไม่ตรงกับไฟล์ใน repo** (เคยถูกแก้ผ่าน Dashboard โดยไม่บันทึกลงไฟล์) — เช็คของจริงด้วย curl ก่อนสรุปอะไร

## วิธีทดสอบ (ใช้ยืนยันได้ทั้งสองฝั่ง)
```sql
-- ใน SQL Editor หลังรัน v3
SELECT expand_maps_url('https://maps.app.goo.gl/GdoLF7zEJg982Q2y7');
-- คาด: success:true, 15.700068, 100.145806 (ลิงก์แบบเก่า)
SELECT expand_maps_url('https://maps.app.goo.gl/4tVhHfEC8uJgH7yW8');
-- คาด: success:false + query_text:"36 ซอย นวมินทร์ 163 ..." (ลิงก์แบบใหม่)
```
จากนั้นบนหน้าเว็บ: วางลิงก์แบบใหม่ในช่องปลายทาง → ต้องได้ปลายทางอัตโนมัติ (เคสตัวอย่างนี้ = 13.835788, 100.658118 ระดับ ROOFTOP ตรงหมุดจริง)

## ผลทดสอบฝั่ง The Good (ยืนยันแล้ว)
- SQL v3: 7/7 เคสผ่านบน PostgreSQL 17 (mock http_get ด้วย HTML จริงจาก Google) — รวมเคส "หน้า HTML มีแต่ center สิงคโปร์" ที่ต้องไม่หลอกว่า success
- Client: 15 เคสผ่าน (DMS ทุก variant, URL ทุกรูปแบบ, query_text, guards)
- End-to-end บนเว็บจริง: ลิงก์ตัวอย่าง → query_text → Geocoder → พิกัดตรงหมุด ROOFTOP
