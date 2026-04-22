-- Phase 1: Activity Log Enhancement
-- Adds opened_by / opened_at to cases for "เปิดโดย ... เวลา ..." display

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS opened_by  TEXT,
  ADD COLUMN IF NOT EXISTS opened_at  TIMESTAMPTZ;

-- Backfill from activity_log: earliest entry per case as the "opener"
-- (covers historical cases where SAVE_CASE / REOPEN_CASE was the first signal)
WITH first_log AS (
  SELECT DISTINCT ON (target)
         target       AS case_id,
         username,
         timestamp
  FROM   activity_log
  WHERE  target IS NOT NULL
    AND  target <> ''
    AND  action IN ('SAVE_CASE','CREATE_CASE','OPEN_CASE','REOPEN_CASE')
  ORDER  BY target, timestamp ASC
)
UPDATE cases c
SET    opened_by = COALESCE(c.opened_by, fl.username),
       opened_at = COALESCE(c.opened_at, fl.timestamp)
FROM   first_log fl
WHERE  c.case_id = fl.case_id
  AND  (c.opened_by IS NULL OR c.opened_at IS NULL);

-- Fallback: any case with no log entry → use created_at, opener unknown
UPDATE cases
SET    opened_at = created_at
WHERE  opened_at IS NULL;
