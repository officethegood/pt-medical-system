-- Add show_speed column to gps_shared_tokens so the admin can decide whether
-- the shared GPS view displays the live km/h number. Defaults to true to
-- preserve current behaviour for any tokens created before this migration.
-- Idempotent.

ALTER TABLE gps_shared_tokens
  ADD COLUMN IF NOT EXISTS show_speed BOOLEAN DEFAULT true;
