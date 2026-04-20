

## Show Batch ID & Studio in Enrollments table

Add two new columns to the Enrollments listing table so each row shows the batch's identifier (`batch_code`, e.g. `Jazz3-NDA`) and the studio it belongs to.

### Changes to `src/pages/Enrollments.tsx`

**1. Extend the data fetch** (line 51) — pull `batch_code` and the joined studio name from the existing `batches` relation:
```ts
batches(name, batch_code, studio_id, studios(name, code))
```

**2. Add two table headers** (after the existing "Batch" column, line 752):
- `Batch Code` — hidden on mobile (`hidden sm:table-cell`)
- `Studio` — hidden on small screens (`hidden md:table-cell`)

**3. Add two table cells** in the row render (after line 765):
- `{e.batches?.batch_code || "—"}`
- `{e.batches?.studios?.name || "—"}` (with studio code as muted suffix if present)

**4. Update `colSpan`** on the empty-state row from `8` to `10` (line 775).

### Layout (1189px viewport)

```text
Student | Phone | Batch | Batch Code | Type | Plan | Cycles | Studio | Start | End
```

### Files
- `src/pages/Enrollments.tsx` (single edit)

