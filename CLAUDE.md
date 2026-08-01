# The Good System V.5 (pt-medical-system — TheGood deployment)
> PT Medical System รุ่นปัจจุบันของ The Good: Transport + First Aid + Location (+GPS/Monitor) ย้ายจาก GAS/Sheets (V.4 = "PT System GAS") มาเป็น Supabase + GitHub Pages PWA

## ระบบคืออะไร / ทำอะไรได้
- **Transport** (`transport/`): บันทึกเคสส่งต่อผู้ป่วย, vitals, consent + witness signature, print, public link
- **First Aid** (`firstaid/`): event + registry ผู้ป่วยหน้างาน, staff token handoff (หน้า `firstaid/staff.html`)
- **Location** (`location/`): ทะเบียนพิกัดลูกค้า + share link
- **GPS** (`gps/`): live tracking + share link ปลายทาง+ETA (`gps/share.html`) — **ใช้งานจริงแล้ว** (v5.12.x มี feature แชร์ต่อเนื่อง; comment เก่าใน config ที่ว่า "TheGood ไม่ได้ใช้ GPS" ล้าสมัย)
- **Monitor** (`monitor/`), **admin** (`admin.html`), **status** (`status.html`)
- OCR บัตรประชาชน/เอกสารผ่าน Gemini (ผ่าน proxy) + แจ้งเตือนเหตุการณ์วิกฤต (arrest, SpO2 ต่ำ ฯลฯ) เข้า LINE/Telegram

## Stack & บริการภายนอก
- Static HTML + vanilla JS (ไม่มี build step), PWA (`manifest.json`, `sw.js`)
- Repo: `officethegood/pt-medical-system` → GitHub Pages `https://officethegood.github.io/pt-medical-system/`
- **Supabase:** `https://bztzsjuwyduveaqjvjma.supabase.co` (key ใน `shared/config.js`) — ตาราง: `cases`, `settings`, `activity_log`, `analytics`, `fa_events`, `fa_patients`, `fa_registry`, `loc_customers`, `loc_shared_tokens` (+ notifications, gps, tokens จากไฟล์ `sql/`) — RLS แบบ anon full CRUD (auth ทำที่ GAS ไม่ใช่ Supabase Auth)
- Auth: HR GAS กลาง `https://script.google.com/macros/s/AKfycbxV5tbmeFx8SxEENtFgHNhZJfM26QocQX1bfqSzxxOPFd_CSiRCINGE2FfXuRAVF-IYGw/exec`
- Cloudinary `ddummbyql` preset `pt-medical` (รูป First Aid/Location/logo)
- **Cloudflare Worker `thegood-ocr-proxy.officethegood.workers.dev`** — ซ่อน Gemini key (OCR) + notify proxy (LINE/Telegram) แชร์กับระบบ Stock · source ใน `cloudflare/`
- APP_VERSION ล่าสุดใน config: `5.12.3` (2026-05-25) — bump ทุกอัปเดตสำคัญ

## โครงสร้างไฟล์สำคัญ
- `shared/config.js` — URL/key/DEFAULTS ทั้งหมด (ค่า DEFAULTS ถูก override ได้จากตาราง `settings` ผ่าน `shared/settings.js`)
- `shared/` — auth.js, cloudinary.js, notify.js, realtime.js, map-config.js, gps-providers.js, places-api.js, styles.css
- `index.html` — landing/login · `transport/ firstaid/ location/ gps/ monitor/` — โมดูลละโฟลเดอร์
- `sql/` — SQL เพิ่มเติมที่รันใน Supabase หลัง setup แรก (append ไฟล์ใหม่ ไม่แก้เก่า)
- `supabase/functions/expand-url` + `migrations/001_expand_maps_url.sql` — ขยาย Google Maps short URL → lat/lng
- `migration/` — CSV export จาก GAS V.4 + `import.mjs` (ใช้ตอนย้ายข้อมูล เสร็จแล้ว)
- `cloudflare/` — worker source + `wrangler.toml`
- `docs/` — คู่มือ/manual (admin-manual.pdf, user-manual.pdf, NOTIFY_WEBHOOK_SETUP.md ฯลฯ) · `tools/` — สคริปต์ gen manual

## การทำงานหลักของระบบ
1. Login: client → HR GAS → เก็บ session ใน localStorage (`pt_user_meta` — แชร์กับ Stock)
2. ข้อมูลอ่าน/เขียนตรงกับ Supabase ผ่าน anon key (RLS เปิดกว้าง — ความปลอดภัยพึ่ง login gate ฝั่ง client + token ใน public link)
3. OCR/Notify: browser → Cloudflare Worker → Gemini / LINE / Telegram (ตั้งค่า notify ใน admin → ตาราง settings)
4. Deploy: `git push` → Pages · schema ใหม่ = เขียนไฟล์ใน `sql/` แล้ว paste ใน Supabase SQL Editor

## สถานะ
- **Active — เป็นระบบ PT หลักตัวจริงของ The Good** (commit ล่าสุด 2026-06-14) แทนที่ "PT System GAS" (GAS V.4)
- โค้ดต้นทางถูก clone มาจาก `supwilaimedical/pt-medical-system` ตาม SETUP_GUIDE แต่ deployment/บัญชีทั้งหมด (Supabase, Cloudinary, Worker, repo) เป็นของ The Good แยกจาก Supwilai เด็ดขาด

## Gotchas / ข้อควรระวัง
- **ห้ามสับสนกับโปรเจกต์ Supwilai** — org `supwilaimedical` / sheet `1e9-WFF...` / staff.supwilai.com ไม่ใช่ของเรา ห้ามแตะ (ดู `sql/restore_fa_bump_supply_after_supwilai_overwrite.sql` — เคยมีเหตุ overwrite ข้ามโปรเจกต์มาแล้ว)
- RLS เป็น anon full CRUD — อย่าเอา service key ไปไว้ฝั่ง client และระวังเวลาเพิ่มตารางใหม่ให้ตั้ง policy ตามแพตเทิร์นเดิม
- `GAS_AUTH_API_URL` ห้ามย้ายไปแก้ได้ใน admin (ระบุไว้ใน config: tamper แล้ว login พัง)
- GPS module ใช้งานจริงแล้ว (share link ปลายทาง+ETA) — DB function `expand_maps_url` บน Supabase เคย drift จากไฟล์ใน repo (แก้ผ่าน Dashboard ไม่บันทึกลงไฟล์) เวลา debug ให้ curl ทดสอบ RPC จริงก่อน
- แก้ Worker แล้วต้อง `wrangler deploy` แยกจาก git push (ดู `cloudflare/README.md`)

## เอกสารอื่นในโปรเจกต์
- `SETUP_GUIDE.md` — ติดตั้งระบบสำหรับบริษัทใหม่ (schema SQL เต็มอยู่ในนี้)
- `cloudflare/README.md`, `docs/NOTIFY_WEBHOOK_SETUP.md`, `docs/FIRSTAID_STAFF_TOKEN_HANDOFF.md`, `docs/MULTI_DEVICE_WORKFLOW.md`, manuals ใน `docs/`
