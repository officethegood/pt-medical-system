# Handoff: First-Aid Staff Token Feature → Port to Supwilai V2

**Source:** TheGood (this repo) — shipped 2026-05-05, current version v5.10.1
**Target:** Supwilai V2 — path/version to be confirmed by porter
**Reason for handoff:** TheGood and Supwilai are **separate orgs with separate data**. Only code is mirrored, not data. Supwilai V2 may have diverged in schema or UI structure — adapt, don't blind-copy.

> **Read the "Pitfalls / bug history" section near the bottom before coding.** TheGood hit four real bugs after the initial ship — your port will likely hit them too unless you bake the lessons in from the start.

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
| `sql/add_fa_event_tokens.sql` | NEW | Core migration: table + RLS policies (incl. anon writes). Idempotent. |
| `sql/add_fa_event_tokens_fix_anon.sql` | NEW | Standalone patch — only needed if you ran an earlier version of the migration that omitted anon writes. The current `add_fa_event_tokens.sql` already includes them. |
| `sql/add_fa_bump_supply_rpc.sql` | NEW | Atomic +/- supply counter via Postgres function. Required to fix the lost-update race (see pitfall #2). |
| `sql/add_fa_event_tokens_realtime.sql` | NEW | Adds `fa_event_tokens` to the `supabase_realtime` publication so admins see each other's token changes live (see pitfall #3). |
| `migration/schema.sql` | MODIFIED | Canonical schema updated (gitignored locally — reference only). |
| `firstaid/staff.html` | NEW | Standalone part-time worker page. ~600 lines. |
| `firstaid/index.html` | MODIFIED | Admin UI: token-mgmt card, create-token modal, atomic +/- supply, auto-revoke hook, realtime subs. |
| `shared/config.js` | MODIFIED | Version bumps (5.9.0 → 5.10.1). Do NOT copy this file between repos — endpoints differ (DO-NOT-SYNC rule). |

**Run order on a fresh install:** `add_fa_event_tokens.sql` → `add_fa_bump_supply_rpc.sql` → `add_fa_event_tokens_realtime.sql`. All idempotent and safe to re-run.

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

## Pitfalls / bug history — read before coding

These four bugs all shipped on TheGood and required follow-up commits. Each one has a generalisable lesson.

### Pitfall 1 — RLS policy on the wrong role
**Commit:** `5b16c5a` (fix), original was in `45029dd`
**Symptom:** Admin clicks "+ สร้าง Token" → `Error: new row violates row-level security policy for table "fa_event_tokens"`.
**Root cause:** I added `auth_all_fa_event_tokens` for the `authenticated` role, assuming admin login was Supabase Auth. It is not — admin auth is external (GAS HR). Every Supabase request is `anon`.
**Fix:** Add `anon_insert / anon_update / anon_delete` policies on the table.
**Generalisation:** In this codebase **every** RLS policy you need at runtime must target `anon`. Treat `authenticated` policies as documentation only. Same applies to RPC `GRANT EXECUTE` — must include `anon`.

### Pitfall 2 — Lost-update race on supply counters
**Commit:** `0ab7c1e` (fix), v5.10.1
**Symptom:** Staff bumps `q_ammonia` from 5 to 6 via staff.html. Admin's quick-dispense page (loaded before the bump) still shows 5 in the input. Admin clicks "บันทึกยอด" → DB written back to 5. Staff's +1 silently lost. Worse: admin's bulk-save sent **all 4 fields** in one UPDATE, so editing one would clobber any concurrent change to the other three.
**Root cause:** Both pages did read-modify-write on locally cached values. Classic lost-update.
**Fix:**
- Created Postgres RPC `fa_bump_supply(p_event_id, p_field, p_delta)` doing atomic `UPDATE SET q_x = GREATEST(0, COALESCE(q_x,0) + delta) RETURNING q_x`. Field name whitelisted; `SECURITY DEFINER`; `GRANT EXECUTE TO anon, authenticated`.
- Both pages call the RPC for every +/-. Optimistic UI is replaced by the server's authoritative return value.
- Admin's "บันทึกยอด" button + bulk save function deleted entirely. Inputs marked `readonly`. All changes flow through +/- buttons → RPC.
**Generalisation:** Any UI counter that multiple users can mutate concurrently needs an atomic-increment path on the server. Never trust `currentValue + delta` on the client. If V2 has more counters of this shape, give them the same treatment.

### Pitfall 3 — New table missing from realtime publication + missing client subscription
**Commit:** `bf63245` (fix)
**Symptom:** Admin A creates a token → Admin B looking at the same event detail page does not see the new row until a manual reload.
**Root cause:** Two independent omissions.
1. `fa_event_tokens` was never added to the `supabase_realtime` publication. Without that, Postgres doesn't push change events at all, so any subscription is silent.
2. The admin page's existing `RT.subscribeMulti('fa-registry', ['fa_registry', 'fa_events'], cb)` didn't include the new table, and the callback only refreshed the patient list.
**Fix:**
- New SQL `add_fa_event_tokens_realtime.sql` does `ALTER PUBLICATION supabase_realtime ADD TABLE public.fa_event_tokens`, idempotent guard.
- Extend the admin subscription's table list and callback to also call `fa_loadStaffTokens()` (skipped when the admin card is hidden).
**Generalisation:** Any new table that needs realtime must be added to the publication AND to a client subscription AND have its callback wired. Easy to forget any one of three.

### Pitfall 4 — Staff supplies UI didn't match admin's
**Commit:** `cc7f602` (fix)
**Symptom:** staff.html showed 5 supply tiles (extra "ยา"); admin's Quick Dispense card only has 4. Labels also mismatched ("พลาสเตอร์" vs "พลาสเตอร์ยา", "แผล" vs "ประคบเย็น").
**Root cause:** I built the staff `SUPPLY_FIELDS` list from memory of the schema (which has `q_meds`) instead of mirroring the admin's actual UI.
**Fix:** Trim list to 4 items and copy admin labels verbatim. Added a comment "Mirror admin's Quick Dispense card. Keep in sync."
**Generalisation:** When reproducing a UI element on a second page, source-of-truth-copy from the existing page, don't rebuild from the schema. The schema may have unused or admin-only columns.

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

All on `main` of `https://github.com/officethegood/pt-medical-system`:

- `45029dd` — initial feature (had pitfall #1)
- `5b16c5a` — anon-write RLS fix (pitfall #1)
- `9316fc0` — handoff doc rewrite with anon caveat upfront
- `0ab7c1e` — atomic RPC + realtime supply sync (pitfall #2), v5.10.1
- `bf63245` — fa_event_tokens realtime sync across admins (pitfall #3)
- `cc7f602` — staff supplies UI matches admin (pitfall #4)

---

## Test checklist for race conditions and realtime

In addition to the basic checklist above, run these to catch the regressions TheGood hit:

1. **Atomic supply +/-** — open the same event as admin in window A and as staff in window B. Mash + on both windows simultaneously a few times. Final number on each side after settle must equal `(admin clicks) + (staff clicks)`. If it's lower, the RPC isn't being called or isn't atomic.
2. **Cross-admin token visibility** — open the same event as admin in two different browsers (or one admin + one incognito). Admin A creates a token. Admin B should see it appear within ~2s without reloading. If not, either `fa_event_tokens` isn't in the realtime publication, or the client subscription doesn't include it.
3. **Token revoke broadcast** — Admin A revokes a token while Admin B has the page open. Admin B's row should switch to "Revoked" within ~2s.
4. **Staff supply realtime** — staff bumps `q_ammonia` → admin's Quick Dispense input updates within ~2s without staff reloading.
5. **Admin supply realtime** — admin bumps `q_ammonia` → staff's supply tile updates within ~2s.

---

**TheGood version at port time:** 5.10.1. Confirm Supwilai V2 version separately before deciding whether to bump V2's version after porting.
