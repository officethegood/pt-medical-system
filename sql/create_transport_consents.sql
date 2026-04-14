-- =============================================
-- Transport Consents Table
-- เก็บประวัติ Consent ทุก version (ไม่ลบ ไม่ overwrite)
-- =============================================

CREATE TABLE IF NOT EXISTS transport_consents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,

  -- ข้อมูลผู้เซ็น
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_by TEXT,                    -- ชื่อผู้เซ็น
  relationship TEXT,                 -- ความสัมพันธ์กับผู้ป่วย (ผู้ป่วยเอง, คู่สมรส, บุตร ฯลฯ)

  -- ข้อมูลฟอร์มทั้งหมด
  consent_data JSONB,                -- snapshot ทุก field ในฟอร์ม
  signature_image TEXT,              -- base64 ลายเซ็น
  witness_name TEXT,                 -- ชื่อพยาน

  -- สถานะ
  status TEXT NOT NULL DEFAULT 'active',   -- active = ฉบับปัจจุบัน, superseded = ถูกแทนที่
  superseded_at TIMESTAMPTZ,               -- เวลาที่ถูกแทนที่
  superseded_reason TEXT,                  -- เหตุผลที่เซ็นใหม่

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('active', 'superseded', 'case_deleted'))
);

-- Index สำหรับ query ที่ใช้บ่อย
CREATE INDEX IF NOT EXISTS idx_consents_case_id ON transport_consents(case_id);
CREATE INDEX IF NOT EXISTS idx_consents_case_status ON transport_consents(case_id, status);

-- RLS (Row Level Security)
ALTER TABLE transport_consents ENABLE ROW LEVEL SECURITY;

-- Policy: ทุกคนอ่านได้ (authenticated + anon)
CREATE POLICY "Allow read access" ON transport_consents
  FOR SELECT USING (true);

-- Policy: ทุกคนเขียนได้ (สำหรับ prototype — production ควรจำกัดสิทธิ์)
CREATE POLICY "Allow insert access" ON transport_consents
  FOR INSERT WITH CHECK (true);

-- Policy: อัพเดทได้ (สำหรับ mark superseded)
CREATE POLICY "Allow update access" ON transport_consents
  FOR UPDATE USING (true);

-- ห้ามลบ (เก็บหลักฐานทุก version)
-- ไม่มี DELETE policy = ลบไม่ได้

COMMENT ON TABLE transport_consents IS 'เก็บประวัติ Consent ทุก version — ห้ามลบ ใช้ status superseded แทน';
COMMENT ON COLUMN transport_consents.version IS 'ลำดับฉบับ: 1, 2, 3... ฉบับล่าสุดคือ status=active';
COMMENT ON COLUMN transport_consents.consent_data IS 'JSON snapshot: {dnr: [...], destination, checklist, consenter_id, lang, ...}';
