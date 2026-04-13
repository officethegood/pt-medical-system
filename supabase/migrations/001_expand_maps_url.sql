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
    '/search/([-]?[0-9]+\.[0-9]{4,})[,%%2C%%20+]+([-]?[0-9]+\.[0-9]{4,})',
    '/place/[^/]+/@([-]?[0-9]+\.[0-9]{4,}),([-]?[0-9]+\.[0-9]{4,})',
    '!3d([-]?[0-9]+\.[0-9]{4,})!4d([-]?[0-9]+\.[0-9]{4,})',
    '@([-]?[0-9]+\.[0-9]{4,}),([-]?[0-9]+\.[0-9]{4,})',
    '[?&]q=([-]?[0-9]+\.[0-9]{4,}),([-]?[0-9]+\.[0-9]{4,})',
    'center=([-]?[0-9]+\.[0-9]{4,})[,%%2C]+([-]?[0-9]+\.[0-9]{4,})'
  ];
BEGIN
  -- Step 1: Use unshorten.me API to expand short URL → get resolved URL
  SELECT * INTO response FROM http_get(
    'https://unshorten.me/json/' || short_url
  );
  body := COALESCE(response.content, '');

  -- Extract resolved_url from JSON response
  BEGIN
    resolved_url := body::JSONB->>'resolved_url';
  EXCEPTION WHEN OTHERS THEN
    resolved_url := '';
  END;

  -- URL-decode the resolved URL (convert %2B → +, %2C → , etc.)
  resolved_url := COALESCE(resolved_url, '');
  resolved_url := replace(resolved_url, '%2B', '+');
  resolved_url := replace(resolved_url, '%2C', ',');
  resolved_url := replace(resolved_url, '%2F', '/');
  resolved_url := replace(resolved_url, '%3A', ':');
  resolved_url := replace(resolved_url, '%253D', '=');
  resolved_url := replace(resolved_url, '%3D', '=');
  resolved_url := replace(resolved_url, '%26', '&');

  -- Step 2: Try to extract coordinates from the resolved URL
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
