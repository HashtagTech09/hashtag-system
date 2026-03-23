

# Clock-Style Time Picker for Batch Schedule

## Overview
Replace the native `<Input type="time">` fields in the batch schedule builder with a custom clock-style time picker using scroll wheels for hours, minutes, and AM/PM selection — wrapped in a Popover.

## Approach
Create a reusable `TimePickerPopover` component that:
- Shows a button displaying the current time (or "Pick time")
- On click, opens a Popover with three scroll columns: **Hour** (1-12), **Minute** (00, 05, 10, ... 55), **AM/PM**
- On selection, converts to 24h format and calls `onChange` with the HH:mm string

## New File: `src/components/ui/time-picker.tsx`
- A `TimePickerPopover` component with props: `value: string` (HH:mm 24h), `onChange: (time: string) => void`, `placeholder?: string`
- Inside the popover: three side-by-side scrollable lists for hour, minute, AM/PM
- Highlighted/selected items styled distinctly
- Auto-scrolls to current selection on open

## Changes: `src/pages/Batches.tsx`
- Replace `<Input type="time" ...>` on lines 167 and 169 with `<TimePickerPopover>` components
- Import the new component

## Visual Design
```text
┌─────────────────────┐
│  [06:00 PM]  button  │  ← click to open
├─────────────────────┤
│  Hr │ Min │  AM/PM  │
│  04 │  00 │   AM    │
│  05 │  05 │ ●PM     │
│ ●06 │  10 │         │
│  07 │  15 │         │
│  08 │ ●20 │         │
└─────────────────────┘
```

