-- GPS Shared Link — destination + ETA support (TheGood, client-side DirectionsService)
-- Architecture: single referrer-restricted Google Maps key, ETA computed client-side
-- in share.html via Maps JS DirectionsService. No Cloudflare Worker, no server key,
-- no route_polyline cache (each viewer computes its own route on poll).
--
-- This migration only ADDS nullable columns — existing tokens keep working.
-- Status stays TEXT with no constraint: legacy 'Active' is treated as 'live' by the
-- client; new states ('awaiting' | 'live' | 'arrived' | 'Revoked' | expired-by-time)
-- are conventions enforced in code, not the DB.
--
-- Idempotent. Run in TheGood Supabase SQL Editor.

ALTER TABLE gps_shared_tokens
  ADD COLUMN IF NOT EXISTS dest_lat        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dest_lng        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dest_label      TEXT,
  ADD COLUMN IF NOT EXISTS dest_locked_at  TIMESTAMPTZ;

-- Optional convenience: index active+dated tokens for the admin "active links" list.
CREATE INDEX IF NOT EXISTS gps_shared_tokens_status_exp_idx
  ON gps_shared_tokens(status, expires_at);
