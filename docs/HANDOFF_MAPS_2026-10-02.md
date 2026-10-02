# Handoff: ระบบแผนที่ทั้งหมดของ The Good System V.5
> อัปเดต 2026-10-02 · ครอบคลุมงาน map ทั้งสาย ก.ค.–ต.ค. 2026 (v5.12.4 → v5.13.5)
> สำหรับ: dev/AI session ถัดไปที่ต้องแตะเรื่องแผนที่ — อ่านไฟล์นี้ก่อนแก้อะไรที่เกี่ยวกับ map

---

## 1. ภาพรวม — แผนที่ใน V.5 ใช้ 3 บริการ

| บริการ | ใช้ที่ไหน | key/บัญชี |
|---|---|---|
| **Google Maps Platform** | หน้า GPS หลัก, Location, Monitor (tiles + Places + Geocoder + Directions + Distance Matrix) | โปรเจกต์ `thegood-maps` บัญชี `officethegood@gmail.com` |
| **Cartrack Fleet API** | ตำแหน่งรถ TG1–TG6 แบบ real-time | account `GOOD00018` (เก็บในตาราง `gps_providers`) |
| **OpenStreetMap tiles** | หน้าแชร์สาธารณะ (`gps/share.html`, `location/share.html`) + fallback ใน `shared/map-config.js` | ฟรี ไม่มี key |

Supabase ของ The Good: `bztzsjuwyduveaqjvjma` · anon key อยู่ใน `shared/config.js`

---

## 2. Google Maps API key (ตั้งแต่ 2026-07-24)

- **Key ไม่อยู่ในโค้ด** — เก็บในตาราง `settings` key `GOOGLE_MAPS_API_KEY` (แก้ผ่านหน้า Admin → Map Provider)
- โปรเจกต์ Google Cloud: **`thegood-maps`** ใต้ `officethegood@gmail.com` · เปิด 5 APIs: Maps JavaScript / Places (New) / Directions / Distance Matrix / Geocoding · restrict referrer `https://officethegood.github.io/*`
- ตรวจสุขภาพ: หน้า Admin → Map Provider → ปุ่ม **"เช็คทุก API"** ต้องได้ 5/5
- **ประวัติ:** key เดิมอยู่โปรเจกต์ `629012558533` ที่ไม่มีบัญชีไหนของทีมเข้าถึงได้ แล้ววันหนึ่งถูกจำกัด API เหลือตัวเดียวจนระบบพัง — เลิกใช้ถาวร ห้ามกลับไปใช้

## 3. การ resolve ลิงก์ Google Maps → พิกัด (ปลายทาง GPS share / Location)

Flow: ลิงก์ย่อ `maps.app.goo.gl` → RPC `expand_maps_url` (Supabase) → ถ้าได้พิกัดใช้เลย / ถ้าลิงก์รุ่นใหม่ (ไม่มีพิกัด) ได้ `query_text` กลับมา → client geocode ด้วย `google.maps.Geocoder` (อย่าใช้ Places searchText กับที่อยู่ไทยเต็มรูป — หาไม่เจอ/ผิดที่ พิสูจน์แล้ว)

- SQL ตัวจริง: `sql/fix_expand_maps_url_v3_new_share_links.sql` (v3) — ใช้เฉพาะ marker เชื่อถือได้ ห้าม grep HTML ทั้งหน้า (เคยได้พิกัดสิงคโปร์จาก map center ตาม IP server)
- รับพิกัด DMS (`13°40'36.7"N 100°37'44.0"E`) ได้ทั้งพิมพ์ตรงและใน URL — parser อยู่ใน `gps/index.html` (`gpsParseDMS`) และ `location/index.html` (`loc_parseDMS`) keep in sync
- ⚠️ **Deployed function บน Supabase เคย drift จากไฟล์ repo** (มีคนแก้ผ่าน Dashboard) — debug ให้ curl RPC จริงก่อนเสมอ:
  ```
  ลิงก์เก่า https://maps.app.goo.gl/GdoLF7zEJg982Q2y7  → success:true 15.700068,100.145806
  ลิงก์ใหม่ https://maps.app.goo.gl/4tVhHfEC8uJgH7yW8  → success:false + query_text "36 ซอย นวมินทร์..."
  ```
- กับดัก PG: regex quantifier `{m,n}` ห้าม n > 255

## 4. Fleet GPS (Cartrack)

- ตาราง `gps_vehicles`: `device_id` = **ทะเบียนรถใน Cartrack** (ภาษาไทย เช่น `ฮล8597`) · `gps_providers`: มี base_url/account/**password** ของ Cartrack
- **เคสจริง 2026-09-09:** TG 3 (DENZA EV ใหม่) OFFLINE ตลอด เพราะ device_id ค้างเป็น `NULL5200ALV` (sync ตอนรถยังไม่มีทะเบียนใน Cartrack) → แก้เป็นทะเบียนจริง `7ขส1646` แล้วหาย
- **กติกากันเกิดซ้ำ: รถใหม่/เปลี่ยนทะเบียนใน Cartrack = ต้องอัปเดต `device_id` ใน `gps_vehicles` ด้วยเสมอ**
- ระวัง encoding: PATCH ค่าทะเบียนไทยผ่าน curl บน Windows ต้องส่ง body เป็นไฟล์ UTF-8 (`--data-binary @file`) ไม่งั้นไทยกลายเป็น `?`
- GPS proxy chain (Synology/Render/GAS) **ปิดหมด** (`*_ENABLED=0`) — Cartrack เรียกตรงจาก browser · ค่าขยะใน settings: `GPS_PROXY_SYNOLOGY="TG1"` (มีคนกรอกผิดช่อง ควรลบ แต่ไม่มีผลเพราะปิดอยู่)

## 5. Map tiles

- **หน้า GPS หลัก / Location / Monitor:** Google tiles ผ่าน `MapConfig` (`shared/map-config.js`)
- **หน้าแชร์สาธารณะ + fallback:** OpenStreetMap `https://tile.openstreetmap.org/{z}/{x}/{y}.png` — เปลี่ยนจาก Carto เมื่อ **2026-10-02** เพราะ Carto บังคับ API key (อาการ: ลายน้ำ "API KEY REQUIRED" เต็มแผนที่)
- OSM ฟรีแบบมีมารยาท: ปริมาณเราโอเค แต่ถ้าอนาคตผู้ชมเยอะมากให้พิจารณา provider อื่น/Google

## 6. ความแม่นพิกัด (หน้า Location)

ปุ่ม "ดึงพิกัดปัจจุบัน" ใช้ `watchPosition` เก็บ fix ที่แม่นสุดสูงสุด 12 วิ (หยุดเมื่อ ≤15 ม.) + โชว์ "แม่นยำ ±X ม." + เตือนห้ามบันทึกถ้าหยาบกว่า 40 ม. — **อย่าเปลี่ยนกลับเป็น getCurrentPosition fix แรก** (บน Android มาจากเสา/WiFi เพี้ยน 50–500 ม. ซ้ำที่เดิม — เคสจริง: หมุดลูกค้าตกซอยฝั่งตรงข้าม)

## 7. งานค้าง / ความเสี่ยงที่รู้แล้วแต่ยังไม่ได้ทำ

1. **`gps_providers.password` (Cartrack) อ่านได้ด้วย anon key** — เท่ากับ public ใครรู้ URL Supabase ก็ดึงได้ ควรย้ายไป proxy/Edge Function ในอนาคต
2. ลบค่าขยะ `GPS_PROXY_SYNOLOGY="TG1"` ใน settings (ผ่านหน้า Admin)
3. event "(Recovered Event)" ใน First Aid ยัง location=null — ควรเติมข้อมูลจริง (เคยทำช่องค้นหาพังมาแล้ว โค้ดกันไว้แล้วแต่ข้อมูลควรสะอาด)
4. ฝั่ง **Supwilai pt-medical-system** ใช้โค้ดตระกูลเดียวกัน — บั๊ก map ชุดนี้ (ลิงก์รุ่นใหม่, Carto tiles, GPS fix แรก) น่าจะมีเหมือนกัน แจ้งทีมโน้นแล้วบางส่วน (fix log ใน `docs/FIX_LOG_maps_link_dms_2026-07-18.md`) — **ห้ามแก้ข้ามโปรเจกต์โดยไม่ได้รับสั่ง**

## 8. วิธี verify เร็ว ๆ หลังแก้อะไรก็ตาม

1. `curl` RPC 2 ลิงก์ตัวอย่าง (ข้อ 3) — ตรวจ resolve
2. เปิด `officethegood.github.io/pt-medical-system/admin.html` → เช็คทุก API → 5/5
3. หน้า GPS: เลือกรถ → วางลิงก์ย่อเป็นปลายทาง → ต้องได้หมุดถูกจุด + ETA
4. หน้าแชร์: หา token active จาก `gps_shared_tokens` → เปิด `gps/share.html?token=...` → แผนที่ต้องเต็มใบไม่มีลายน้ำ + สถานะรถถูก
5. เวอร์ชันปัจจุบันดูที่ footer หน้า login / `memory/version.md` (log ทุกเวอร์ชัน)

## เอกสารเกี่ยวข้อง
- `memory/version.md` — log ทุกเวอร์ชัน · `docs/FIX_LOG_maps_link_dms_2026-07-18.md` — fix log ฉบับส่ง Supwilai
- `docs/SETUP_GOOGLE_MAPS_KEY_2026-07.md` — ขั้นตอนสร้าง key (ทำไปแล้ว เก็บไว้อ้างอิง)
