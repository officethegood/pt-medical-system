-- Phase 2: External Notifications (Line OA + Telegram)
-- Tables for debounce state + send log

CREATE TABLE IF NOT EXISTS notification_state (
  case_id          TEXT NOT NULL,
  alert_type       TEXT NOT NULL,
  first_sent_at    TIMESTAMPTZ DEFAULT now(),
  acknowledged     BOOLEAN     DEFAULT false,
  acknowledged_at  TIMESTAMPTZ,
  acknowledged_by  TEXT,
  PRIMARY KEY (case_id, alert_type)
);

CREATE TABLE IF NOT EXISTS notification_log (
  id          BIGSERIAL PRIMARY KEY,
  case_id     TEXT,
  alert_type  TEXT,
  channel     TEXT,           -- 'line' | 'telegram'
  status      TEXT,           -- 'sent' | 'failed' | 'skipped'
  error       TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_created  ON notification_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_case     ON notification_log (case_id);

-- 30-day auto-cleanup function (call from worker /notify/send opportunistically)
CREATE OR REPLACE FUNCTION notification_log_cleanup()
RETURNS void AS $$
  DELETE FROM notification_log WHERE created_at < now() - INTERVAL '30 days';
$$ LANGUAGE sql;

-- RLS: anon can read state (so browser ack works), worker uses service key
ALTER TABLE notification_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_state_anon_all ON notification_state;
CREATE POLICY notif_state_anon_all ON notification_state
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS notif_log_anon_read ON notification_log;
CREATE POLICY notif_log_anon_read ON notification_log
  FOR SELECT TO anon USING (true);

-- inserts only via worker (service_role bypasses RLS)
