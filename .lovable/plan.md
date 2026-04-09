

# Kids Division Default Level + My Account UI Improvements

## 1. Kids Division: Auto-select Level 1, Hide Higher Levels

**File: `src/components/register/LevelSelection.tsx`**

When `selectedStyle === "Kids"`, filter levels to only show the first/lowest level (e.g., "Kids Level 1") and auto-advance. This effectively hides higher Kids levels from the registration flow. Logic: filter Kids levels to keep only the one containing "1" or the first alphabetically, then auto-advance since there's only one.

## 2. My Account: Plans as Cards Instead of Dropdown

**File: `src/components/register/StudentDashboard.tsx`**

In the `mode === "renew"` section (lines 380-398), replace the `<Select>` dropdown for subscription plans with a grid of selectable cards matching the style already used in `JoinBatchFlow.tsx` pay step. Each card shows plan name, per-batch price, cycle count, and a check icon when selected.

## 3. My Account: Reorganize Renew/Add Flow — Batches First, Grouped by Studio & Style

**File: `src/components/register/StudentDashboard.tsx`**

In both `mode === "renew"` and `mode === "add"` sections:

- Move batch selection **above** plan selection (currently plan is first)
- Group batches by studio name, then by style_base within each studio (instead of a flat badge list)
- Display as collapsible sections: `Studio Name > Style > batch badges`
- Fetch studios data to get studio names for grouping
- Plan cards come after batch selection
- Payment mode and fee breakdown remain at the bottom

### Batch grouping structure:
```text
Studio A
  Jazz: [Jazz1-A] [Jazz2-A]
  Ballet: [Ballet1-A]
Studio B
  Hip Hop: [HipHop1-B]
```

## Files changed
- `src/components/register/LevelSelection.tsx` — auto-select lowest Kids level, hide higher ones
- `src/components/register/StudentDashboard.tsx` — plan cards, batch-first ordering, studio/style grouping

