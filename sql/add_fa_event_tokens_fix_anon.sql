-- Fix: existing app uses ANON_KEY (admin login via GAS HR, not Supabase auth).
-- The original migration only allowed `authenticated` role to write fa_event_tokens,
-- which blocks admin token creation with RLS error.
-- Add anon INSERT/UPDATE/DELETE policies. Run after add_fa_event_tokens.sql.

DROP POLICY IF EXISTS "anon_insert_fa_event_tokens" ON fa_event_tokens;
CREATE POLICY "anon_insert_fa_event_tokens" ON fa_event_tokens
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fa_event_tokens" ON fa_event_tokens;
CREATE POLICY "anon_update_fa_event_tokens" ON fa_event_tokens
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fa_event_tokens" ON fa_event_tokens;
CREATE POLICY "anon_delete_fa_event_tokens" ON fa_event_tokens
  FOR DELETE TO anon USING (true);
