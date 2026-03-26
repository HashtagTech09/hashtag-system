

# Dashboard Layout Revamp

## Overview
Reorganize dashboard into grouped rows with expandable batch-wise views, card-based date breakdown, and separated revenue section. Change accent to `#ff007f`.

## Layout Structure

```text
Row 1: Total Dreams (expandable → batch-wise) | Head Count
Row 2: New Dreams (expandable → batch-wise NEW) | REV Dreams (expandable → batch-wise REV)
Row 3: REN Rate (expandable → batch-wise REN) | REN Dreams vs Renewable
Row 4: Date-wise cards (each date = a card with NEW/REN/REV/Drop-In counts)
Row 5: Drop-In card (Total Drop-Ins vs DI Adjusted)
Row 6: Revenue section (Gross, GST, Total, Cash vs Razorpay breakdown)
```

## Changes — `src/pages/Dashboard.tsx`

### 1. Fix accent color
Change `const ACCENT = "#ff07ff"` → `"#ff007f"`

### 2. Replace KPI grid with 3 grouped rows
- **Row 1** (2 cards, `grid-cols-2`):
  - **Total Dreams** card — collapsible, expands to show batch-wise table (batch name + enrolled + capacity + fill%)
  - **Head Count** card — simple display
- **Row 2** (2 cards, `grid-cols-2`):
  - **New Dreams** card — collapsible, expands to batch-wise NEW count per batch
  - **REV Dreams** card — collapsible, expands to batch-wise REV count per batch
- **Row 3** (2 cards, `grid-cols-2`):
  - **REN Rate** card — shows `X%` (renDreams/renewableCount), collapsible → batch-wise REN count per batch
  - **REN Dreams** card — shows `renDreams / renewableCount renewable`

Each expandable card uses `Collapsible` with a `ChevronDown` toggle. Batch-wise tables inside show per-batch counts filtered by the relevant status.

### 3. Remove standalone charts and old batch-wise collapsible
Delete the pie chart, bar chart, and the separate batch-wise collapsible section. The batch data is now inline within the expandable KPI cards.

### 4. Date-wise breakdown as cards
Replace the date-wise table with a grid of cards (one per date). Each card shows:
- Date as title
- NEW / REN / REV / Drop-In counts as labeled values

### 5. Drop-In card
A single card showing:
- Total Drop-Ins vs DI Adjusted count
- Highlight adjusted count in accent

### 6. Revenue section
A separate section titled "Revenue" with:
- Summary card: Gross, GST, Total (highlighted)
- Payment mode card: Cash vs Razorpay totals
- Optionally a small date-wise revenue table below

### Computed data additions
- `batchStatusData`: for each batch, compute counts of NEW, REN, REV separately (used in expandable views)

## No database or migration changes needed.

