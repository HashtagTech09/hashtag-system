

# Plan Cycles + Subscription Plans System

## Overview
Build a complete academic calendar cycle system with subscription plans that span multiple cycles. This includes three new database tables, seed data, a new "Plan Cycles" admin page, subscription plan management in Settings, enrollment integration, and a calendar visualization.

---

## 1. Database Migration

### Table: `plan_cycles`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (identity) | PK |
| organization_id | bigint | FK to organizations |
| name | text | e.g. "January'26" |
| start_date | date | NOT NULL |
| end_date | date | nullable (last cycle open-ended) |
| plan_type | text | 'regular' or 'grid' |
| duration_days | integer | auto-computed on insert via trigger |
| is_active | boolean | default false |
| created_at | timestamptz | default now() |

Validation trigger: no overlapping cycles within same org. Active cycle constraint via trigger (only one active at a time).

### Table: `subscription_plans`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (identity) | PK |
| organization_id | bigint | FK |
| name | text | e.g. "3 Regular Months" |
| description | text | nullable |
| total_cycles | integer | total count |
| total_regular_cycles | integer | |
| total_grid_cycles | integer | |
| is_active | boolean | default true |
| created_at | timestamptz | |

### Table: `subscription_plan_cycles`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (identity) | PK |
| subscription_plan_id | bigint | FK |
| sequence_order | integer | 1-based |
| plan_type | text | 'regular' or 'grid' |

### Alter `enrollments` table
Add three nullable columns:
- `subscription_plan_id` (bigint, FK to subscription_plans)
- `start_cycle_id` (bigint, FK to plan_cycles)
- `end_cycle_id` (bigint, FK to plan_cycles)

### RLS
All tables: authenticated full CRUD (matching existing pattern).

---

## 2. Seed Data (via insert tool)

Insert the 12 plan cycles as specified (January'26 through January'27). Mark the cycle containing today's date as `is_active = true`.

Insert the 4 subscription plans with their cycle sequences.

---

## 3. New Page: Plan Cycles (`src/pages/PlanCycles.tsx`)

### Cycle Management Tab
- Table listing all cycles: Name, Type (badge: blue for regular, purple for grid), Start, End, Duration, Active status
- Add/Edit dialog: name, start_date, end_date, plan_type selector
- Duration auto-calculated and displayed
- Toggle active status
- Validation: no overlaps, continuity check

### Subscription Plans Tab
- List subscription plans with name, cycle breakdown (e.g. "5 Regular + 1 Grid"), active status
- Add/Edit dialog: name, description, then a dynamic sequence builder where admin adds rows specifying plan_type per sequence position
- Totals auto-computed from sequence

### Calendar Visualization Tab
- Full-year calendar view using `react-day-picker`
- Background color bands showing cycles: light blue for regular, purple for grid
- Batch sessions overlaid as dots/markers on their dates
- Click a date → show which cycle it belongs to + any sessions
- Click a cycle band → show cycle details

---

## 4. Enrollment Integration (`src/pages/Enrollments.tsx`)

### Updated Enrollment Flow
- Add optional "Subscription Plan" selector in the enrollment dialog
- When a subscription plan is selected:
  1. Find the current active cycle (or cycle matching today's date)
  2. Read the plan's sequence from `subscription_plan_cycles`
  3. Walk forward through `plan_cycles` in calendar order, matching each sequence entry's `plan_type`
  4. Set `start_cycle_id` = first matched cycle, `end_cycle_id` = last matched cycle
  5. Auto-set `start_date` = start_cycle.start_date, `end_date` = end_cycle.end_date
- Display the computed validity period before confirming

### Enrollments Table Display
- Add "Plan" column showing subscription plan name (if any)
- Add "Cycles" column showing start→end cycle names

---

## 5. Navigation

Add "Plan Cycles" to the sidebar under Management (between Batches and Enrollments), with a Calendar icon.

Add route `/plan-cycles` in `App.tsx`.

---

## 6. Technical Details

- `duration_days` computed client-side on save: `differenceInDays(end_date, start_date)`
- Cycle matching logic for subscriptions: query all org cycles ordered by `start_date`, starting from the current/active cycle, iterate through sequence entries matching `plan_type`
- No skipping: if sequence says "regular" but next calendar cycle is "grid", that grid cycle is skipped and the next regular is used — maintaining strict type matching while following calendar order

---

## Summary of Deliverables
1. **Migration**: 3 new tables + 3 new columns on enrollments + RLS
2. **Seed data**: 12 plan cycles + 4 subscription plans with sequences
3. **Plan Cycles page**: Cycle CRUD, subscription plan CRUD, calendar visualization
4. **Enrollment updates**: Subscription plan selection with auto cycle assignment
5. **Navigation**: New sidebar item + route

