

# Fix User Deletion — Handle Students Dependency

## Problem
Deleting a user fails because the `students` table has records referencing `user_id` (not-null constraint). The current code only cleans up `user_roles` but not `students`.

## Fix

### `src/pages/Staff.tsx` — Update `handleDelete`
Add a step to delete related `students` records before deleting `user_roles` and the user:

```typescript
const handleDelete = async (id: number) => {
  // 1. Delete related students
  const { error: studentsError } = await supabase
    .from("students").delete().eq("user_id", id);
  if (studentsError) { toast.error("Failed to delete linked students"); return; }

  // 2. Delete related user_roles
  const { error: rolesError } = await supabase
    .from("user_roles").delete().eq("user_id", id);
  if (rolesError) { toast.error("Failed to delete user roles"); return; }

  // 3. Delete the user
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) { toast.error(error.message); return; }

  toast.success("User deleted");
  fetchData();
};
```

This is a single-file change — no migrations needed.

