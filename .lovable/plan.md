# Restore Application Case to Enrollment

Admins can take an approved application case (which previously withdrew a student from a batch) and put that student back into an active enrollment — either into the same batch or a different one they pick.

## Where it appears

On `/application-cases`, in the **Approved** tab, each row gets a new action button **"Restore to Enrollment"** (admin-only, mirrors Approve/Reject permission rules). Not shown on Pending or Rejected tabs.

## Flow

1. Admin clicks **Restore to Enrollment** on an approved case row.
2. A modal opens showing:
   - Student name (read-only)
   - Original batch (read-only, for reference)
   - **Batch selector** — dropdown of all batches in the org. Defaults to the original batch.
   - Validity window (read-only): the original enrollment's `start_date → end_date` and cycle range. This is reused as-is.
   - Optional note field.
3. Admin confirms → system restores enrollment:
   - **Same batch chosen** → flip the original `enrollments.is_active` back to `true`.
   - **Different batch chosen** → insert a new `enrollments` row cloning the original (same student, dates, cycles, plan, status_type, payment_id, previous_batch_id) with `batch_id` = selected batch and `is_active = true`. Original stays inactive.
4. The `application_cases` row is updated: `status = 'restored'`, `reviewed_by_user_id = current admin`, `reviewed_at = now`, plus the optional note appended to `review_notes`.
5. Toast confirmation, list refreshes (already realtime-subscribed).

## Tab changes

Add a fourth tab **Restored** alongside Pending / Approved / Rejected so restored cases are still visible (and don't clutter Approved). The status filter just adds `"restored"` as a valid value.

## Technical notes

- File edited: `src/pages/ApplicationCases.tsx` only. No schema changes — `application_cases.status` is a free `text` column, so `'restored'` is allowed without a migration.
- New local state: `restoreOpen`, `activeCase` (reused), `selectedBatchId`, `restoreNote`, `batches` list.
- Fetch batches once on mount: `supabase.from("batches").select("id, name, batch_code, studios(name, code)").eq("organization_id", 1).order("name")`.
- Restore handler (sketch):
  ```ts
  if (selectedBatchId === c.batch_id) {
    await supabase.from("enrollments").update({ is_active: true }).eq("id", c.enrollment_id);
  } else {
    // fetch original enrollment, clone with new batch_id
    const { data: orig } = await supabase.from("enrollments").select("*").eq("id", c.enrollment_id).single();
    const { id, created_at, ...rest } = orig;
    await supabase.from("enrollments").insert({
      ...rest,
      batch_id: selectedBatchId,
      previous_batch_id: orig.batch_id,
      is_active: true,
    });
  }
  await supabase.from("application_cases").update({
    status: "restored",
    reviewed_by_user_id: staffUser.id,
    reviewed_at: nowIST().toISOString(),
    review_notes: restoreNote || null,
  }).eq("id", c.id);
  ```
- Permission gate: same `isAdmin` check used for Approve/Reject.

## Out of scope

- No payment/cycle recalculation — assumes admin is reversing a mistaken withdrawal within the same validity window.
- No bulk restore.
- No new RLS or DB function.
