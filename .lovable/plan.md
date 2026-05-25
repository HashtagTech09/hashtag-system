# Sort Dashboard Batches by Style and Level

## What changes

In the Dashboard (`/`), the batch breakdown tables in expandable cards (Total Dreams, New Dreams, REV Dreams, REN Dreams, REN Rate) and the Head Count table currently sort batches by enrollment count (descending). Change this to a fixed style-based sort:

1. Kids Jazz (Kids → Kids Level 2)
2. Kids Ballet (Kids → Kids Level 2)
3. Jazz (Level 1 → Level 5)
4. Ballet (Level 1 → Level 5)
5. Modern (Level 1 → Level 5)
6. Hip Hop (Level 1 → Level 5)
7. Heels (Level 1 → Level 5)

This consistent order across all cards lets you visually match data across cards.

## Technical details

1. Update batch query in `Dashboard.tsx` to also select `style_base, level`.
2. Add `style_base` / `level` to the `Batch` interface and pass them through into `batchData` and `headCountData`.
3. Add a sort comparator:
   - Group rank: `Kids` (level starts with "Kids") = 0, others = 1.
   - Style rank: Jazz=1, Ballet=2, Modern=3, Hip Hop=4, Heels=5, unknown=99.
   - Level rank: Kids=0, Level 1=1 … Level 5=5, Kids Level 2=6, unknown=99.
   - Sort by (group, style, level), tiebreak on batch name.
4. Replace the existing `.sort((a, b) => b.total - a.total)` and `.sort((a, b) => b.count - a.count)` with the new comparator.

No data, query semantics, or other components change.
