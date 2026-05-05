-- One-shot recovery: restore TheGood's defensive version of fa_bump_supply
-- after the Supwilai V2 migration was accidentally run on TheGood's Supabase.
--
-- What this fixes (relative to the Supwilai version that was applied):
--   1. Re-locks search_path = public  (mitigates SECURITY DEFINER hijack risk)
--   2. Restores explicit NULL-delta rejection so client bugs surface as errors
--      instead of silent no-ops
--   3. Restores NULL return when event_id not found (so UI keeps its value
--      instead of snapping to 0)
--   4. Drops the redundant anon_all_fa_event_tokens policy (TheGood already
--      has 4 granular anon policies covering SELECT/INSERT/UPDATE/DELETE)
--   5. Re-applies REVOKE ALL FROM PUBLIC for explicitness
--
-- Safe to run multiple times. No data is touched.

-- (1)(2)(3)(5) Restore the function exactly as in add_fa_bump_supply_rpc.sql
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

-- (4) Drop the redundant catch-all policy that the Supwilai migration added.
-- TheGood's granular anon_read / anon_insert / anon_update / anon_delete
-- policies cover the same surface and remain in place.
DROP POLICY IF EXISTS "anon_all_fa_event_tokens" ON fa_event_tokens;
