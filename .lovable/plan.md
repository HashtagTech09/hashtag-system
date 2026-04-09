

# Studio Dropdown, Batch Cards, and Add Batch Primary Logic

## Changes

### 1. Studios: Replace card grid with a dropdown
In the "studio" sub-step (and "batches" sub-step header), replace the grid of studio cards with a `Select` dropdown. When a studio is selected, immediately show batches below (merge "studio" and "batches" into one step — dropdown at top, batch cards below).

### 2. Batches: Replace small badges with larger cards
Replace the current `Badge` toggles with proper `Card` components showing:
- **Batch name** (e.g., "Jazz1-NDA")
- **Batch code** (batch_code field)
- **Timings** — parsed from the `schedule` JSONB field (day + start/end time)
- **Current validity** — if the student has an active enrollment for this batch, show the enrollment end_date with a green "Active till..." indicator
- Selected state indicated by a border highlight + checkmark

### 3. Add Batch pricing logic: New batch = primary (no discount)
Current logic: existing batches keep their positional rank (1st=0%, 2nd=12%, etc.) and new batches get the next position's discount.

New logic:
- The **new batch(es) being added become position 1** (primary, full price for their full plan cycles)
- **Existing batches that need validity extension** are charged for missing cycles at discounted rates (2nd=12%, 3rd=13%, etc.)
- Existing batches already fully covered = ₹0

Update `computeAddBatchBreakdown` in `enrollmentUtils.ts` to reorder: new batches first (position 1, 2, ...), then existing batches that need extension (position N+1, N+2, ...).

### Example
Student has 2 batches (valid till May). Adds 1 new batch, selects Apr+May+Grid plan:
- New batch = position 1: full price for 3 cycles (Apr+May+Grid) = base
- Existing batch 1 = position 2: Grid only at 12% discount
- Existing batch 2 = position 3: Grid only at 13% discount

## Files changed
- `src/components/register/StudentDashboard.tsx` — dropdown for studios, batch cards with timings/validity, UI restructure
- `src/lib/enrollmentUtils.ts` — reorder `computeAddBatchBreakdown` so new batches are primary (position 1+) and existing batches are secondary

