Deactivate Kaira Dua's stale Kids Ballet enrollment so she only appears in Ballet 1.

## Change
- Set `is_active = false` on `enrollments.id = 16821` (student 4355, batch 28 "Kids Ballet", KidsBallet-NDA).
- Leave enrollment 17915 (Ballet 1) untouched — remains active.

## Scope
- Data-only fix via migration. No code changes.
- Does not touch payments, allocations, cycles, or attendance.

## Verification
- Re-query active enrollments for student 4355 → should return only row 17915 (Ballet 1).