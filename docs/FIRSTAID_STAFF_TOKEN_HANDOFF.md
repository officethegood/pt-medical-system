# Handoff: First-Aid Staff Token Feature → Port to Supwilai V2

**Source:** TheGood (this repo) — shipped 2026-05-05 in v5.10.0
**Target:** Supwilai V2 — path/version to be confirmed by porter
**Reason for handoff:** TheGood and Supwilai are **separate orgs with separate data**. Only code is mirrored, not data. Supwilai V2 may have diverged in schema or UI structure — adapt, don't blind-copy.

---

## ⚠️ Critical caveat the porter must know first

This codebase **does not use Supabase Auth**. Admin login goes through an external Google Apps Script HR API (`CONFIG.GAS_AUTH_API_URL`) and the result is cached in `localStorage` as `pt_user_meta`. The Supabase JS client is created once with `SUPABASE_ANON_KEY` and used for both admin and anon traffic.

**Implication for RLS:** every policy the app needs must target the `anon` role. `authenticated`-role policies are effectively dead code in this stack. If you forget this, admin token creation will fail with `new row violates row-level security policy`. (TheGood hit this exact bug — fixed in commit `5b16c5a`.)

**Threat model = soft.** ANON_KEY ships in frontend → anyone with DevTools can call the same queries. User accepted this trade-off explicitly. If Supwilai's threat model differs, escalate to user before porting.

---

## Feature summary

A part-time first-aid worker can be issued a **6-character token** (e.g. `K7M2P9`) per event. They open `firstaid/staff.html?t=K7M2P9` and can:

- Add new patient registry records (their `worker_name` stamped as `recorded_by`)
- Edit only their own records
- Increment shared event-level supply counters (±1)
- See only their own list — no event-wide stats, no other workers' patients
- Be optionally locked to a single "จุดรักษา" (treatment point) chosen at token creation

Token auto-revokes when the admin marks the event `Complete`. Manual revoke from admin UI is also supported (with confirm).

---

## Files added/changed in TheGood — reference layout

| File | Type | Purpose |
|---|---|---|
| `sql/add_fa_event_tokens.sql` | NEW | Idempotent migration. Run on Supabase SQL Editor. |
| `sql/add_fa_event_tokens_fix_anon.sql` | NEW | Standalone patch — needed only if you ran an earlier version of the migration that omitted anon write policies. The current `add_fa_event_tokens.sql` already includes them. |
| `migration/schema.sql` | MODIFIED | Canonical schema updated (gitignored locally — reference only). |
| `firstaid/staff.html` | NEW | Standalone part-time worker page. ~600 lines. |
| `firstaid/index.html` | MODIFIED | Admin UI: token-mgmt card, create-token modal, auto-revoke hook. |
| `shared/config.js` | MODIFIED | Version bump only (5.9.0 → 5.10.0). Do NOT copy this file between repos — endpoints differ (DO-NOT-SYNC rule). |

---

## Schema — required SQL

```sql
CREATE TABLE IF NOT EXISTS fa_event_tokens (
  token        TEXT PRIMARY KEY,                                    -- 6 chars
  event_id     TEXT REFERENCES fa_events(event_id) ON DELETE CASCADE,
  worker_name  TEXT NOT NULL,                                       -- stamped to recorded_by
  location_tx  TEXT,                                                -- จุดรักษา; NULL = ทุกจุด
  status       TEXT DEFAULT 'Active',                               -- Active | Revoked
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fa_event_tokens_event_idx  ON fa_event_tokens(event_id);
CREATE INDEX IF NOT EXISTS fa_event_tokens_status_idx ON fa_event_tokens(status);

ALTER TABLE fa_event_tokens ENABLE ROW LEVEL SECURITY;

-- ALL policies must target `anon` because admin auth is external (GAS HR), not Supabase Auth.
-- The `authenticated` policy below is kept for completeness only and is unused at runtime.
DROP POLICY IF EXISTS "auth_all_fa_event_tokens"   ON fa_event_tokens;
CREATE POLICY "auth_all_fa_event_tokens"   ON fa_event_tokens FOR ALL    TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_fa_event_tokens"   ON fa_event_tokens;
CREATE POLICY "anon_read_fa_event_tokens"   ON fa_event_tokens FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_insert_fa_event_tokens" ON fa_event_tokens;
CREATE POLICY "anon_insert_fa_event_tokens" ON fa_event_tokens FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fa_event_tokens" ON fa_event_tokens;
CREATE POLICY "anon_update_fa_event_tokens" ON fa_event_tokens FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fa_event_tokens" ON fa_event_tokens;
CREATE POLICY "anon_delete_fa_event_tokens" ON fa_event_tokens FOR DELETE TO anon USING (true);

-- Allow part-time staff (anon role from staff.html) to write registry + bump supply counters.
-- Skip if Supwilai V2 already has anon write on these tables.
DROP POLICY IF EXISTS "anon_insert_fa_registry"          ON fa_registry;
CREATE POLICY "anon_insert_fa_registry"          ON fa_registry FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fa_registry"          ON fa_registry;
CREATE POLICY "anon_update_fa_registry"          ON fa_registry FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fa_events_counters"   ON fa_events;
CREATE POLICY "anon_update_fa_events_counters"   ON fa_events   FOR UPDATE TO anon USING (true) WITH CHECK (true);
```

### Schema assumptions to verify in Supwilai V2 before running

If V2 renamed/restructured anything below, **adapt** — do not blind-copy.

- Column `fa_registry.location_tx` exists (TheGood reuses this for "จุดรักษา"; V2 may call it section/zone/junction)
- Column `fa_registry.recorded_by` exists
- `fa_events.event_config` is JSONB with `.locations[]` array (admin defines treatment points there)
- `fa_events` has supply counters: `q_ammonia / q_plaster / q_spray / q_wound / q_meds`
- `fa_events.status` uses values `Active` / `Complete`
- Table name `fa_events` itself — V2 may have rebranded

---

## Behavior contract

| Aspect | Behavior |
|---|---|
| Token format | 6 chars, uppercase A–Z (no `O`/`I`) + digits 2–9 (no `0`/`1`). Generate with retry up to 5 times on PK collision (collision rate ≈ 1 in 730M, retry is just defensive) |
| Token lifetime | Lives until event `status = Complete` (auto-revoke) OR manual admin revoke |
| Token assignment | Admin enters `worker_name` + selects จุดรักษา dropdown (built from `event_config.locations`, plus a "ทุกจุด" option = NULL) |
| Sharing | Admin copies link `<base>/firstaid/staff.html?t=K7M2P9` and sends via LINE/SMS. Auto-copy on create |
| Section lock | If token has `location_tx`: registry-form dropdown is forced + disabled. If NULL: dropdown free. Submit-side check rejects mismatched `location_tx` (defense vs DOM tampering) |
| Identity stamping | `recorded_by` on every registry write = `worker_name` from token. No separate name input on staff page |
| Filter on staff.html | `WHERE event_id=X AND recorded_by=worker_name [AND location_tx=section]` |
| Edit guard | Cannot edit other workers' records (client check on `recordedBy === staff_workerName` before opening edit modal) |
| Quick supplies | Direct UPDATE on `fa_events.q_*`, optimistic UI with rollback on error |
| Event-closed gate | staff.html refuses login (and existing sessions) if `event.status !== 'Active'` |

---

## Admin UI — what to add to V2's firstaid admin page

1. **Card on event detail page** (admin-only — gate with whatever role check V2 uses; in TheGood it's `getUserRole().toLowerCase() === 'admin'`):
   - Table columns: ชื่อ / จุดรักษา / Token / สถานะ / [Copy Link, Revoke]
   - Header button: "+ สร้าง Token"
   - On event load (when admin) → fetch tokens for current event_id and render
2. **Modal for new token:**
   - Required input: ชื่อเจ้าหน้าที่
   - Dropdown: จุดรักษา — populated from `event_config.locations`, prefixed with `<option value="">— ทุกจุด —</option>`
   - On submit: generate token, INSERT with retry on PK collision, then auto-copy share link
3. **Hook the existing "Close Event / Mark Complete" action** to also:
   ```sql
   UPDATE fa_event_tokens SET status='Revoked' WHERE event_id=X AND status='Active'
   ```
   This is defense-in-depth — `staff.html` also checks `event.status` on every login.

---

## staff.html — design notes

- **Standalone page.** Does NOT load `shared/auth.js` (avoids the admin-login redirect chain). Creates its own `_supabase` client.
- **Identity overrides.** Defines `getUserName()` returning the token's `worker_name`, and `getUserRole()` returning `'Staff'`. This lets the copied registry-form code run unchanged.
- **State persisted in `sessionStorage`** under key `fa_staff_session`: `{ token, eventId, workerName, section, eventName }`. Survives refresh.
- **Two entry paths:** (1) URL `?t=XXXXXX` → auto-login, (2) manual TOKEN input on gate screen.
- **Section enforcement on submit:** if `staff_section` is set and submitted `location_tx !== staff_section`, reject with SweetAlert error. (This guards against someone editing the disabled `<select>` via DevTools.)
- **Supply ±1 buttons** with optimistic UI: text updates immediately, rollback if Supabase returns error.

---

## Known tech debt — intentional

The registry form modal HTML (~150 lines) and `reg_*` JS functions plus `REG_*` constants (~600 lines) are **duplicated** between `firstaid/index.html` and `firstaid/staff.html`. Reasoning:
- Extracting to a shared module would touch admin code and risk regression in a stable flow
- Two pages × identical form = drift risk if logic changes — accepted

**For V2 porter:** if Supwilai V2 already has cleaner module separation (or you can extract safely), prefer a shared JS file (e.g. `firstaid/_registry-form.js`). Otherwise mirror the duplication.

---

## DO-NOT-SYNC reminders (pre-existing rules from MEMORY.md)

- ❌ Do NOT copy `shared/config.js` between repos — different Supabase project, different OCR worker, different Cloudinary
- ❌ Do NOT change OCR Gemini model defaults in `transport/`
- ✅ Adapt schema names to V2 — do not assume identical column names
- ✅ If V2 already has a different filterer for "own records only" (e.g. JWT claims), prefer V2's pattern over TheGood's anon-filter approach

---

## Test checklist for the porter

1. Run the SQL block above on V2's Supabase
2. Login as admin → open Active event → create test token (name "TEST", section "ทุกจุด")
3. Verify auto-copied link looks correct
4. Open link in incognito/another browser → expect TOKEN gate auto-logged in, header shows event name + worker name + "ทุกจุด"
5. Add a registry → check it appears in admin's full list AND in staff's "my list"
6. Issue a second token assigned to a specific section → confirm dropdown is locked + disabled
7. Try to edit another worker's record from staff.html (use 2 tokens) → must be blocked
8. Bump supplies on staff.html → admin's quick-dispense card should reflect the new totals after refresh
9. Mark event Complete → reopen staff link → expect "Event นี้ถูกปิดแล้ว"
10. Manual revoke → reopen → expect "Token ถูกระงับแล้ว"

---

## Reference commits in TheGood

- `45029dd` — initial feature (had the RLS bug)
- `5b16c5a` — anon-write RLS fix

Both on `main` of `https://github.com/officethegood/pt-medical-system`.

---

**TheGood version at port time:** 5.10.0. Confirm Supwilai V2 version separately before deciding whether to bump V2's version after porting.
