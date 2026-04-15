-- =====================================================
-- Add witness signature image column to transport_consents
-- Run on BOTH databases: supwilai + thegood
-- =====================================================
-- Supwilai:  rwxaalgvkzlsyfzdebcj.supabase.co
-- TheGood:   bztzsjuwyduveaqjvjma.supabase.co
-- =====================================================

ALTER TABLE transport_consents
  ADD COLUMN IF NOT EXISTS witness_signature_image TEXT;

-- Verify
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'transport_consents'
--   ORDER BY ordinal_position;
