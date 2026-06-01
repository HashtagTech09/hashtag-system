## Simplify Instructor Evaluation Module

Strip the module down to a single instructor-facing flow: tick the checklist and upload choreography if required. Remove manager dashboards and library.

### Remove
- `/evaluations` (Leaderboard), `/evaluations/compliance`, `/evaluations/analytics`, `/choreography` routes
- Sidebar entries: Evaluations, Compliance, Analytics, Choreography
- Files: `src/pages/evaluations/Leaderboard.tsx`, `Compliance.tsx`, `Analytics.tsx`, `src/pages/ChoreographyLibrary.tsx`
- Star ratings (attire, culture) — drop from form
- `StarRating` component (no longer used)

### Keep & simplify
- `/instructor` — today's classes with "Submit Report" button
- `/instructor/report/:sessionId` — one screen with:
  - Class info (read-only)
  - Students present (number input)
  - **15 checkbox toggles** (3 grouped sections, as today)
  - **Choreography upload** (single video field, required to submit)
  - Optional notes
  - Submit button
- `/instructor/reports` — instructor's own history (kept, lightweight)
- Sidebar: only "My Classes" stays for instructors

### Data
- No schema changes. `attire_rating` and `culture_rating` columns stay in DB (default 0) — unused going forward, harmless.
- Continue writing to `instructor_reports` + `choreography_uploads` + `class-media` bucket as today.

### Score
- Simplified `computeScore` = sum of 15 booleans / 15 × 100% (drop attire/culture from UI math).

That's it — instructor ticks boxes, uploads the video, submits. No manager surfaces.
