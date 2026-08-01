# วิธีตั้งค่า Google Maps API Key ใหม่ (โปรเจกต์ thegood-maps)
> สำหรับ: เจ้าของบัญชี **officethegood@gmail.com**
> เหตุผล: key เดิมของระบบ PT-System อยู่ในโปรเจกต์ Google ที่ทีมไม่มีสิทธิ์เข้า และถูกเปลี่ยน restriction จนระบบค้นหาปลายทาง/แผนที่พังบางส่วน — จึงย้ายมาใช้โปรเจกต์ของเราเอง
> สถานะตอนนี้: โปรเจกต์ **`thegood-maps`** ถูกสร้างไว้แล้วใต้บัญชีนี้ เหลือทำตามขั้นตอนด้านล่าง (~10 นาที)

---

## ขั้นที่ 1: สมัคร Google Maps Platform + ผูกบัตร (ครั้งเดียว)

1. เปิด Chrome ที่ login **officethegood@gmail.com** แล้วเข้า:
   `https://console.cloud.google.com/google/maps-apis/start?project=thegood-maps`
2. ถ้าขึ้นหน้า "Try Google Maps Platform — Step 1 of 2":
   - Country: **Thailand** → กด **Agree & continue**
   - Step 2: กรอก**บัตรเครดิต/เดบิต**เพื่อยืนยันตัวตน
3. กดยืนยันจนจบ wizard

**เรื่องเงิน (สำคัญ ให้อ่านก่อนกลัว):**
- บัตรใช้ยืนยันตัวตนเท่านั้น — **Google จะไม่หักเงินอัตโนมัติ** จนกว่าเราจะกด upgrade เป็น paid account เอง
- ได้ฟรี **10,000 calls ต่อ API ต่อเดือน** + เครดิต $300 ใช้ได้ 90 วัน
- ปริมาณใช้งานของระบบเรา (ค้นหาปลายทาง/geocode วันละหลักสิบ-ร้อยครั้ง) อยู่ในโซนฟรีแบบเหลือเฟือ

---

## ขั้นที่ 2: เปิด API 5 ตัว

เข้าทีละลิงก์ → กดปุ่ม **Enable** (ถ้าขึ้น Enabled อยู่แล้วให้ข้าม):

1. Maps JavaScript API
   `https://console.cloud.google.com/apis/library/maps-backend.googleapis.com?project=thegood-maps`
2. Places API (New) — ⚠️ ต้องเป็นตัว **(New)** เท่านั้น
   `https://console.cloud.google.com/apis/library/places.googleapis.com?project=thegood-maps`
3. Directions API
   `https://console.cloud.google.com/apis/library/directions-backend.googleapis.com?project=thegood-maps`
4. Distance Matrix API
   `https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com?project=thegood-maps`
5. Geocoding API
   `https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com?project=thegood-maps`

---

## ขั้นที่ 3: สร้าง API Key + ตั้งข้อจำกัด

1. เข้า `https://console.cloud.google.com/apis/credentials?project=thegood-maps`
2. กด **+ Create credentials** → **API key** → จะได้ key ขึ้นมา (ขึ้นต้น `AIza...`) → **copy เก็บไว้**
3. กดชื่อ key ที่เพิ่งสร้าง (หรือปุ่ม Edit) แล้วตั้งค่า:
   - **Name:** `thegood-pt-web`
   - **Application restrictions:** เลือก **Websites** แล้วกด Add ใส่:
     ```
     https://officethegood.github.io/*
     ```
   - **API restrictions:** เลือก **Restrict key** แล้วติ๊ก 5 ตัวนี้ให้ครบ:
     - Maps JavaScript API
     - Places API (New)
     - Directions API
     - Distance Matrix API
     - Geocoding API
4. กด **Save** แล้วรอ 2–5 นาที (ให้ค่ามีผล)

---

## ขั้นที่ 4: เอา key ไปใส่ในระบบ PT-System

1. เข้าเว็บ `https://officethegood.github.io/pt-medical-system/admin.html` (login ด้วยบัญชี admin)
2. หัวข้อ **Map Provider** → ช่อง Google Maps API Key → **ลบตัวเก่า วาง key ใหม่**
3. กด **Save** แล้วกดปุ่ม **"เช็คทุก API"**
4. ✅ ต้องขึ้นผ่านครบ **5/5** (Maps JavaScript / Places New / Directions / Distance Matrix / Geocoding)

ถ้าตัวไหน FAIL: รอเพิ่มอีก 2–3 นาทีแล้วกดเช็คใหม่ · ถ้ายัง FAIL ให้กลับไปดูขั้นที่ 2 ว่า Enable ครบ 5 ตัว และขั้นที่ 3 ว่าติ๊ก API restrictions ครบ

---

## หมายเหตุ
- key เก่า (`AIzaSyBdsRC...`) ไม่ต้องไปยุ่ง — พอวาง key ใหม่ทับในหน้า Admin ระบบก็เลิกใช้ตัวเก่าเอง
- ห้ามเอา key นี้ไปใช้นอกโดเมน `officethegood.github.io` (ถูกล็อก referrer ไว้ ใช้ที่อื่นจะไม่ทำงาน — ตั้งใจให้เป็นแบบนั้นเพื่อกันคนขโมย key)
- ทำเสร็จแล้วแจ้งกลับทีมได้เลย เดี๋ยวมีการยิงทดสอบระบบซ้ำอีกรอบจากฝั่ง dev
