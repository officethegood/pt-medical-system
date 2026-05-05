-- Migration: First-Aid event-scoped tokens for part-time staff
-- Run on Supabase SQL editor.
-- Adds: fa_event_tokens table + RLS policies.
-- Does NOT modify existing tables. Section ("จุดรักษา") reuses fa_registry.location_tx
-- and fa_events.event_config.locations[] which already exist.

CREATE TABLE IF NOT EXISTS fa_event_tokens (
  token        TEXT PRIMARY KEY,                                    -- 6 chars, e.g. K7M2P9
  event_id     TEXT REFERENCES fa_events(event_id) ON DELETE CASCADE,
  worker_name  TEXT NOT NULL,                                       -- stamped as recorded_by
  location_tx  TEXT,                                                -- specific จุดรักษา; NULL = ทุกจุด
  status       TEXT DEFAULT 'Active',                               -- Active | Revoked
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fa_event_tokens_event_idx ON fa_event_tokens(event_id);
CREATE INDEX IF NOT EXISTS fa_event_tokens_status_idx ON fa_event_tokens(status);

ALTER TABLE fa_event_tokens ENABLE ROW LEVEL SECURITY;

-- Authenticated admins: full CRUD
DROP POLICY IF EXISTS "auth_all_fa_event_tokens" ON fa_event_tokens;
CREATE POLICY "auth_all_fa_event_tokens" ON fa_event_tokens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anonymous policies. Note: this app uses ANON_KEY for ALL traffic (admin auth is
-- via external GAS HR, not Supabase Auth). So admin token CRUD also goes via anon.
-- Soft security: filtering done client-side. ANON_KEY is public.
DROP POLICY IF EXISTS "anon_read_fa_event_tokens" ON fa_event_tokens;
CREATE POLICY "anon_read_fa_event_tokens" ON fa_event_tokens
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_insert_fa_event_tokens" ON fa_event_tokens;
CREATE POLICY "anon_insert_fa_event_tokens" ON fa_event_tokens
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fa_event_tokens" ON fa_event_tokens;
CREATE POLICY "anon_update_fa_event_tokens" ON fa_event_tokens
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fa_event_tokens" ON fa_event_tokens;
CREATE POLICY "anon_delete_fa_event_tokens" ON fa_event_tokens
  FOR DELETE TO anon USING (true);

-- Allow anon (part-time via staff.html) to add/edit registry + bump supply counters.
-- Anyone with ANON_KEY can do this. Acceptable per threat model A (casual access prevention only).
DROP POLICY IF EXISTS "anon_insert_fa_registry" ON fa_registry;
CREATE POLICY "anon_insert_fa_registry" ON fa_registry
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fa_registry" ON fa_registry;
CREATE POLICY "anon_update_fa_registry" ON fa_registry
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fa_events_counters" ON fa_events;
CREATE POLICY "anon_update_fa_events_counters" ON fa_events
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
