

# Update Batches: Remove Level, Convert Style to Dropdown

## Changes to `src/pages/Batches.tsx`

1. **Remove `level` from form state** — remove it from the initial state, edit handler, and save payload
2. **Remove Level column** from the table display
3. **Remove Level select** from the dialog form
4. **Convert Style field** from free-text `Input` to a `Select` dropdown with these options:
   - Jazz Level 1, Jazz Level 2, Jazz Level 3, Jazz Level 4
   - Ballet Level 1, Ballet Level 2, Ballet Level 3
   - Modern Level 1
   - Hip Hop Level 1, Hip Hop Level 2, Hip Hop Level 3
   - Heels Level 1, Heels Level 2

5. **Remove Level from grid layout** — Style select takes full width or stays in the same spot without the level field beside it

