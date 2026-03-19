

# Refactor: Multi-Role System

## Overview
Replace the single `role` column on `users` with a proper many-to-many role system using two new tables (`roles` and `user_roles`), then update all frontend code that reads/writes roles.

## Database Migration

### 1. Create `roles` table
```sql
CREATE TABLE public.roles (
  id bigint generated always as identity primary key,
  name text NOT NULL UNIQUE,
  type text NOT NULL -- 'organization' or 'student_side'
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
-- Authenticated read policy
```

### 2. Create `user_roles` table
```sql
CREATE TABLE public.user_roles (
  id bigint generated always as identity primary key,
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id bigint NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  organization_id bigint NOT NULL REFERENCES public.organizations(id),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, organization_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- Authenticated CRUD policies
```

### 3. Seed roles
Insert 6 roles:
- `admin` (organization), `manager` (organization), `instructor` (organization), `frontdesk` (organization)
- `parent` (student_side), `member` (student_side)

### 4. Migrate existing data
```sql
INSERT INTO user_roles (user_id, role_id, organization_id, is_primary)
SELECT u.id, r.id, u.organization_id, true
FROM users u JOIN roles r ON r.name = u.role;
```

### 5. Drop `role` column from `users`
```sql
ALTER TABLE public.users DROP COLUMN role;
```

## Frontend Changes

### Staff Page (`src/pages/Staff.tsx`)
- **Query**: Change to `select("*, user_roles(*, roles(name, type))")` to get all roles per user
- **Form**: Replace single role `<Select>` with a multi-select checkbox list of roles, with one marked as primary
- **Display**: Show multiple badges per user (one per role), primary role shown first
- **Save logic**: On create/update, insert into `user_roles` after saving the user record. On edit, delete old `user_roles` and re-insert

### Batches Page (`src/pages/Batches.tsx`)
- **Instructor filter**: Change `.eq("role", "instructor")` to query via `user_roles` join — fetch users who have the "instructor" role:
  ```
  supabase.from("users").select("*, user_roles!inner(roles!inner(name))").eq("user_roles.roles.name", "instructor")
  ```

### Utility: Role helpers (`src/lib/roleUtils.ts`)
- `getUserRoles(userId)` — fetch all roles for a user
- `getPrimaryRole(userRoles)` — return the role marked `is_primary`
- `hasRole(userRoles, roleName)` — check if user has a specific role
- `isOrgRole(role)` / `isStudentSideRole(role)` — check role type

### Login flow (future-ready)
- After login, fetch user's roles via `user_roles`
- If user has org roles → show admin dashboard
- If user has only student_side roles → show student/parent portal (when built)
- For now, all users see admin dashboard since portal isn't built yet

## Technical Details

- RLS on `roles`: SELECT for authenticated
- RLS on `user_roles`: full CRUD for authenticated (consistent with current permissive policies)
- The `is_primary` flag determines which role badge shows first and which dashboard loads on login

