

# Fix User Deletion — Handle Batches Instructor FK

## Problem
Deleting a user fails when they are assigned as an instructor on batches. The `batches.instructor_id` has a foreign key to `users.id`.

## Fix

### `src/pages/Staff.tsx` — Update `handleDelete`
Before deleting students and user_roles, set `instructor_id = null` on any batches where this user is the instructor:

```typescript
const handleDelete = async (id: number) => {
  // 1. Unlink from batches
  await supabase.from("batches").update({ instructor_id: null }).eq("instructor_id", id);

  // 2. Delete related students
  const { error: studentsError } = await supabase
    .from("students").delete().eq("user_id", id);
  if (studentsError) { toast.error("Failed to delete linked students"); return; }

  // 3. Delete related user_roles
  const { error: rolesError } = await supabase
    .from("user_roles").delete().eq("user_id", id);
  if (rolesError) { toast.error("Failed to delete user roles"); return; }

  // 4. Delete the user
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) { toast.error(error.message); return; }

  toast.success("User deleted");
  fetchData();
};
```

Single-file change to `src/pages/Staff.tsx`.

