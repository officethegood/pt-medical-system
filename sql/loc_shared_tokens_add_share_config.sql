-- =====================================================================
-- Add share_config column to loc_shared_tokens
-- Apply in Supabase Dashboard → SQL Editor → Run
-- =====================================================================
-- Purpose: let admin choose which fields (name, phone, coords, details,
-- photo) are visible in the public share view — matching the original
-- GAS version's privacy checkboxes.
--
-- Shape (JSONB):
--   {
--     "name":    true | false,
--     "phone":   true | false,
--     "coords":  true | false,
--     "details": true | false,
--     "photo":   true | false
--   }
--
-- Default = all visible (safe for old tokens created before this column
-- was added; public viewer treats null/missing = show everything).
-- =====================================================================

ALTER TABLE public.loc_shared_tokens
  ADD COLUMN IF NOT EXISTS share_config JSONB;

COMMENT ON COLUMN public.loc_shared_tokens.share_config IS
  'Which customer fields to expose to the public viewer. Keys: name, phone, coords, details, photo (booleans). If NULL, all fields are shown (backward-compat).';
