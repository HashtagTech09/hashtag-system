

# Calendar View for Batch Sessions

## Overview
Add a third tab "Calendar" to the BatchSessionsDialog that renders sessions on a month calendar grid, giving a visual overview of when sessions fall and their status.

## Approach
Use the existing `react-day-picker` `Calendar` component with custom `modifiers` and `modifiersStyles` to color-code dates that have sessions. Clicking a date shows a popover or inline panel with that day's session details and actions.

## Changes: `src/components/BatchSessionsDialog.tsx`

### New "Calendar" tab
- Add a third tab button alongside "Sessions" and "Generate"
- When active, render a `Calendar` component in `month` mode

### Calendar rendering
- Build a map of `date → Session[]` from the sessions array
- Use `react-day-picker`'s `modifiers` prop to highlight dates by status:
  - Scheduled → blue dot/highlight
  - Cancelled → red
  - Holiday → yellow
  - Sold Out → gray
  - Completed → green
- For dates with multiple sessions, show the "most important" status color

### Day click interaction
- Clicking a date with sessions shows an inline detail panel below the calendar listing that day's sessions with:
  - Time, status badge, slots info
  - Quick actions (status change, delete) via the existing dropdown menu

### Layout
```text
┌─────────────────────────────────────────┐
│ [Sessions] [Calendar] [Generate]        │
├─────────────────────────────────────────┤
│        ◄  March 2026  ►                 │
│  Mo  Tu  We  Th  Fr  Sa  Su             │
│                           1             │
│  2   3   4   5   6   7   8              │
│  9  10  11  12  13  14  15              │
│ 16  17  18  19  20  21  22              │
│ ●23 24 ●25  26 ●27  28  29              │
│ ●30 31                                  │
├─────────────────────────────────────────┤
│ March 23 (Mon):                         │
│ 18:00–19:00  [Scheduled]  Slots: 20  ⋮  │
└─────────────────────────────────────────┘
```

- Dots/highlights on dates with sessions
- Selected date detail panel below

## Technical Details
- No new dependencies — uses existing `Calendar` component and `date-fns`
- Custom day rendering via `react-day-picker`'s `components` or `modifiers` to show dots
- All existing session CRUD actions reused from current code

