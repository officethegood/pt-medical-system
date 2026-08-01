# PT Medical System V.5 — Setup Guide
# คู่มือติดตั้งระบบสำหรับบริษัทใหม่

> ใช้เวลาประมาณ 30-60 นาที (ไม่รวม migration ข้อมูลเก่า)

---

## สิ่งที่ต้องเตรียม

| รายการ | หมายเหตุ |
|---|---|
| Email สำหรับสมัคร GitHub, Supabase, Cloudinary | ใช้ email บริษัทใหม่ |
| GAS Auth API URL | ถ้ามีระบบ V.4 อยู่แล้ว ดูจาก Config.gs |
| ชื่อบริษัท + เบอร์โทร | สำหรับ Settings |
| Logo บริษัท (ไฟล์ภาพ) | สำหรับ upload ขึ้น Cloudinary |

---

## Phase 1: สร้าง Accounts (3 อัน)

### 1.1 GitHub
1. ไป https://github.com → Sign up
2. สร้าง Repository ใหม่:
   - ชื่อ: `pt-medical-system`
   - Visibility: **Public** (จำเป็นสำหรับ GitHub Pages แบบ free)
   - ไม่ต้องติ๊ก README, .gitignore
3. จดไว้: **GitHub username** (เช่น `officethegood`)

### 1.2 Supabase
1. ไป https://supabase.com → Sign up
2. กด **New Project**:
   - Organization: สร้างใหม่หรือใช้ที่มี
   - Name: ตั้งชื่อตามบริษัท (เช่น `thegood-pt-medical`)
   - Database Password: ตั้งรหัสแล้ว **จดเก็บไว้**
   - Region: **Southeast Asia (Singapore)** ← สำคัญ!
3. รอ project สร้างเสร็จ (1-2 นาที)
4. ไปที่ **Settings → API** (หรือกด API Keys ในหน้าแรก)
5. จดค่า 2 ตัวนี้:
   - **Project URL** เช่น `https://xxxxxxxxxx.supabase.co`
   - **anon public key** (Publishable Key) เช่น `sb_publishable_xxxxx`

### 1.3 Cloudinary
1. ไป https://cloudinary.com → Sign up
2. จด **Cloud Name** จาก Dashboard (เช่น `dxxxxxxxxx`)
3. สร้าง Upload Preset:
   - ไป **Settings** (ไอคอนเฟือง) → **Upload** tab
   - หา **Upload Presets** → กด **+ Add Upload Preset**
   - Upload preset name: `pt-medical`
   - Signing Mode: **Unsigned**
   - กด **Save**

---

## Phase 2: Clone + Configure Code

### 2.1 Clone จาก Source Repo

เปิด Terminal/CMD แล้วรันคำสั่ง:

```bash
# เข้าไปในโฟลเดอร์ที่ต้องการเก็บ project
cd "F:/@Coding/ระบบ"

# Clone จาก Supwilai repo (ต้นฉบับ)
git clone https://github.com/supwilaimedical/pt-medical-system.git [ชื่อโฟลเดอร์ใหม่]

# เข้าไปในโฟลเดอร์
cd [ชื่อโฟลเดอร์ใหม่]
```

### 2.2 ตั้งค่า Git สำหรับบริษัทใหม่

```bash
# ลบ remote เดิม
git remote remove origin

# เพิ่ม remote ใหม่ (ใส่ username ของบริษัทใหม่)
git remote add origin https://[GITHUB_USERNAME]@github.com/[GITHUB_USERNAME]/pt-medical-system.git

# ตั้ง git user สำหรับ repo นี้
git config user.name "[GITHUB_USERNAME]"
git config user.email "[EMAIL]"
```

### 2.3 แก้ไขไฟล์ `shared/config.js`

เปิดไฟล์ `shared/config.js` แล้วแก้ค่าทั้งหมด:

```javascript
// PT Medical System — Configuration ([ชื่อบริษัท])
const CONFIG = {
  SUPABASE_URL: '[SUPABASE_PROJECT_URL]',           // จาก Phase 1.2
  SUPABASE_ANON_KEY: '[SUPABASE_ANON_KEY]',         // จาก Phase 1.2
  CLOUDINARY_CLOUD_NAME: '[CLOUDINARY_CLOUD_NAME]', // จาก Phase 1.3
  CLOUDINARY_UPLOAD_PRESET: 'pt-medical',            // ชื่อ Preset ที่สร้าง
  BASE_URL: '/pt-medical-system',                    // เปลี่ยนถ้า repo ชื่อต่าง
  GAS_AUTH_API_URL: '[GAS_AUTH_API_URL]'             // จาก Config.gs ของ V.4
};
```

### 2.4 Commit + Push

```bash
git add -A
git commit -m "Initial setup for [ชื่อบริษัท]"
git push -u origin main
```

> ถ้ามี popup ถาม password → ใส่ Personal Access Token (PAT) ของ GitHub account
> สร้าง PAT ได้ที่: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (scope: repo)

### 2.5 เปิด GitHub Pages

1. ไปที่ GitHub repo → **Settings → Pages**
2. Branch: เลือก **main** → folder: **/ (root)**
3. กด **Save**
4. รอ 1-2 นาที → เว็บจะพร้อมที่: `https://[USERNAME].github.io/pt-medical-system/`

---

## Phase 3: สร้าง Database (Supabase)

### 3.1 เปิด Extension

ไปที่ Supabase Dashboard → **Database → Extensions** → ค้นหา `http` → **Enable**

### 3.2 สร้าง Tables + RLS + Function

ไปที่ **SQL Editor** → กด **New query** → Copy SQL ทั้งหมดด้านล่างนี้ไป paste → กด **Run**

```sql
-- =============================================
-- PT Medical System — Full Database Setup
-- Copy ทั้งหมดนี้ไป run ใน Supabase SQL Editor
-- =============================================

-- 1. Cases (Transport)
CREATE TABLE cases (
  case_id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT now(),
  triage_level TEXT,
  op_info JSONB DEFAULT '{}',
  patient_info JSONB DEFAULT '{}',
  raw_data JSONB DEFAULT '{}',
  public_token TEXT,
  is_public BOOLEAN DEFAULT false,
  public_expiry TIMESTAMPTZ
);

-- 2. Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 3. Activity Log
CREATE TABLE activity_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT now(),
  username TEXT,
  role TEXT,
  action TEXT,
  target TEXT,
  details TEXT
);

-- 4. Analytics
CREATE TABLE analytics (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id TEXT,
  timestamp TIMESTAMPTZ,
  status TEXT,
  triage_level TEXT,
  patient_name TEXT,
  age INT,
  gender TEXT,
  hn TEXT,
  diagnosis TEXT,
  op_level TEXT,
  op_unit TEXT,
  from_location TEXT,
  to_location TEXT,
  has_ett BOOLEAN DEFAULT false,
  has_iv_drip BOOLEAN DEFAULT false,
  has_o2 BOOLEAN DEFAULT false,
  has_foley BOOLEAN DEFAULT false,
  has_chest_tube BOOLEAN DEFAULT false,
  vitals_bp TEXT,
  vitals_hr TEXT,
  vitals_rr TEXT,
  vitals_temp TEXT,
  vitals_o2sat TEXT
);

-- 5. First Aid: Events
CREATE TABLE fa_events (
  event_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  location TEXT,
  event_date DATE,
  status TEXT DEFAULT 'Active',
  created_by TEXT,
  image_url TEXT,
  start_time TEXT,
  end_date DATE,
  end_time TEXT,
  q_ammonia INT DEFAULT 0,
  q_plaster INT DEFAULT 0,
  q_spray INT DEFAULT 0,
  q_wound INT DEFAULT 0,
  q_meds INT DEFAULT 0,
  event_type TEXT DEFAULT 'general',
  event_config JSONB DEFAULT '{}'
);

-- 6. First Aid: Patients (legacy)
CREATE TABLE fa_patients (
  patient_id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES fa_events(event_id) ON DELETE CASCADE,
  name TEXT, phone TEXT, time_in TEXT, time_out TEXT,
  symptoms TEXT, treatment TEXT, allergy TEXT, note TEXT,
  image_url TEXT, gps TEXT, recorded_by TEXT,
  gender TEXT, age INT, triage TEXT
);

-- 7. First Aid: Registry
CREATE TABLE fa_registry (
  reg_id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES fa_events(event_id) ON DELETE CASCADE,
  triage TEXT, gender TEXT, age INT, name TEXT, phone TEXT,
  category TEXT, location_tx TEXT, time_in TEXT, time_out TEXT,
  etiology TEXT, cc TEXT, cc_other TEXT,
  problem TEXT, problem_other TEXT, treatment TEXT,
  allergy TEXT, vitals_json JSONB DEFAULT '{}',
  result TEXT, note TEXT, image_url TEXT, gps TEXT, recorded_by TEXT
);

-- 8. Location: Customers
CREATE TABLE loc_customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  district TEXT,
  details TEXT,
  photo_url TEXT,
  date_added TIMESTAMPTZ DEFAULT now(),
  province TEXT,
  customer_type TEXT DEFAULT 'ลูกค้าทั่วไป'
);

-- 9. Location: Shared Tokens
CREATE TABLE loc_shared_tokens (
  token TEXT PRIMARY KEY,
  customer_id TEXT,
  config JSONB DEFAULT '{}',
  expiry_date TIMESTAMPTZ,
  created_by TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT now(),
  note TEXT
);

-- =============================================
-- RLS + Anon full CRUD
-- (Auth ผ่าน GAS HR API ไม่ใช่ Supabase Auth)
-- =============================================
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE fa_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fa_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE fa_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE loc_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loc_shared_tokens ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cases','settings','activity_log','analytics',
    'fa_events','fa_patients','fa_registry',
    'loc_customers','loc_shared_tokens'
  ] LOOP
    EXECUTE format('CREATE POLICY "anon_select_%s" ON %I FOR SELECT TO anon USING (true)', t, t);
    EXECUTE format('CREATE POLICY "anon_insert_%s" ON %I FOR INSERT TO anon WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "anon_update_%s" ON %I FOR UPDATE TO anon USING (true)', t, t);
    EXECUTE format('CREATE POLICY "anon_delete_%s" ON %I FOR DELETE TO anon USING (true)', t, t);
  END LOOP;
END $$;

-- =============================================
-- Function: expand_maps_url
-- (ขยาย Google Maps short URL → ดึง lat/lng)
-- =============================================
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.expand_maps_url(short_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  response RECORD;
  body TEXT;
  resolved_url TEXT;
  coord_match TEXT[];
  p TEXT;
  patterns TEXT[] := ARRAY[
    '/search/([-]?[0-9]+\.[0-9]{4,})[,%%2C%%20+]+([-]?[0-9]+\.[0-9]{4,})',
    '/place/[^/]+/@([-]?[0-9]+\.[0-9]{4,}),([-]?[0-9]+\.[0-9]{4,})',
    '!3d([-]?[0-9]+\.[0-9]{4,})!4d([-]?[0-9]+\.[0-9]{4,})',
    '@([-]?[0-9]+\.[0-9]{4,}),([-]?[0-9]+\.[0-9]{4,})',
    '[?&]q=([-]?[0-9]+\.[0-9]{4,}),([-]?[0-9]+\.[0-9]{4,})',
    'center=([-]?[0-9]+\.[0-9]{4,})[,%%2C]+([-]?[0-9]+\.[0-9]{4,})'
  ];
BEGIN
  SELECT * INTO response FROM http_get('https://unshorten.me/json/' || short_url);
  body := COALESCE(response.content, '');
  BEGIN
    resolved_url := body::JSONB->>'resolved_url';
  EXCEPTION WHEN OTHERS THEN
    resolved_url := '';
  END;
  resolved_url := COALESCE(resolved_url, '');
  resolved_url := replace(resolved_url, '%2B', '+');
  resolved_url := replace(resolved_url, '%2C', ',');
  resolved_url := replace(resolved_url, '%2F', '/');
  resolved_url := replace(resolved_url, '%3A', ':');
  resolved_url := replace(resolved_url, '%253D', '=');
  resolved_url := replace(resolved_url, '%3D', '=');
  resolved_url := replace(resolved_url, '%26', '&');
  IF resolved_url != '' THEN
    FOREACH p IN ARRAY patterns LOOP
      coord_match := regexp_match(resolved_url, p);
      IF coord_match IS NOT NULL THEN
        IF (coord_match[1]::NUMERIC BETWEEN -90 AND 90)
           AND (coord_match[2]::NUMERIC BETWEEN -180 AND 180) THEN
          RETURN jsonb_build_object('success', true,
            'lat', ROUND(coord_match[1]::NUMERIC, 6)::TEXT,
            'lng', ROUND(coord_match[2]::NUMERIC, 6)::TEXT);
        END IF;
      END IF;
    END LOOP;
  END IF;
  FOREACH p IN ARRAY patterns LOOP
    coord_match := regexp_match(body, p);
    IF coord_match IS NOT NULL THEN
      IF (coord_match[1]::NUMERIC BETWEEN -90 AND 90)
         AND (coord_match[2]::NUMERIC BETWEEN -180 AND 180) THEN
        RETURN jsonb_build_object('success', true,
          'lat', ROUND(coord_match[1]::NUMERIC, 6)::TEXT,
          'lng', ROUND(coord_match[2]::NUMERIC, 6)::TEXT);
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success', false, 'message', 'ไม่พบพิกัดในลิงก์', 'resolved_url', resolved_url);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expand_maps_url(TEXT) TO anon, authenticated;
```

### 3.3 ใส่ Settings เริ่มต้น

Run SQL นี้ต่อใน SQL Editor (แก้ค่าตามบริษัทใหม่):

```sql
INSERT INTO settings (key, value) VALUES
  ('APP_LOGO_URL', '[URL_LOGO_จาก_CLOUDINARY]'),
  ('APP_LOGO_BASE64', ''),
  ('PRINT_HEADER', '[ชื่อบริษัท] - Patient Transport Record    Call : [เบอร์โทร]'),
  ('FA_COMPANY_NAME', '[ชื่อบริษัท]'),
  ('FA_COMPANY_CONTACT', '[เบอร์โทร]');
```

> **วิธี upload logo:** ถ้ามี logo เป็นไฟล์ภาพ ให้เปิดระบบแล้ว upload ผ่าน Admin Settings
> หรือ upload ผ่าน Cloudinary Dashboard แล้วเอา URL มาใส่

---

## Phase 4: ทดสอบระบบ

เปิด `https://[USERNAME].github.io/pt-medical-system/` แล้วทดสอบ:

| ทดสอบ | วิธี | ผลที่ควรได้ |
|---|---|---|
| Login | ใส่ username/password จาก GAS HR API | เข้า Portal สำเร็จ |
| Transport | สร้าง case ใหม่ → edit → close | ข้อมูลบันทึกได้ |
| First Aid | สร้าง event → เพิ่ม registry | ข้อมูลบันทึกได้ |
| Location | เพิ่ม customer → ดูแผนที่ | pin แสดงบนแผนที่ |
| Image upload | upload รูปใน First Aid / Location | รูปขึ้น Cloudinary |
| Monitor | กดเข้า Monitor (admin only) | เห็น dashboard |
| PWA | กด Install (มุมขวาบน) | ติดตั้งบนมือถือ/desktop |

---

## Phase 5: Migration ข้อมูลจาก V.4 (ถ้ามี)

> ข้ามได้ถ้าเป็นระบบใหม่ที่ไม่มีข้อมูลเก่า

### 5.1 Export CSV จาก Google Sheets

เปิด Google Sheets ของ V.4 แล้ว download แต่ละ sheet เป็น CSV:

**Patient Transport** (ดู SPREADSHEET_ID จาก Config.gs):
- Sheet `Cases` → File → Download → CSV
- Sheet `Settings` → (ข้ามได้ ถ้าใส่ Settings ใน Phase 3.3 แล้ว)
- Sheet `ActivityLog` → CSV
- Sheet `Analytics` → CSV

**First Aid** (ดู FA_SPREADSHEET_ID จาก Config.gs):
- Sheet `Events` → CSV
- Sheet `Patients` → CSV
- Sheet `Registry` → CSV

**PT Location** (ดู LOC_SPREADSHEET_ID จาก Config.gs):
- Sheet `Customers` → CSV
- Sheet `SharedTokens` → CSV

### 5.2 Run Migration Script

1. วาง CSV ทั้งหมดไว้ใน `C:\Users\[USERNAME]\Downloads\`
2. แก้ไขไฟล์ `migration/import.mjs`:
   - แก้ `SUPABASE_URL` + `SUPABASE_KEY` เป็นของบริษัทใหม่
   - แก้ `CSV_DIR` เป็น path ที่วาง CSV
   - แก้ชื่อไฟล์ CSV ให้ตรงกับที่ download มา
3. รันคำสั่ง:

```bash
cd [โฟลเดอร์ project]
npm install csv-parse @supabase/supabase-js
node migration/import.mjs
```

4. ตรวจผลลัพธ์ — ทุก table ควรแสดง "Inserted X/X" ไม่มี error

### 5.3 รูปภาพ

- **รูปจาก Google Drive** → script แปลง URL เป็น thumbnail อัตโนมัติ ใช้ได้เลย
- **Logo บริษัท** → upload ขึ้น Cloudinary แล้วใส่ URL ใน settings table (key: `APP_LOGO_URL`)
- **รูปใหม่ในอนาคต** → upload ผ่าน Cloudinary อัตโนมัติ

---

## Checklist สรุป

- [ ] GitHub: สร้าง account + repo + เปิด Pages
- [ ] Supabase: สร้าง project + จด URL + anon key
- [ ] Cloudinary: สร้าง account + Unsigned Preset `pt-medical`
- [ ] Code: Clone → แก้ `shared/config.js` → Push
- [ ] Database: Run SQL สร้าง tables + RLS + function
- [ ] Settings: ใส่ชื่อบริษัท + logo + เบอร์โทร
- [ ] ทดสอบ: Login + ทดสอบทุก module
- [ ] Migration: (ถ้ามี V.4) Export CSV → Run import.mjs
- [ ] GitHub Pages: ตั้ง Branch = main

---

## ค่าที่ต้องเตรียมสำหรับแต่ละบริษัท (Summary)

```
SUPABASE_URL        = ___________________________
SUPABASE_ANON_KEY   = ___________________________
CLOUDINARY_CLOUD    = ___________________________
CLOUDINARY_PRESET   = pt-medical
GITHUB_USERNAME     = ___________________________
GITHUB_EMAIL        = ___________________________
GAS_AUTH_API_URL    = ___________________________
COMPANY_NAME        = ___________________________
COMPANY_CONTACT     = ___________________________
LOGO_URL            = ___________________________
```

---

## Troubleshooting

| ปัญหา | สาเหตุ | แก้ไข |
|---|---|---|
| Login ไม่ได้ | GAS Auth API URL ผิด | ตรวจ URL ใน config.js |
| ข้อมูลไม่ขึ้น | Supabase URL/Key ผิด | ตรวจ config.js |
| รูปไม่ขึ้น | Cloudinary preset ไม่ถูก | ตรวจว่า preset เป็น Unsigned |
| GitHub Pages 404 | ยังไม่ตั้ง Pages หรือ branch ผิด | Settings → Pages → main |
| Push ถูก deny | Git credentials ผิด account | ใช้ PAT ของ account ที่ถูกต้อง |
| fa_registry error | event_id ไม่มีใน fa_events | สร้าง placeholder event ก่อน |
| แผนที่ไม่ทำงาน | Extension http ไม่เปิด | Database → Extensions → เปิด http |
