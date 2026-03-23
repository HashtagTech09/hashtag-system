

# Fix Two-Finger Trackpad Scrolling in Time Picker

## Problem
On Mac, two-finger trackpad scrolling doesn't work inside the time picker popover. This is because Radix UI's `PopoverContent` captures and blocks scroll/wheel events by default to prevent background page scrolling.

## Fix (`src/components/ui/time-picker.tsx`)

Add explicit `onWheel` handlers with `e.stopPropagation()` on the hour and minute scroll containers to ensure wheel events are consumed by the scrollable div rather than being intercepted by the Popover layer. Also add the CSS property `overscroll-behavior: contain` to prevent scroll chaining to the parent/page.

Changes to the two scrollable divs (hours and minutes):
```tsx
<div
  className="h-48 w-14 overflow-y-auto border-r border-border"
  style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
  onWheel={(e) => e.stopPropagation()}
>
```

This is a 2-line addition per scrollable container — no structural changes needed.

