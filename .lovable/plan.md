

# Add Second Instructor to Batches

## Problem
Batches currently support only one instructor (`instructor_id` column). Need to support 2 instructors per batch.

## Approach
Add an `instructor_2_id` column to the `batches` table rather than a junction table — simpler for a fixed max of 2.

## Changes

### Database Migration
- Add `instructor_2_id bigint` nullable column to `batches` table

### `src/pages/Batches.tsx`
- Add `instructor_2_id` to form state
- Add second instructor `<Select>` dropdown in the dialog (labeled "Instructor 2")
- Include `instructor_2_id` in save payload
- Update the edit handler to populate `instructor_2_id` from existing batch
- Update the table query to join the second instructor name (or fetch separately)
- Display both instructor names in the table's Instructor column (e.g. "Alice, Bob" or "Alice" if only one)

### `src/components/register/BatchBrowser.tsx`
- No changes needed (doesn't display instructor info currently)

## Technical Details
- Migration: `ALTER TABLE public.batches ADD COLUMN instructor_2_id bigint;`
- The select query changes to: `supabase.from("batches").select("*, studios(name), users!batches_instructor_id_fkey(name)")` — but since there are no foreign keys defined, the current approach uses `users(name)` which may need adjustment. We'll fetch instructor names by joining against the instructors list in-memory instead.

