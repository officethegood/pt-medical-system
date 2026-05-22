-- Seed: Cartrack GPS provider + 4 TheGood vehicles
-- Run in TheGood Supabase SQL Editor.
-- SQL Editor runs as superuser → bypasses RLS, so the inserts always work.
--
-- NOTE: gps_providers.password stores the Cartrack API key in plaintext, and
-- anon can read gps_providers (anon_read_providers policy) → the key is
-- exposed to anyone with the ANON_KEY. Accepted: internal system, low
-- sensitivity (per project decision).

-- 1. Provider --------------------------------------------------------------
INSERT INTO gps_providers (id, name, software, base_url, account, password, is_active)
VALUES (
  'cartrack-th',
  'Cartrack (TheGood)',
  'cartrack',
  'https://fleetapi-th.cartrack.com/rest',
  'GOOD00018',
  'f4a57f9f82aa7d001ba670ce63889c9bc748035331014f2a8194a40ec5058407',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  software = EXCLUDED.software,
  base_url = EXCLUDED.base_url,
  account = EXCLUDED.account,
  password = EXCLUDED.password,
  is_active = EXCLUDED.is_active;

-- 2. Vehicles (device_id = Cartrack registration) --------------------------
INSERT INTO gps_vehicles (device_id, device_name, nickname, provider, is_active)
VALUES
  ('ฮล8597',  'TG 1', 'TG 1', 'cartrack-th', true),
  ('3ขอ1643', 'TG 2', 'TG 2', 'cartrack-th', true),
  ('ฮร4575',  'TG 4', 'TG 4', 'cartrack-th', true),
  ('ฮธ1606',  'TG 6', 'TG 6', 'cartrack-th', true)
ON CONFLICT (device_id, provider) DO UPDATE SET
  device_name = EXCLUDED.device_name,
  nickname = EXCLUDED.nickname,
  is_active = EXCLUDED.is_active;

-- 3. RLS — anon SELECT on gps_vehicles -------------------------------------
-- The app uses ANON_KEY for all traffic (admin auth is external GAS HR).
-- gps_providers already has anon_read_providers; gps_vehicles needs one too,
-- otherwise gps/index.html (anon) reads 0 vehicles.
DROP POLICY IF EXISTS "anon_read_gps_vehicles" ON gps_vehicles;
CREATE POLICY "anon_read_gps_vehicles" ON gps_vehicles
  FOR SELECT TO anon USING (is_active = true);

-- Verify
SELECT v.device_id, v.nickname, p.name AS provider, p.software
FROM gps_vehicles v JOIN gps_providers p ON p.id = v.provider
WHERE v.provider = 'cartrack-th';
