-- Atomic increment RPC for fa_events supply counters.
-- Fixes lost-update race between admin "บันทึกยอด" and staff +/- buttons.
--
-- Usage from JS:
--   const { data, error } = await _supabase.rpc('fa_bump_supply', {
--     p_event_id: 'EV-...', p_field: 'q_ammonia', p_delta: 1
--   });
--   // data = new value (int), or null if event not found
--
-- Allowed fields: q_ammonia, q_plaster, q_spray, q_wound, q_meds.
-- Result is clamped to >= 0.
-- SECURITY DEFINER so anon role can mutate even if direct UPDATE policy
-- is restricted later. Field whitelist prevents SQL injection.

CREATE OR REPLACE FUNCTION public.fa_bump_supply(
  p_event_id TEXT,
  p_field    TEXT,
  p_delta    INT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new INT;
BEGIN
  IF p_field NOT IN ('q_ammonia','q_plaster','q_spray','q_wound','q_meds') THEN
    RAISE EXCEPTION 'invalid field: %', p_field USING ERRCODE = '22023';
  END IF;
  IF p_delta IS NULL THEN
    RAISE EXCEPTION 'delta is null' USING ERRCODE = '22004';
  END IF;

  EXECUTE format(
    'UPDATE public.fa_events
        SET %1$I = GREATEST(0, COALESCE(%1$I, 0) + $1)
      WHERE event_id = $2
      RETURNING %1$I',
    p_field
  )
  INTO v_new
  USING p_delta, p_event_id;

  RETURN v_new;
END
$$;

REVOKE ALL ON FUNCTION public.fa_bump_supply(TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fa_bump_supply(TEXT, TEXT, INT) TO anon, authenticated;

-- Ensure fa_events is in the realtime publication (already done by
-- enable_realtime_publication.sql, but safe to re-run).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='fa_events')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='fa_events'
     )
  THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.fa_events';
  END IF;
END $$;
