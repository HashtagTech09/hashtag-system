## Add Attire & Culture Star Ratings Back to Report

Re-introduce the two 5-star ratings on the instructor report form, alongside the 15 checklist toggles.

### Changes
- **`src/components/evaluations/StarRating.tsx`** — recreate the star picker component (1–5).
- **`src/lib/evaluationScoring.ts`** — extend `computeScore` to include `attire_rating` + `culture_rating`. New max = 15 (checklist) + 10 (5+5) = **25**. Returns `{ checklistTotal, ratingTotal, total, pct }`.
- **`src/pages/instructor/ReportForm.tsx`**
  - Add state for `attireRating` and `cultureRating` (default 0).
  - Render a new "Ratings" section with two `StarRating` rows: Attire, Culture.
  - Include both in the insert payload (columns already exist in `instructor_reports`).
  - Sticky footer shows `score/25 (pct%)`.
- **`src/pages/instructor/MyReports.tsx`** — display `total_score / 25` instead of `/15` (DB generated column already totals all 25).
- **`src/pages/instructor/Home.tsx`** — no logic change; `compliance_pct` from DB already reflects /25.

### Data
No schema changes — `attire_rating`, `culture_rating`, `total_score` (generated, max 25), and `compliance_pct` columns already exist.
