# Batch Details Popup

Replace the inline-only batch list with a clickable row that opens a popup with the full alphabetized student list for that batch. Keeps the existing Total Dreams / Head Count / NEW / REV / REN / C/F tables intact — only adds an overlay on row click / long-press.

## Behavior

- **Desktop (and tablet tap):** click a batch row → centered modal opens (fade + scale animation, backdrop blur, X button, close on outside click / Esc).
- **Mobile (<768px):** opens as a bottom sheet/drawer instead. Long-press (~500ms) on the row triggers it; a normal tap also opens it (no other quick action is defined today, so tap stays as the primary open gesture on touch). Tablet supports both tap and long-press.
- Popup content is only mounted when opened (lazy fetch).

## Popup contents

- Header: batch name + batch_code, total students count, close button.
- Search bar (filters by name/phone, client-side).
- Scrollable student list, sorted A–Z by name. Each row:
  - Name
  - Status badge (NEW / REN / REV / C/F — derived from the same `classifiedEnrollments` already computed on the Dashboard for the selected cycle, so it stays consistent with the table).
  - Phone (from `getDisplayPhone` util — falls back to primary user).
  - Hover/tap highlight.
- Quick actions per row (icon buttons): Call (`tel:`), WhatsApp (`https://wa.me/...`), Mark Attendance (navigates to `/attendance?batch=…`), Open Profile (navigates to `/students?id=…`).
- Loading: shadcn `Skeleton` rows while fetching.
- Empty state when no students match search.

## Data flow

- Selected batch id + cycle range (already known on Dashboard) → React Query key `["batch-students", batchId, cycleStart, cycleEnd]`.
- Query fetches `enrollments` for that batch within the selected cycle window (mirroring the existing Dashboard filter: `is_active=true`, status filter, date overlap), joins to `students(*, users(name,phone,email))`.
- Dedupe by student_id, derive each student's status from their enrollment row (NEW/REN/REV; C/F if their enrollment started before cycle start).
- Sort alphabetically by name (case-insensitive).
- Scoped-manager access: pass through `useScopedStudents()` — if `unrestricted` is false, intersect with `studentIds` before rendering.

## UI / styling

- Reuse existing tokens: `glass-card`, `gradient-primary`, `text-primary` (hot pink accent), `Space Grotesk` for the heading.
- Desktop: shadcn `Dialog` (already has fade + zoom animations and `bg-black/80` overlay — add `backdrop-blur-sm` to overlay).
- Mobile: shadcn `Drawer` (vaul) — same content component, different wrapper chosen via `useIsMobile()`.
- Rounded `rounded-2xl`, soft shadow `shadow-elegant`, list items `rounded-lg hover:bg-accent/50 transition-colors`.

## Files

- New: `src/components/dashboard/BatchDetailsPopup.tsx` — responsive wrapper (Dialog on desktop, Drawer on mobile) + content (header, search, list, actions, skeleton).
- New: `src/hooks/useLongPress.ts` — tiny helper returning `onTouchStart/End/Move/onMouseDown/Up/Leave` handlers (~500ms threshold, cancel on move).
- Edit: `src/pages/Dashboard.tsx`
  - Add `selectedBatch` state.
  - In `BatchTable`, make `<TableRow>` clickable (`cursor-pointer hover:bg-accent/40`) and wire long-press handlers; `onClick` / long-press → `setSelectedBatch(b)`.
  - Render `<BatchDetailsPopup batch={selectedBatch} cycle={selectedCycle} open={!!selectedBatch} onOpenChange={...} />` once at page bottom.

## Out of scope

- No DB schema or RLS changes.
- No changes to the other dashboard cards (Head Count, NEW/REV/REN/CF) beyond the same row-click affordance reusing the new popup.
- Mark Attendance / Open Profile use existing routes; no new pages.
