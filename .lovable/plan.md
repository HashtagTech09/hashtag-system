# Payments CSV Export

Add a "Download CSV" button on the Payments page (top right, next to the search bar) that exports all currently-filtered payments as a CSV file matching your old system's column layout.

## CSV columns (in order)

| Column | Source | Notes |
|---|---|---|
| Date | `payments.created_at` (IST, DD/MM/YYYY) | |
| Name | `students.name` | |
| Phone No. | student phone, fallback to linked user phone | |
| Email ID | student email, fallback to linked user email | |
| Receipt No. | — | left blank |
| Status | `payments.status` | success / pending / failed |
| Validity | enrollment start–end dates for this payment | see technical notes |
| Online/Offline | — | left blank |
| Batch | batch name(s) from enrollments linked to this payment | comma-separated if multiple |
| No. Of Batches | — | left blank |
| Gross Amount | `payments.amount` | pre-GST |
| GST @18% | `payments.gst` (falls back to amount × 0.18 if null) | |
| Amount Paid | `payments.final_amount` (falls back to amount + gst) | |
| Mode of Payment | `payments.payment_mode` | cash / razorpay |
| Paid To | `payments.rzp_account` for online; blank for cash | "pride" / "prudent" |

## Behaviour

- Button appears only for managers/admins (uses `isAdminOrManager` from `useAuth`).
- Exports the **currently filtered** list (respects the search box).
- Filename: `payments-YYYY-MM-DD.csv` using today's IST date.
- Values containing commas, quotes, or newlines are properly CSV-escaped.

## Technical notes

- Extend the existing `fetchPayments` query in `src/pages/Payments.tsx` to also pull `enrollments(start_date, end_date, batches(name))` so Validity and Batch are available without extra round-trips.
- Use existing `toISTDateString` from `src/lib/dateUtils.ts` for dates.
- Use existing `getDisplayPhone` from `src/lib/studentUtils.ts` for phone fallback; add a small equivalent for email fallback inline.
- Build the CSV client-side (no new dependency) and trigger download via a Blob + temporary anchor.

## Out of scope

- No backend/edge function changes.
- No schema changes.
- Receipt No., Online/Offline, and No. Of Batches stay blank as requested.
