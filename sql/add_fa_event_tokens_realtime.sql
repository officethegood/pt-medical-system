-- Add fa_event_tokens to the realtime publication so admin pages see
-- newly created/revoked tokens from other admins live.
-- Idempotent: skips if already present.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='fa_event_tokens')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='fa_event_tokens'
     )
  THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.fa_event_tokens';
    RAISE NOTICE 'Added fa_event_tokens to supabase_realtime';
  END IF;
END $$;
