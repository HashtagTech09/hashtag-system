# Fee System with Status-Based ₹500 Registration Charge

## Overview

Replace the current manual status_type selection with auto-detection based on enrollment history. Apply ₹500 registration fee conditionally: always for NEW/REV, only after expiry for REN. Add a fee breakdown display before confirmation.

## Changes

### 1. Auto-detect student status (`Enrollments.tsx`)

When a student is selected, query their enrollment history:

- **No enrollments** → `NEW`
- **Has enrollment with `end_date >= today**` → `REN` (active)
- **All enrollments** `end_date < today< end_date + grace days` → `REN` (Late , charge 500)
- **All enrollments `end_date < today**` → `REV` (lapsed)

Remove the manual status_type dropdown — compute it automatically. Store the latest enrollment's `end_date` for REN fee logic.

### 2. Registration fee logic

```
if (status === "NEW" || status === "REV") → regFee = ₹500
if (status === "REN") → regFee = (today > latest_end_date) ? ₹500 : ₹0
```

Registration fee applied once per transaction (not per batch).

### 3. Fee breakdown display

Before the "Confirm Enrollment" button, show a summary card:


| Line Item              | Amount     |
| ---------------------- | ---------- |
| Batch fees (N batches) | ₹X,XXX     |
| Registration fee (NEW) | ₹500       |
| Drop-in adjustment     | -₹XXX      |
| **Total**              | **₹X,XXX** |


### 4. Implementation details

- Add `useEffect` on `form.student_id` change to query `enrollments` for that student, determine status and latest `end_date`
- Store computed `status_type` and `latestEndDate` in component state
- Update `handleEnroll` to use auto-detected status for fee calculation
- Keep status_type as read-only badge in the form (not editable)
- REN late_renewal flag: set `true` if `today > latest_end_date`

### File: `src/pages/Enrollments.tsx`

- Add student status auto-detection effect
- Replace status dropdown with computed read-only badge
- Update `handleEnroll` fee logic for REN expiry check
- Add fee breakdown UI section before confirm button