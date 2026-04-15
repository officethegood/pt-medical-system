-- =============================================
-- GPS Share Token — Camera permission flag
-- Run this in Supabase SQL Editor (both supwilai + thegood)
-- =============================================

-- 1. เพิ่ม column allow_camera (default = false — ต้องเปิดเอง)
ALTER TABLE gps_shared_tokens
  ADD COLUMN IF NOT EXISTS allow_camera BOOLEAN NOT NULL DEFAULT false;

-- 2. เปิดให้ anon อ่าน gps_vehicles ได้ (เพื่อให้ share.html แสดง "รถ 1" แทน device_id ยาวๆ)
DROP POLICY IF EXISTS "anon_read_vehicles" ON gps_vehicles;
CREATE POLICY "anon_read_vehicles" ON gps_vehicles
  FOR SELECT TO anon USING (is_active = true);
