-- Enable Realtime publication for all tables used by the app
-- ============================================================
-- Symptom: Status dot stays 🟠 ORANGE ("Connecting...") and never turns 🟢 GREEN.
-- Channel subscribe returns TIMED_OUT (10s) instead of SUBSCRIBED.
--
-- Root cause: Tables are missing from the supabase_realtime publication,
-- OR the publication itself was accidentally dropped / recreated without tables.
--
-- How to run:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this file → Run
--   3. Reload the app → dot should turn GREEN within 1–2 seconds
--
-- Idempotent: safe to run multiple times; skips tables already in the publication.

-- Ensure publication exists (Supabase creates this by default, but recreate if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add every app table we subscribe to. ALTER PUBLICATION ... ADD TABLE errors
-- if the table is already in the publication, so we filter first.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'cases',
    'transport_consents',
    'fa_events',
    'fa_registry',
    'loc_customers',
    'loc_shared_tokens',
    'settings',
    'activity_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
       )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Added % to supabase_realtime', t;
    END IF;
  END LOOP;
END $$;

-- Verify: list tables currently in the publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;
