
## Goal

Add an end-to-end **Instructor Evaluation & Choreography Upload** module so instructors submit a structured class report (with choreography video) after every session, and managers can monitor quality, compliance, and performance across studios.

Existing assets reused: `users` (instructors), `studios`, `batches`, `batch_sessions`, `attendance`, `photos` storage bucket, role system (`isInstructor`, `isAdminOrManager`), `AdminLayout`, `StaffDashboard`.

---

## 1. Database (new tables, all org-scoped, RLS + GRANTs)

**`instructor_reports`** — one row per `batch_session_id` per instructor.
- `batch_session_id`, `batch_id`, `studio_id`, `instructor_id` (→ users.id), `organization_id`
- `session_date`, `style`, `students_present` int, `notes` text
- 15 boolean checklist columns (form, relationship_building, syllabus_followed, information_imparted, punctuality, absentee_calls, absentee_update, attendance_marked, registration_followup, renewal_followup, playlist_prepared, videos_shot, story_posted, briefing_done, poa_shared)
- `attire_rating` 1–5, `culture_rating` 1–5
- `total_score` int (generated 0–25), `compliance_pct` numeric (generated)
- `submitted_at`, `created_at`
- Unique `(batch_session_id, instructor_id)`.

**`choreography_uploads`** — many per report.
- `report_id`, `batch_id`, `studio_id`, `instructor_id`, `style`, `taught_on` date
- `kind` enum-like text: `choreography` (required) | `practice` | `photo`
- `storage_path`, `mime_type`, `duration_sec` nullable, `thumbnail_path` nullable

**`instructor_compliance_daily`** (optional materialized; can be a SQL view first) — instructor × date rollup for fast leaderboard/analytics.

**Storage:** new public-read, auth-write bucket `class-media` (videos can be large — keep separate from `photos`). Path: `class-media/{org}/{instructor_id}/{yyyy-mm-dd}/{report_id}/{uuid}.{ext}`.

**Notifications:** reuse existing `notification_log`. New cron edge function writes reminder rows + sends WhatsApp via existing Interakt path.

---

## 2. Routes & files

```
/instructor                      → InstructorHome (today's classes + pending banner)
/instructor/report/:sessionId    → ReportForm (mobile-first)
/instructor/reports              → my submitted reports
/evaluations                     → Manager leaderboard + filters (admin/manager only)
/evaluations/compliance          → Missing-compliance tracker
/evaluations/analytics           → Charts (recharts)
/choreography                    → Searchable library + inline video player
```

New files:
- `src/pages/instructor/Home.tsx`, `ReportForm.tsx`, `MyReports.tsx`
- `src/pages/evaluations/Leaderboard.tsx`, `Compliance.tsx`, `Analytics.tsx`
- `src/pages/ChoreographyLibrary.tsx`
- `src/components/evaluations/ChecklistToggles.tsx`, `StarRating.tsx`, `VideoUploader.tsx`, `ScoreBadge.tsx`, `ReportCard.tsx`
- `src/lib/evaluationScoring.ts` (pure helpers + perf level)
- Sidebar entry in `AppSidebar.tsx`; route on Instructor login lands on `/instructor`.

Edge functions:
- `submit-instructor-report` — validates, inserts report + upload rows, triggers manager notify.
- `class-report-reminders` — cron (every 15 min); compares `batch_sessions` (completed) vs `instructor_reports`, sends 30-min and EOD nudges.
- `evaluations-analytics` — server-side aggregations for charts/leaderboard (paginated `fetchAll` not needed since aggregated).

---

## 3. Scoring (`evaluationScoring.ts`)

- `score = sum(15 booleans) + attire + culture` (0–25).
- `compliance_pct = score / 25 * 100`.
- Level: ≥90 Excellent, ≥80 Good, ≥70 Needs Improvement, else Action Required.
- Aggregations: daily = avg of day's reports; weekly/monthly = avg over period; per-instructor and per-studio.
- Missing-compliance items derived from booleans = false on submitted reports + missing reports for completed sessions.

---

## 4. Instructor flow (mobile-first)

1. `/instructor` shows: today's batches (from `batch_sessions` where instructor matches), each with **Submit Report** or **✓ Submitted**. Banner if pending count > 0.
2. Tap a session → `ReportForm`:
   - Prefilled class info (date, studio, batch, style, instructor) read-only.
   - Students present (number), notes.
   - **Choreography video** uploader (required, mp4/mov, max ~200 MB, direct to Supabase Storage with progress).
   - Optional practice video + photos (multi).
   - 15 toggle switches grouped (Teaching & Conduct / Operations / Class Management).
   - 2 star ratings (attire, culture) — `StarRating` component.
   - Live score preview at bottom; submit disabled until choreography video uploaded.
3. On submit → edge function inserts everything, returns score; show success screen.

Layout: single column, large tap targets, sticky submit bar; works at 360px width.

---

## 5. Manager dashboards

**Leaderboard** (`/evaluations`):
Table with Instructor · Studio · Monthly Score · Compliance % · Pending Reports. Filters: date range, studio, instructor, style. Sort by score/compliance.

**Missing Compliance Tracker** (`/evaluations/compliance`):
List rows per instructor with counts: Choreography Missing, Attendance Missing, Story Missing, Absentee Calls Missing, Registration FU Missing, Renewal FU Missing. Filter by instructor / date range.

**Analytics** (`/evaluations/analytics`) — recharts:
- Instructor performance trend (line, monthly avg)
- Monthly compliance trend (line)
- Culture ratings (bar by instructor)
- Attire ratings (bar)
- Punctuality % (bar)
- Attendance compliance (bar)
- Choreography upload compliance (bar)

**Choreography Library** (`/choreography`):
Grid of video cards (thumbnail, batch_code, style, instructor, date). Filters: studio, instructor, style, batch, date range. Click → modal with `<video>` player streaming from storage.

---

## 6. Notifications

- `class-report-reminders` cron (pg_cron → http_post, see schedule_jobs pattern):
  - 30 min after `batch_sessions.end_time` if no report → WhatsApp + `notification_log` row.
  - 20:00 IST daily → digest of pending reports to each instructor.
- Manager notify on submit and when daily compliance < 70%.
- All sends gated by existing "test mode" toggle.

---

## 7. Out of scope (explicit)

- No edits to existing enrollments/payments logic.
- No re-architecting roles; we use existing `instructor` role.
- No native mobile app — responsive web only.
- No AI scoring of videos; checklist + ratings only.
- Push notifications stay WhatsApp (existing Interakt) — no FCM/APNs.

---

## 8. Build order

1. Migration: tables + storage bucket + RLS/GRANTs.
2. Scoring lib + shared UI components.
3. Instructor flow (Home → ReportForm → submit edge fn).
4. Choreography Library.
5. Manager Leaderboard + Compliance + Analytics.
6. Reminder cron + manager notifications.
7. Sidebar/role-based routing wiring + mobile QA pass.
