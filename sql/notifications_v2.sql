-- Phase 4b: Server-side detection + refire-on-worse-value
-- Adds last_payload column for severity comparison

ALTER TABLE notification_state
  ADD COLUMN IF NOT EXISTS last_payload JSONB;
