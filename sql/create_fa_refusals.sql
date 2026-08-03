-- =============================================
-- First Aid: Refusal of Treatment/Transfer (ใบปฏิเสธการรักษา/นำส่ง)
-- 2026-08-03 · ดู docs/SPEC_firstaid_vitals_rounds_refusal_2026-08-03.md
-- เก็บทุก version ไม่ลบ (แบบเดียวกับ transport_consents)
-- วิธีใช้: วางทั้งไฟล์ใน Supabase Dashboard → SQL Editor → Run
-- =============================================

CREATE TABLE IF NOT EXISTS fa_refusals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reg_id TEXT NOT NULL,                    -- อ้างถึง fa_registry.reg_id (ไม่ใส่ FK — registry ลบได้แต่ใบปฏิเสธต้องอยู่)
  event_id TEXT,                           -- อ้างถึง fa_events.event_id
  version INT NOT NULL DEFAULT 1,

  -- ประเภทที่ปฏิเสธ (เลือกได้หลายข้อ) + รายละเอียด
  refuse_transfer BOOLEAN DEFAULT false,   -- ปฏิเสธนำส่งโรงพยาบาล
  refuse_procedure BOOLEAN DEFAULT false,  -- ปฏิเสธหัตถการที่แนะนำ
  refuse_other BOOLEAN DEFAULT false,      -- อื่นๆ
  refusal_detail TEXT,                     -- รายละเอียดเพิ่มเติม / ระบุหัตถการ

  -- snapshot ข้อมูลผู้ป่วย ณ เวลาที่เซ็น (registry แก้ทีหลังไม่กระทบใบ)
  patient_snapshot JSONB,                  -- {name, age, gender, phone, triage, cc, treatment}

  -- ผู้เซ็นปฏิเสธ
  signed_by TEXT,                          -- ชื่อผู้เซ็น
  relationship TEXT,                       -- ผู้ป่วยเอง / ผู้ปกครอง / ญาติ ฯลฯ
  signature_image TEXT,                    -- base64 ลายเซ็นผู้ปฏิเสธ

  -- พยาน
  witness_name TEXT,
  witness_signature_image TEXT,            -- base64 ลายเซ็นพยาน

  staff_name TEXT,                         -- เจ้าหน้าที่ผู้อธิบาย/บันทึก
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- versioning: เซ็นใหม่ = แถวใหม่ version+1, แถวเก่า → superseded
  status TEXT NOT NULL DEFAULT 'active',
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fa_refusals_valid_status CHECK (status IN ('active', 'superseded'))
);

CREATE INDEX IF NOT EXISTS idx_fa_refusals_reg ON fa_refusals(reg_id);
CREATE INDEX IF NOT EXISTS idx_fa_refusals_reg_status ON fa_refusals(reg_id, status);
CREATE INDEX IF NOT EXISTS idx_fa_refusals_event ON fa_refusals(event_id);

ALTER TABLE fa_refusals ENABLE ROW LEVEL SECURITY;

-- pattern เดียวกับตาราง fa อื่น: anon อ่าน/เขียน/อัปเดตได้ ห้ามลบ (ไม่มี DELETE policy)
CREATE POLICY "Allow read access" ON fa_refusals
  FOR SELECT USING (true);
CREATE POLICY "Allow insert access" ON fa_refusals
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access" ON fa_refusals
  FOR UPDATE USING (true);

COMMENT ON TABLE fa_refusals IS 'ใบปฏิเสธการรักษา/นำส่ง First Aid — เก็บทุก version ห้ามลบ (status superseded แทน)';
