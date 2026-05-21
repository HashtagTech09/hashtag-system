# Add expanded view for REN Dreams card

## What changes

On the Dashboard (`/`), the **REN Dreams** card (Row 3, right side) is currently a `SimpleCard` (non-expandable). Convert it to an `ExpandableCard` matching the pattern used by New Dreams, REV Dreams, and REN Rate — so admins can drill into the batch-wise breakdown of renewal enrollments for the selected cycle.

When expanded, it shows a `BatchTable` with `valueKey="REN"` — same data already powering the REN Rate expansion (batches with REN > 0, count, capacity, fill bar, long-press/click to open `BatchDetailsPopup`).

## Scope

- Edit only `src/pages/Dashboard.tsx`.
- Add one new state: `renDreamsOpen` (separate from existing `renOpen` which belongs to REN Rate).
- Replace the `SimpleCard` for REN Dreams with `ExpandableCard` + `<BatchTable data={batchData} valueKey="REN" />`.
- Keep highlight styling, value, and subtitle (`${renewableCount} renewable`) unchanged.

No data, query, or schema changes. No other cards affected.
