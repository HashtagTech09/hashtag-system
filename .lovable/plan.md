# Application Cases Workflow

A manager or admin can request to move an enrollment into "Application Case" status. The request goes to admins for approval. On approval, the enrollment is marked inactive (hidden from Enrollments) and listed under Application Cases. No "send back" flow — once approved the enrollment stays inactive.

## Database changes

1. Add `is_active boolean NOT NULL DEFAULT true` to `enrollments`.
2. New table `application_cases`:
   - `enrollment_id` (the target enrollment)
   - `student_id`, `batch_id`, `organization_id`
   - `requested_by_user_id`, `requested_at`, `reason` (text, optional)
   - `status` text — `pending` | `approved` | `rejected` (default `pending`)
   - `reviewed_by_user_id`, `reviewed_at`, `review_notes`
3. Index on `(organization_id, status)` for fast pending-count queries.
4. Realtime publication on `application_cases` so the pending badge updates live.
5. RLS: authenticated users can read/insert/update (matches existing pattern in this project).

## Backend rules (enforced in UI for now, since RLS is permissive)

- Anyone with the manager or admin role can INSERT a pending case.
- Only admin can UPDATE status to `approved` / `rejected`.
- On `approved`: set `enrollments.is_active = false` for that enrollment_id (single transaction via two awaited calls; acceptable given existing patterns).
- Re-requesting on an already-pending or approved enrollment is blocked client-side.

## UI changes

### Enrollments page (`src/pages/Enrollments.tsx`)
- Default query filters `is_active = true` so approved cases disappear from the list.
- Add row action **"Request Application Case"** (visible to manager + admin). Opens a small dialog asking for an optional reason. Submitting inserts a pending row. Toast confirmation.
- If a pending case already exists for that enrollment, show a yellow "Pending Application Case" badge instead of the action.

### New page `src/pages/ApplicationCases.tsx` (route `/application-cases`)
- Three tabs: **Pending**, **Approved**, **Rejected**.
- Pending tab shows: student, batch, requested by, requested at, reason, and (admin only) **Approve** / **Reject** buttons. Reject opens a small notes field.
- Approved/Rejected tabs are read-only history with reviewer + timestamp.
- Top of page shows an orange notification banner for admins when pending count > 0: "X application case(s) awaiting your approval".
- Search + studio filter to match the Enrollments UX.

### Sidebar (`src/components/AppSidebar.tsx`)
- New "Application Cases" entry under Enrollments.
- Pending count badge (red dot with number) visible only to admins, sourced from a small `useApplicationCasesCount` hook subscribing to realtime.

### Routing (`src/App.tsx`)
- Register `/application-cases` route, admin/manager-gated like other admin pages.

## Technical notes

- Use existing role helpers from `useAuth()` (`isAdmin`, `isAdminOrManager`).
- Approval flow:
  ```ts
  await supabase.from("application_cases")
    .update({ status: "approved", reviewed_by_user_id, reviewed_at: nowIST() })
    .eq("id", caseId);
  await supabase.from("enrollments")
    .update({ is_active: false })
    .eq("id", enrollmentId);
  ```
- Update Dashboard / analytics queries that read `enrollments` to add `.eq("is_active", true)` so renewal/headcount metrics aren't skewed by application-case rows. (Will audit `Dashboard.tsx`, `Students.tsx`, `cycleUtils.ts`, registration flow queries during implementation.)
- No edge function needed.
- No changes to payments, cycles, or `cycle_adjustments`.

## Out of scope (per your answer)

- Re-activating an enrollment with new cycles. If you want that later, we can add a "Send back" admin action that resets `is_active` and optionally calls `cycle_adjustments`.
