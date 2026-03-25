

# Fix User Deletion

## Problem
The `handleDelete` function in `Staff.tsx` silently fails because:
1. It doesn't check the error response from the delete call
2. Related records in `user_roles` (and potentially `students`) reference the user — even without declared foreign keys, the database may have implicit constraints or the delete may silently fail

## Fix

### `src/pages/Staff.tsx` — Update `handleDelete`
1. Delete related `user_roles` records first (where `user_id = id`)
2. Then delete the user
3. Check for errors on both calls and show appropriate toast messages

```typescript
const handleDelete = async (id: number) => {
  const { error: rolesError } = await supabase
    .from("user_roles").delete().eq("user_id", id);
  if (rolesError) { toast.error("Failed to delete user roles"); return; }

  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) { toast.error(error.message); return; }

  toast.success("User deleted");
  fetchData();
};
```

This ensures related `user_roles` are cleaned up before the user record is removed, and any errors are surfaced to the admin.

