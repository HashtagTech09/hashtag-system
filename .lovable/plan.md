# Scoped Manager Access

Limit what a "manager" sees to data tied to studios they run or batches they instruct. Admins remain unrestricted.

## Scope rule

A scoped manager sees a student if **any** is true:
- Student has an enrollment in a batch at a studio where the manager is `dreamcatcher_id` or `wingperson_id` (`studios` table — already exists).
- Student has an enrollment in a batch where the manager is `instructor_id` or `instructor_2_id` (`batches` table — already exists).
- Student was created/linked manually by an admin to this manager (optional override list).

Admins always see everything. Instructors keep their current StaffDashboard. Scoped manager = manager role + at least one studio/batch link OR override entries.

## What changes in the UI

A new helper `useScopedStudentIds()` returns:
- `null` → unrestricted (admin, or manager with no scoping configured if we keep that toggle)
- `Set<number>` → only these student IDs are visible

Pages that filter by it: Students, Payments, Enrollments, Application Cases, Drop-ins, Attendance, Dashboard metrics. Each query adds `.in("student_id", [...ids])` (or `id` on the students page). Empty set → show empty state, no error.

For batches/sessions/studios pages: a scoped manager sees only their studios and the batches inside them (plus batches they instruct).

Action buttons (edit, delete, add payment) stay enabled within scope, disabled/hidden outside it.

## Assignment UI

On the Staff page, when editing a user with the `manager` role, add a section:
- **Studios managed** — multi-select of studios (writes `studios.dreamcatcher_id` / `wingperson_id`, same fields already used).
- **Extra students** (optional) — multi-select for one-off access (new tiny table `manager_student_access`).
- A toggle "Restrict to assigned scope" defaulting **on** for new managers, **off** for existing managers so nothing breaks.

The toggle lives on the `users` row as a new column `scope_restricted boolean default false`.

## Technical notes

New table:
```
manager_student_access (
  id bigserial pk,
  organization_id bigint not null default 1,
  manager_user_id bigint not null,   -- users.id
  student_id bigint not null,
  created_at timestamptz default now(),
  unique(manager_user_id, student_id)
)
```
RLS: authenticated all (same pattern as other tables; real enforcement is in the client query layer, consistent with the rest of the app).

New column: `users.scope_restricted boolean not null default false`.

New helper `src/hooks/useScopedStudents.tsx`:
1. If `isAdmin` or `!staffUser` → return `{ unrestricted: true }`.
2. If `isManager` and `staffUser.scope_restricted === false` → unrestricted.
3. Otherwise build the set:
   - `studios` where dreamcatcher/wingperson = staffUser.id → studio IDs
   - `batches` where studio_id ∈ studioIds OR instructor_id/instructor_2_id = staffUser.id → batch IDs
   - `enrollments` where batch_id ∈ batchIds → student IDs
   - Union with `manager_student_access.student_id` for this manager
   - Return `{ unrestricted: false, studentIds, batchIds, studioIds }`
4. Cache via react-query keyed on staffUser.id.

Pages add one line before the query:
```ts
const scope = useScopedStudents();
let q = supabase.from("payments").select(...).eq("organization_id", 1);
if (!scope.unrestricted) q = q.in("student_id", [...scope.studentIds]);
```

Instructor scope (the existing StaffDashboard) is untouched — this only affects `manager` role.

## Out of scope

- No server-side RLS rewrite (current policies are permissive; client-side filtering matches existing pattern).
- Frontdesk role behaviour unchanged.
- No bulk reassignment tools — admin sets studios/extra students per manager.
