## Scope

1. Delete all student-side user accounts (keep all staff)
2. Move `org_id=1` and hardcoded fees out of edge functions into `system_settings`
3. Registration fee already lives in settings — enforce it everywhere (drop the `REG_FEE = 424` constant)

---

## 1. Delete student user accounts

Target: `users` rows that have **no entry in `user_roles`** (roughly 4000 parent/member accounts, ids ≥ 3959).

Keep: all 12 staff users (ids 10–20, 31) — instructors, managers, admins.

Order (data migration, done via insert tool):
```text
1. UPDATE students SET user_id = NULL WHERE user_id IN (<ids>)
2. DELETE FROM whatsapp_otp WHERE phone IN (<their phones>)
3. DELETE FROM abandoned_carts WHERE user_id IN (<ids>)
4. DELETE FROM user_roles WHERE user_id IN (<ids>)   -- defensive, should be empty
5. DELETE FROM users WHERE id IN (<ids>)
6. Best-effort: auth.admin.deleteUser() for any linked auth_id
```

**Students themselves stay** — only the parent/member login accounts go. Students keep their name/phone via the fallback logic already in `studentUtils`.

---

## 2. Settings-driven configuration

Add / confirm these keys in `system_settings` (org 1):

| key | current | source of truth |
|---|---|---|
| `default_organization_id` | (new) `1` | replaces hardcoded `1` in edge functions |
| `registration_fee` | 590 | already present |
| `drop_in_fee` | 760 | already present |
| `gst_percent` | (new) `18` | replaces `* 1.18` |
| `renewal_grace_days` | 14 | already present |

Pricing plans (1/2/3+ batches) already live in `pricing_plans` — enforce reading from there, no hardcoded fallback.

Migration adds only the two new keys.

---

## 3. Edge function refactor

Add a shared helper (inline per function — edge functions can't share files easily) that loads settings once per request:

```ts
async function loadSettings(supabase) {
  const { data } = await supabase.from("system_settings").select("key,value");
  const map = Object.fromEntries((data||[]).map(r => [r.key, r.value]));
  return {
    orgId: Number(map.default_organization_id ?? 1),
    regFee: Number(map.registration_fee ?? 424),
    dropInFee: Number(map.drop_in_fee ?? 500),
    gstPct: Number(map.gst_percent ?? 18),
  };
}
```

Files to update:

- `supabase/functions/registration-api/index.ts`
  - Remove `const REG_FEE = 424`
  - Replace every `organization_id: 1` / `.eq("organization_id", 1)` with `settings.orgId`
  - Use `settings.regFee` in `computeBreakdown`
  - Read pricing tiers from `pricing_plans` (already loaded), no fallback constants
- `supabase/functions/send-whatsapp-otp/index.ts` — use `settings.orgId`
- `supabase/functions/verify-whatsapp-otp/index.ts` — use `settings.orgId`
- `supabase/functions/create-razorpay-order/index.ts` — resolve orgId from `batches.organization_id` when not supplied, else fall back to `settings.orgId`
- `supabase/functions/razorpay-webhook/index.ts` — resolve org from payment/batch row
- `supabase/functions/send-cash-confirmation/index.ts` — use `settings.orgId`
- `supabase/functions/send-receipt/index.ts` — use `settings.orgId`
- `supabase/functions/send-test-message/index.ts` — use `settings.orgId`
- `supabase/functions/mark-completed-sessions/index.ts` — remove hardcoded org filter (process all orgs)

Also update `src/lib/enrollmentUtils.ts`:
- Remove `export const REG_FEE = 424`
- Change `computeBreakdown` to accept `regFee` as a parameter
- Callers (`StudentDashboard`, `JoinBatchFlow`) already load settings — pass `settings.registration_fee` in

**Out of scope for this pass**: the ~40 `organization_id: 1` occurrences in frontend components (`StudentDashboard`, `JoinBatchFlow`, `DropInFlow`, etc.). The user asked to fix "hardcoded org_id=1 and prices in edge functions", so frontend org filtering stays as-is until we adopt a shared `useOrgId()` hook. Happy to do that in a follow-up.

---

## Verification

1. `SELECT count(*) FROM users` before/after — expect ~12 remaining
2. Load the Settings page — reg fee, drop-in fee, and (new) GST % editable
3. Run a test registration in test-mode and confirm the breakdown uses the settings value (change reg fee to 999, breakdown updates)
4. `supabase--linter` and typecheck stay green

## Risk notes

- Deleting parent accounts logs out ~4000 users; they'll re-register on next visit and get relinked by phone
- `auth.users` rows for those accounts are orphaned — cleanup is best-effort; leftover auth rows don't affect the app
