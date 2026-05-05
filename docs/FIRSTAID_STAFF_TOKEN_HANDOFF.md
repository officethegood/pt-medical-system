# Handoff: First-Aid Staff Token Feature → Port to Supwilai V2

**Source:** TheGood (this repo)
**Target:** Supwilai V2 (`F:/@Coding/pt-medical-system/` — verify path; user said it's V2, schema may differ)
**Reason for handoff:** TheGood and Supwilai are **separate orgs with separate data**; only code is mirrored, not data. Schema/UI code may have diverged in V2 — a Supwilai-aware agent should adapt.

---

## What this feature does

A part-time first-aid worker can be given a **6-character token** (e.g. `K7M2P9`) per event. They open `firstaid/staff.html?t=K7M2P9` and can:

- Add new patient registry records
- Edit only their own records
- Increment shared event-level supply counters (±1)
- See only their own list (no event-wide stats / no other workers' patients)
- Be optionally locked to a single "จุดรักษา" (treatment point) — admin's choice when issuing the token

Token auto-revokes when the admin marks the event `Complete`. Manual revoke also supported.

**Threat model:** soft security only. ANON_KEY is in frontend; anyone with DevTools can bypass filters. Acceptable per user's explicit choice.

---

## Files added/changed in TheGood (use as reference, not literal copy)

| File | Change |
|---|---|
| `sql/add_fa_event_tokens.sql` | **NEW** — migration to run on Supabase |
| `migration/schema.sql` | Updated: added `fa_event_tokens` table + RLS policies + anon insert/update on `fa_registry` and anon update on `fa_events` |
| `firstaid/staff.html` | **NEW** — part-time worker page |
| `firstaid/index.html` | Admin UI: token mgmt card + create-token modal + auto-revoke on event close |

---

## Schema — required additions

```sql
CREATE TABLE fa_event_tokens (
  token        TEXT PRIMARY KEY,                                    -- 6 chars
  event_id     TEXT REFERENCES fa_events(event_id) ON DELETE CASCADE,
  worker_name  TEXT NOT NULL,
  location_tx  TEXT,                                                -- จุดรักษา; NULL = ทุกจุด
  status       TEXT DEFAULT 'Active',
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX fa_event_tokens_event_idx ON fa_event_tokens(event_id);
CREATE INDEX fa_event_tokens_status_idx ON fa_event_tokens(status);

ALTER TABLE fa_event_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_fa_event_tokens" ON fa_event_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- IMPORTANT: this app authenticates admins via external GAS HR API, NOT Supabase Auth.
-- All traffic (including admin token CRUD) hits Supabase as `anon`. Without these
-- anon write policies, admin token creation fails with RLS violation.
CREATE POLICY "anon_read_fa_event_tokens" ON fa_event_tokens FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_fa_event_tokens" ON fa_event_tokens FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_fa_event_tokens" ON fa_event_tokens FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_fa_event_tokens" ON fa_event_tokens FOR DELETE TO anon USING (true);

-- Allow anon (part-time via staff.html) to add/edit registry + bump supply counters.
CREATE POLICY "anon_insert_fa_registry" ON fa_registry FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_fa_registry" ON fa_registry FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_fa_events_counters" ON fa_events FOR UPDATE TO anon USING (true) WITH CHECK (true);
```

**Schema assumption to verify in Supwilai V2:**
- Column `fa_registry.location_tx` exists (or its V2 equivalent — section/zone/junction)
- Column `fa_registry.recorded_by` exists
- Column `fa_events.event_config` (JSONB) exists with `.locations[]` array
- Columns `fa_events.q_ammonia / q_plaster / q_spray / q_wound / q_meds` exist (or V2 equivalents)
- `fa_events.status` uses values `Active` / `Complete`

If V2 renamed/restructured any of the above, **adapt** — don't blindly copy.

---

## Behavior contract

| Aspect | Behavior |
|---|---|
| Token format | 6 chars, uppercase A–Z (no `O/I`) + digits 2–9 (no `0/1`). Generate with retry on PK collision (≤ 5 attempts). |
| Token lifetime | Lives until event `status = Complete` (auto-revoke) OR manual admin revoke |
| Token assignment | Admin picks `worker_name` + optional จุดรักษา dropdown (from `event_config.locations`, plus "ทุกจุด" = NULL) |
| Token sharing | Admin copies link `<base>/firstaid/staff.html?t=K7M2P9` and sends via LINE/SMS |
| Section lock | If token has `location_tx`: dropdown in registry form is forced + disabled. If NULL: dropdown free |
| Identity | `recorded_by` on registry = `worker_name` from token (no separate name input) |
| Filter on staff.html | `WHERE event_id=X AND recorded_by=worker_name [AND location_tx=section]` |
| Edit guard | Cannot edit other workers' records (client-side check on `recordedBy === staff_workerName`) |
| Quick supplies | Direct UPDATE on `fa_events.q_*` (optimistic with rollback on error) |
| Event closed | Show error on staff.html if `event.status !== 'Active'` even before token check |

---

## Admin UI bits to add (in V2's firstaid admin page)

1. **Card** in event detail page (admin-only, shown when `getUserRole() === 'Admin'`):
   - Table: ชื่อ / จุดรักษา / Token / สถานะ / [Copy Link, Revoke]
   - Button: "+ สร้าง Token" → opens modal
2. **Modal** for new token:
   - Input: ชื่อเจ้าหน้าที่ (required)
   - Dropdown: จุดรักษา (built from `event_config.locations` + "ทุกจุด" option)
   - On submit: generate token, insert with retry, copy link to clipboard
3. **Hook** the existing "Close Event" / "Mark Complete" action to also `UPDATE fa_event_tokens SET status='Revoked' WHERE event_id=X AND status='Active'`

---

## staff.html design notes (for the porter)

- **Standalone page** — does NOT load `shared/auth.js` (no admin login chain). Creates its own `_supabase` client.
- **Overrides** `getUserName()` and `getUserRole()` so the copied registry-form code doesn't blow up.
- **State** (`staff_token`, `staff_eventId`, `staff_workerName`, `staff_section`, `staff_eventName`) persisted in `sessionStorage` so refresh works.
- **Two entry paths:**
  1. URL `?t=XXXXXX` → auto-login
  2. Manual gate form (TOKEN input)
- **Section enforcement on submit:** if `staff_section` is set and submitted `location_tx !== staff_section` → reject (defense vs DOM tampering)

---

## Known tech debt (intentional)

The registry form HTML (modal) and ~600 lines of `reg_*` JS are **duplicated** between `firstaid/index.html` and `firstaid/staff.html`. Reasoning:
- Extracting to a shared module would touch admin code (regression risk)
- Two pages × identical form = drift risk if logic changes

**For V2 porter:** if Supwilai V2 already has cleaner module separation, prefer to share via a common JS file rather than copy. Otherwise mirror this duplication.

---

## DO-NOT-SYNC reminders (per user's existing rules)

When porting:
- ❌ Do NOT copy `shared/config.js` (different Supabase project, different OCR worker, different Cloudinary)
- ❌ Do NOT change OCR Gemini model defaults in `transport/`
- ✅ Adapt schema to V2 (do NOT assume identical column names)
- ✅ Reuse Supwilai's existing patterns where they differ from TheGood

---

## Test checklist for porter

1. Run migration on Supwilai's Supabase
2. Login as admin, open Active event, create test token
3. Copy link, open in incognito → should land on staff.html with worker name + section visible
4. Add a registry → check it appears in admin's full list AND in staff's "my list"
5. Try edit another worker's record (use 2 tokens) → should be blocked
6. Bump supplies → admin's quick-dispense view should show updated count
7. Close event → reopen staff link → should show "Event ถูกปิดแล้ว"
8. Manual revoke → reopen → "Token ถูกระงับ"

---

**Generated alongside TheGood implementation 2026-05-05.** TheGood is at version 5.9.0 — confirm Supwilai V2 version separately.
