## Test Mode: simulated registration date + receipt preview

Two related additions, gated by the existing `system_settings.test_mode` flag.

### 1. Simulated "registration date" in Register flow

When test mode is ON, show a date picker at the top of the Register page so each test registration can simulate that the registration happened on a chosen date. The simulated date is **passed into cycle/plan-matching logic** so the correct plan and fee for that date are picked — but it does NOT modify enrollment timestamps, payment timestamps, or any DB fields. It is purely a "what would the system charge if today were X?" preview.

UI:
- Banner at top of `src/pages/Register.tsx` (only when `test_mode === "true"`):
  - Yellow/warning style matching the Settings test-mode banner.
  - Label: "TEST MODE — simulating registration on:" + shadcn DatePicker.
  - Default value: today (IST).
  - Reset button to clear back to today.
- The chosen date is held in a small React Context (`TestDateContext`) provided in `Register.tsx` so all child flows (`JoinBatchFlow`, `BatchSelection`, `DropInFlow`, `FeeBreakdown`, `cycleUtils`) can read it via a single hook `useSimulatedToday()` that returns either the override or `todayIST()`.

Logic wiring (only the *read* of "today" is swapped — no DB writes change):
- `src/lib/cycleUtils.ts` — accept an optional `today` arg (defaults to `todayIST()`), use it to pick the active/upcoming cycle for plan + fee matching.
- `src/components/register/BatchSelection.tsx`, `FeeBreakdown.tsx`, `JoinBatchFlow.tsx` — when computing eligible cycles, plan price, and discount tier, pass `simulatedToday` instead of calling `todayIST()` directly.
- The actual `start_date`, `end_date`, payment `created_at`, and any inserted rows continue to use real `nowIST()` / `todayIST()`. No backend / edge function changes.

### 2. Receipt preview modal after payment

After a successful payment in the Register flow, open a modal that previews the receipt the student will receive.

- New component `src/components/register/ReceiptPreviewDialog.tsx`:
  - Renders the same HTML used by the receipt email (extracted into a shared helper).
  - Iframe-renders the HTML so styles are isolated.
  - Shows recipient details (email + phone) and a "Close" button.
- Receipt template extracted from `supabase/functions/send-receipt/index.ts` into a frontend helper `src/lib/receiptTemplate.ts` so it can be rendered client-side. (Edge function imports the same string template via duplication — safe and tiny; we don't share code across the boundary.)
- Trigger: in `JoinBatchFlow` / `DropInFlow` Razorpay `onSuccess` handler (see `src/lib/razorpayUtils.ts`), after the existing success toast, open the dialog with the current student + payment details. Dialog appears for both test-mode and live-mode payments (as confirmed: receipt preview is independent of the test-date feature).

### Out of scope

- No DB schema changes.
- No edge function logic changes (receipt is still auto-sent server-side as it is today).
- Test date does NOT alter what is stored in `enrollments`, `payments`, or cycles — it only changes which plan/cycle the UI selects.
- No changes to other admin pages.

### Files touched

- `src/pages/Register.tsx` — test-date banner + context provider.
- New `src/contexts/TestDateContext.tsx` — provider + `useSimulatedToday()`.
- `src/lib/cycleUtils.ts` — accept optional `today` parameter.
- `src/components/register/JoinBatchFlow.tsx`, `BatchSelection.tsx`, `FeeBreakdown.tsx`, `DropInFlow.tsx` — use `useSimulatedToday()` when computing eligibility / pricing; open receipt preview on success.
- New `src/components/register/ReceiptPreviewDialog.tsx`.
- New `src/lib/receiptTemplate.ts` — shared HTML builder.
