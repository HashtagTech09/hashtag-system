

# Restructure Registration Flow: Studio → Style → Level → Batch + Card-Style Plan Selector

## Problem
1. The current flow is Style → Studio → Batch, which dumps all batches for a style at once (as seen in the screenshot with dozens of "Ballet 1", "Jazz 1" chips). This is confusing.
2. The subscription plan is a dropdown — the user wants it displayed as selectable cards/boxes.

## New Flow
```text
Step 1: Studio     → pick a studio location
Step 2: Style      → pick a dance style (filtered to styles available at that studio)
Step 3: Level      → pick a level (filtered to levels available for that style+studio)
Step 4: Batch      → pick specific batch(es) (filtered by studio+style+level)
Step 5: Phone/OTP  → verify identity
Step 6: Pay        → plan shown as cards, review & pay
```

## Changes

### 1. `src/components/register/JoinBatchFlow.tsx`
- Change step order from `style → studio → batch` to `studio → style → level → batch`
- Add `selectedLevel` state
- Update step type: `"studio" | "style" | "level" | "batch" | "phone" | "details" | "pay" | "waiting"`
- Update step labels and indices accordingly
- StudioSelection no longer receives `selectedStyle` — it fetches all studios that have any batches
- StyleSelection receives `studioId` and only shows styles available at that studio
- New LevelSelection step between style and batch
- BatchSelection receives `studioId`, `selectedStyle`, and `selectedLevel`

### 2. `src/components/register/StudioSelection.tsx`
- Remove `selectedStyle` prop dependency — fetch all studios that have any batches (no style filter)
- Keep the same card UI

### 3. `src/components/register/StyleSelection.tsx`
- Accept `studioId` prop
- Fetch distinct `style_base` values from batches at that studio instead of hardcoded STYLES array
- Only show styles that actually exist at the selected studio
- Add back button

### 4. New: `src/components/register/LevelSelection.tsx`
- Accept `studioId`, `selectedStyle` props
- Fetch distinct `level` values from batches matching studio + style
- Display as selectable cards (similar to style cards)
- If only one level exists, auto-advance
- Back button to return to style selection

### 5. `src/components/register/BatchSelection.tsx`
- Add `selectedLevel` prop to filter query
- Query now filters by `studio_id + style_base + level` — much fewer results
- Keep existing card-based multi-select UI

### 6. Subscription Plan as Cards (in JoinBatchFlow pay step)
- Replace the `<Select>` dropdown for subscription plans with a grid of selectable cards
- Each card shows: plan name, per-batch price, number of cycles
- Selected card gets a ring/glow treatment matching the existing batch selection style

## Files changed
- `src/components/register/JoinBatchFlow.tsx` — reorder steps, add level state, card-style plan selector
- `src/components/register/StudioSelection.tsx` — remove style filtering, fetch all studios with batches
- `src/components/register/StyleSelection.tsx` — filter by studioId, add back button
- `src/components/register/BatchSelection.tsx` — add level filter prop
- **New:** `src/components/register/LevelSelection.tsx` — level picker step

