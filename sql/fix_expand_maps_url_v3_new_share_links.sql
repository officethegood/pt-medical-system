-- ============================================================
-- Fix: expand_maps_url v3 — รองรับลิงก์แชร์รุ่นใหม่จากแอป Google Maps
-- (2026-07-18)
--
-- ปัญหาเดิม:
--   ลิงก์แชร์จากแอปมือถือรุ่นใหม่ (มี g_st=ic) redirect ไป
--   maps.google.com/?q=<ข้อความที่อยู่>&ftid=... ซึ่ง "ไม่มีพิกัดใน URL เลย"
--   และหน้า HTML ที่ fetch แบบไม่รัน JS ก็ไม่มีพิกัดหมุดจริงเช่นกัน
--   ฟังก์ชันเดิม grep ทั้ง HTML ด้วย pattern หลวมๆ (@lat,lng / center=)
--   เลยไปจับ "จุดกลางแผนที่ตาม IP ของ server" (Supabase = สิงคโปร์)
--   → ตอบ success:true พร้อมพิกัดผิดไปไกล (เช่น 1.314, 103.844)
--
-- แก้เป็น:
--   1. ใช้เฉพาะ pattern ที่ยึดกับ marker เชื่อถือได้: DMS, !3d!4d,
--      q=lat,lng (รวมแบบ %2C), /search/, ll=, daddr/saddr/destination
--   2. ตัด @lat,lng / center= / เลขลอยๆ ออกจากการ grep body (ต้นเหตุพิกัดมั่ว)
--   3. ลิงก์แบบใหม่ที่ไม่มีพิกัด: ดึง "ข้อความที่อยู่" จาก JSON blob ในหน้า
--      (คู่ ftid → address) คืนเป็น query_text ให้ client ไปค้น Places API ต่อ
--   4. เลิกคืน HTML ทั้งก้อนใน resolved_url (เดิมทำให้ client regex เจอเลขมั่ว)
--
-- วิธีใช้: วางทั้งไฟล์นี้ใน Supabase Dashboard → SQL Editor → Run
-- ทดสอบ:
--   SELECT expand_maps_url('https://maps.app.goo.gl/GdoLF7zEJg982Q2y7');
--     → success:true (พิกัดตรง /search/)
--   SELECT expand_maps_url('https://maps.app.goo.gl/4tVhHfEC8uJgH7yW8');
--     → success:false + query_text = ที่อยู่ (client ค้น Places ต่อ)
-- ============================================================

CREATE OR REPLACE FUNCTION public.expand_maps_url(short_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  response RECORD;
  body TEXT;
  m TEXT[];
  p TEXT;
  q_text TEXT;
  lat_dec NUMERIC;
  lng_dec NUMERIC;
  -- เฉพาะ pattern ที่ "ยึดกับ parameter/marker" เท่านั้น — ห้ามใส่ @lat,lng /
  -- center= / เลขลอยๆ เพราะ body มีพิกัด map center ตาม IP ของ server ปนอยู่
  patterns TEXT[] := ARRAY[
    -- [?&;] เพราะใน HTML ลิงก์ถูก escape เป็น &amp;q= (เจอเป็น ;q=)
    '!3d([-]?[0-9]+\.[0-9]{3,})!4d([-]?[0-9]+\.[0-9]{3,})',
    '[?&;]q=([-]?[0-9]+\.[0-9]{3,})(?:,|%2C)\+?([-]?[0-9]+\.[0-9]{3,})',
    '/search/([-]?[0-9]+\.[0-9]{3,})(?:,|%2C|\+|%20){1,4}([-]?[0-9]+\.[0-9]{3,})',
    '[?&;]ll=([-]?[0-9]+\.[0-9]{3,})(?:,|%2C)([-]?[0-9]+\.[0-9]{3,})',
    '[?&;][ds]addr=([-]?[0-9]+\.[0-9]{3,})(?:,|%2C)([-]?[0-9]+\.[0-9]{3,})',
    '[?&;]destination=([-]?[0-9]+\.[0-9]{3,})(?:,|%2C)([-]?[0-9]+\.[0-9]{3,})'
  ];
BEGIN
  -- Step 1: fetch ลิงก์ย่อ (http extension follow redirect ให้เอง)
  BEGIN
    SELECT * INTO response FROM http_get(short_url);
    body := COALESCE(response.content, '');
  EXCEPTION WHEN OTHERS THEN
    body := '';
  END;

  IF body = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'เปิดลิงก์ไม่สำเร็จ');
  END IF;

  -- Step 2: DMS notation (พิกัดดิบที่ user ปักหมุด — แม่นสุด)
  -- รองรับทั้งตัวอักษรจริง (13°40'36.7"N) และแบบ URL-encoded (%C2%B0 / %27 / %22)
  m := regexp_match(
    body,
    '([0-9]{1,2})(?:°|%C2%B0)\s*([0-9]{1,2})(?:''|%27|′)\s*([0-9]{1,2}(?:\.[0-9]+)?)(?:"|%22|″)\s*([NS])(?:[,+ ]|%20|%2C){1,4}([0-9]{1,3})(?:°|%C2%B0)\s*([0-9]{1,2})(?:''|%27|′)\s*([0-9]{1,2}(?:\.[0-9]+)?)(?:"|%22|″)\s*([EW])',
    'i'
  );
  IF m IS NOT NULL THEN
    lat_dec := m[1]::NUMERIC + m[2]::NUMERIC / 60 + m[3]::NUMERIC / 3600;
    IF upper(m[4]) = 'S' THEN lat_dec := -lat_dec; END IF;
    lng_dec := m[5]::NUMERIC + m[6]::NUMERIC / 60 + m[7]::NUMERIC / 3600;
    IF upper(m[8]) = 'W' THEN lng_dec := -lng_dec; END IF;
    IF (lat_dec BETWEEN -90 AND 90) AND (lng_dec BETWEEN -180 AND 180) THEN
      RETURN jsonb_build_object(
        'success', true,
        'lat', ROUND(lat_dec, 7)::TEXT,
        'lng', ROUND(lng_dec, 7)::TEXT,
        'source', 'dms'
      );
    END IF;
  END IF;

  -- Step 3: พิกัดทศนิยมจาก marker ที่เชื่อถือได้
  FOREACH p IN ARRAY patterns LOOP
    m := regexp_match(body, p, 'i');
    IF m IS NOT NULL THEN
      IF (m[1]::NUMERIC BETWEEN -90 AND 90)
         AND (m[2]::NUMERIC BETWEEN -180 AND 180) THEN
        RETURN jsonb_build_object(
          'success', true,
          'lat', ROUND(m[1]::NUMERIC, 6)::TEXT,
          'lng', ROUND(m[2]::NUMERIC, 6)::TEXT,
          'source', 'pattern'
        );
      END IF;
    END IF;
  END LOOP;

  -- Step 4: ลิงก์แบบใหม่ไม่มีพิกัด — ดึงข้อความที่อยู่จาก JSON blob ในหน้า
  -- รูปแบบ: ["0x<ftid hex>:0x<hex>","36 ซอย นวมินทร์ ..."] (มีทั้งแบบ escape \" และไม่)
  -- หมายเหตุ: PG regex จำกัด {m,n} ที่ n ≤ 255 — ห้ามใส่เกิน
  m := regexp_match(body, '\[\\?"0x[0-9a-f]+:0x[0-9a-f]+\\?",\\?"([^"\\]{2,200})', 'i');
  IF m IS NOT NULL THEN
    q_text := trim(m[1]);
    IF length(q_text) >= 2 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'ลิงก์นี้ไม่มีพิกัด มีแต่ชื่อ/ที่อยู่สถานที่',
        'query_text', q_text
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('success', false, 'message', 'ไม่พบพิกัดในลิงก์');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expand_maps_url(TEXT) TO anon, authenticated;
