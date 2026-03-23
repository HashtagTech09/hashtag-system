

# Enable Mouse Wheel Scrolling in Time Picker

## Problem
The `ScrollArea` (Radix) only allows scrolling via the thin scrollbar handle. Users expect to scroll through hours/minutes by using their mouse wheel or trackpad directly over the list content.

## Fix
Replace `ScrollArea` with plain `div` containers that have native `overflow-y: auto` styling. This enables natural mouse wheel / trackpad scrolling on the hour and minute columns without needing the Radix scrollbar abstraction.

## Changes: `src/components/ui/time-picker.tsx`
- Remove `ScrollArea` import
- Replace the two `<ScrollArea>` wrappers with `<div className="h-48 w-14 overflow-y-auto border-r border-border">` containers
- Keep the inner `ref` divs and button items unchanged

This is a minimal change — just swapping the wrapper element to enable native scroll behavior.

