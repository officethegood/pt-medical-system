-- ============================================================
-- Supabase Database Function: expand_maps_url
-- ทำหน้าที่เหมือน GAS loc_expandGoogleMapsLink()
-- ใช้ unshorten.me API เพื่อขยายลิงก์ย่อ แล้ว parse พิกัด
--
-- วิธีใช้:
-- 1. เปิด Supabase Dashboard → Database → Extensions → เปิด "http"
-- 2. คัดลอก SQL ทั้งหมดนี้ → ไปวางที่ SQL Editor → Run
-- 3. ทดสอบ: SELECT expand_maps_url('https://maps.app.goo.gl/GdoLF7zEJg982Q2y7');
-- ============================================================

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
    -- ⭐ ลำดับสำคัญ: !3d!4d = พิกัดหมุดจริง ต้องมาก่อน @lat,lng (camera center ที่เพี้ยน)
    '!3d([-]?[0-9]+\.[0-9]{4,})!4d([-]?[0-9]+\.[0-9]{4,})',
    '[?&]q=([-]?[0-9]+\.[0-9]{4,}),([-]?[0-9]+\.[0-9]{4,})',
    '/search/([-]?[0-9]+\.[0-9]{4,})[,%%2C%%20+]+([-]?[0-9]+\.[0-9]{4,})',
    '/place/[^/]+/@([-]?[0-9]+\.[0-9]{4,}),([-]?[0-9]+\.[0-9]{4,})',
    '@([-]?[0-9]+\.[0-9]{4,}),([-]?[0-9]+\.[0-9]{4,})',
    'center=([-]?[0-9]+\.[0-9]{4,})[,%%2C]+([-]?[0-9]+\.[0-9]{4,})'
  ];
BEGIN
  resolved_url := '';
  body := '';

  -- Step 1: เรียก short URL ตรงๆ — http extension follow redirect อัตโนมัติ
  -- จะได้ HTML page เต็มของ Google Maps (~200KB) มี !3d!4d + DMS อยู่ในนั้น
  BEGIN
    SELECT * INTO response FROM http_get(short_url);
    body := COALESCE(response.content, '');
    -- ใช้ body เป็น resolved_url ด้วย (HTML page มี URL พร้อม coords ฝังอยู่)
    resolved_url := body;
  EXCEPTION WHEN OTHERS THEN
    body := '';
    resolved_url := '';
  END;

  -- URL-decode the resolved URL (convert %2B → +, %2C → , etc.)
  resolved_url := COALESCE(resolved_url, '');

  -- ถ้าเป็น consent.google.com → ดึง URL จริงจาก ?continue= ออกมาก่อน
  IF resolved_url LIKE '%consent.google.com%' THEN
    coord_match := regexp_match(resolved_url, '[?&]continue=([^&]+)');
    IF coord_match IS NOT NULL THEN
      resolved_url := coord_match[1];
    END IF;
  END IF;

  -- ลอก encode ชั้นนอกก่อน (double-encoded: %25C2 → %C2, %2522 → %22, %253D → %3D)
  resolved_url := replace(resolved_url, '%25', '%');

  -- decode รอบปกติ
  resolved_url := replace(resolved_url, '%2B', '+');
  resolved_url := replace(resolved_url, '%2C', ',');
  resolved_url := replace(resolved_url, '%2F', '/');
  resolved_url := replace(resolved_url, '%3A', ':');
  resolved_url := replace(resolved_url, '%3D', '=');
  resolved_url := replace(resolved_url, '%26', '&');
  resolved_url := replace(resolved_url, '%3F', '?');

  -- Step 2a: ลองหา DMS notation ก่อน (แม่นที่สุด — เป็นพิกัดดิบที่ user pin)
  -- ตัวอย่าง: 15°47'47.2"N+100°02'58.7"E (encoded: 15%C2%B047'47.2%22N+100%C2%B002'58.7%22E)
  IF resolved_url != '' THEN
    DECLARE
      dms TEXT[];
      lat_dec NUMERIC;
      lng_dec NUMERIC;
    BEGIN
      dms := regexp_match(
        resolved_url,
        '([0-9]+)%C2%B0([0-9]+)''([0-9.]+)%22([NS])[+ ,]+([0-9]+)%C2%B0([0-9]+)''([0-9.]+)%22([EW])'
      );
      IF dms IS NOT NULL THEN
        lat_dec := dms[1]::NUMERIC + dms[2]::NUMERIC / 60 + dms[3]::NUMERIC / 3600;
        IF dms[4] = 'S' THEN lat_dec := -lat_dec; END IF;
        lng_dec := dms[5]::NUMERIC + dms[6]::NUMERIC / 60 + dms[7]::NUMERIC / 3600;
        IF dms[8] = 'W' THEN lng_dec := -lng_dec; END IF;

        IF (lat_dec BETWEEN -90 AND 90) AND (lng_dec BETWEEN -180 AND 180) THEN
          RETURN jsonb_build_object(
            'success', true,
            'lat', ROUND(lat_dec, 7)::TEXT,
            'lng', ROUND(lng_dec, 7)::TEXT,
            'source', 'dms'
          );
        END IF;
      END IF;
    END;
  END IF;

  -- Step 2b: Try to extract coordinates from the resolved URL (fallback ไป !3d!4d / @lat,lng)
  IF resolved_url != '' THEN
    FOREACH p IN ARRAY patterns LOOP
      coord_match := regexp_match(resolved_url, p);
      IF coord_match IS NOT NULL THEN
        IF (coord_match[1]::NUMERIC BETWEEN -90 AND 90)
           AND (coord_match[2]::NUMERIC BETWEEN -180 AND 180) THEN
          RETURN jsonb_build_object(
            'success', true,
            'lat', ROUND(coord_match[1]::NUMERIC, 6)::TEXT,
            'lng', ROUND(coord_match[2]::NUMERIC, 6)::TEXT
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Step 3: Fallback — parse the raw JSON body for coordinate patterns
  FOREACH p IN ARRAY patterns LOOP
    coord_match := regexp_match(body, p);
    IF coord_match IS NOT NULL THEN
      IF (coord_match[1]::NUMERIC BETWEEN -90 AND 90)
         AND (coord_match[2]::NUMERIC BETWEEN -180 AND 180) THEN
        RETURN jsonb_build_object(
          'success', true,
          'lat', ROUND(coord_match[1]::NUMERIC, 6)::TEXT,
          'lng', ROUND(coord_match[2]::NUMERIC, 6)::TEXT
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', false,
    'message', 'ไม่พบพิกัดในลิงก์',
    'resolved_url', resolved_url
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expand_maps_url(TEXT) TO anon, authenticated;
