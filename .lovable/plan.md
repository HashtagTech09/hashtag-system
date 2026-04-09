

# Cart-Based Batch Selection in My Account + Abandoned Cart Reminders

## Overview
Replace the current collapsible batch selector with a step-by-step Studio Card → Batch browsing flow. Selected batches go into a persistent cart. If the student leaves without completing checkout, their cart is saved for follow-up reminders.

## UI Flow

```text
[View Enrollments] → Click "Renew" / "Add Batch"
  → Step 1: Studio Cards (grid of cards, pick one)
  → Step 2: Batches for that studio (grouped by style, toggle to add to cart)
      - "← Back to Studios" link
      - Cart summary bar pinned at bottom showing count + total
  → Step 3: Cart Review + Plan Selection + Payment (checkout)
      - List of carted batches with remove buttons
      - Plan cards, payment mode, fee breakdown
      - "Confirm & Pay" button
```

## Database: New `abandoned_carts` table

Store cart data when a student has items in cart but navigates away or closes the page.

| Column | Type | Notes |
|---|---|---|
| id | bigint (PK) | auto |
| student_id | bigint | NOT NULL |
| organization_id | bigint | default 1 |
| batch_ids | jsonb | array of batch IDs |
| cart_type | text | "renew" or "add" |
| created_at | timestamptz | default now() |
| reminded_at | timestamptz | nullable, last reminder sent |
| status | text | "active" / "converted" / "expired" |

RLS: anon can INSERT and SELECT (student portal is unauthenticated). Authenticated can read all.

## Changes

### `src/components/register/StudentDashboard.tsx`

**Refactor the renew/add modes into a sub-step flow:**

1. Replace `BatchGroupedSelector` with a new multi-step component:
   - Sub-step "studio": render studios as clickable cards (like StudioSelection component)
   - Sub-step "batches": show batches for selected studio grouped by style, with add-to-cart toggle badges
   - Sub-step "checkout": cart review + plan cards + payment mode + fee breakdown + confirm

2. Add a floating cart bar at the bottom when items are in cart (shows count, "View Cart" button)

3. On `beforeunload` and on "← Back" to view mode: if cart has items, save to `abandoned_carts` table

4. On initial load (when student logs in): check `abandoned_carts` for active carts, pre-populate `selectedBatchIds` if found, show a toast "You have items in your cart from last time"

### `BatchGroupedSelector` → replaced by new components inline

The existing `BatchGroupedSelector` at the bottom of the file gets replaced by the new step-based UI described above.

### Edge function or cron (future)

For sending reminders, a cron job can query `abandoned_carts WHERE status = 'active' AND reminded_at IS NULL AND created_at < now() - interval '1 hour'` and send WhatsApp messages. This can be a follow-up task — the cart persistence is the immediate deliverable.

## Files changed
- **Migration**: create `abandoned_carts` table with RLS policies
- `src/components/register/StudentDashboard.tsx` — refactor renew/add modes into studio-card → batch-cart → checkout flow; add cart persistence via `beforeunload`; restore abandoned cart on login

