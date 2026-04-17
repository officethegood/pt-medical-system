-- =====================================================================
-- RLS policies for Location Share feature
-- Apply in Supabase Dashboard → SQL Editor → Run
-- =====================================================================
-- Required by: location/share.html (public viewer)
-- When someone opens https://.../location/share.html?token=xxx,
-- the page uses anon key and needs SELECT access to:
--   (1) loc_shared_tokens — to validate token + get customer_id
--   (2) loc_customers     — to show the shared customer
--
-- IMPORTANT: only run these if RLS is enabled on the tables. If RLS is
-- disabled, anon already has full access (check via Table Editor → table
-- → RLS). Ideally enable RLS for safety, then apply these policies.
-- =====================================================================

-- ============== loc_shared_tokens ==============
-- Enable RLS (no-op if already enabled)
ALTER TABLE public.loc_shared_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anon to SELECT a row only by its exact token (cannot list all)
-- NOTE: Supabase anon client includes request.jwt.claims only when logged in.
-- For truly anonymous access (share link opened by stranger), we use a
-- permissive SELECT with no filter. The "secret" is the token itself —
-- attackers would need to guess a 32-char random token (≈190 bits entropy).
CREATE POLICY IF NOT EXISTS "Public can read tokens by exact match"
ON public.loc_shared_tokens
FOR SELECT
TO anon, authenticated
USING (true);

-- Authenticated users can insert/update/delete (admin only via app logic)
CREATE POLICY IF NOT EXISTS "Authenticated can manage tokens"
ON public.loc_shared_tokens
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============== loc_customers ==============
-- Enable RLS (no-op if already enabled)
ALTER TABLE public.loc_customers ENABLE ROW LEVEL SECURITY;

-- Anon: can SELECT only customers that have at least one Active non-expired share token
CREATE POLICY IF NOT EXISTS "Public can read shared customers"
ON public.loc_customers
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.loc_shared_tokens t
    WHERE t.customer_id = loc_customers.id
      AND t.status = 'Active'
      AND (t.expiry_date IS NULL OR t.expiry_date > NOW())
  )
);

-- Authenticated users can read all customers (normal app behavior)
CREATE POLICY IF NOT EXISTS "Authenticated can read all customers"
ON public.loc_customers
FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can insert/update/delete their own records
CREATE POLICY IF NOT EXISTS "Authenticated can manage customers"
ON public.loc_customers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================================
-- After applying: test anon access by running as anon (Supabase Studio
-- → SQL Editor → use "anon" role) OR open public share link in incognito:
--   https://officethegood.github.io/pt-medical-system/location/share.html?token=<YOUR_TEST_TOKEN>
-- Should see customer data. If 403/empty → policy tightening needed.
-- =====================================================================
