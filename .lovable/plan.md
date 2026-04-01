

# Add Loading States & Error Handling to Batches Page

## Problem
1. No loading indicator when page data is fetching
2. `handleSave` doesn't check for errors from Supabase — shows "Batch added" even on failure
3. `handleDelete` same issue — no error check
4. `fetchData` has no error handling
5. No loading state on the Save button during submission

## Changes — `src/pages/Batches.tsx`

### 1. Add state variables
- `pageLoading` (boolean) — true during initial `fetchData`
- `saving` (boolean) — true during `handleSave`

### 2. `fetchData` — wrap in try/catch, set `pageLoading`, show error toast on failure

### 3. `handleSave` — check `{ error }` from insert/update
- Set `saving = true` before, `false` after
- If `error`, show `toast.error(error.message)` and return (don't close dialog)
- Only call `resetForm()` + `fetchData()` on success

### 4. `handleDelete` — check `{ error }` from delete, show error toast on failure

### 5. UI updates
- Show `Skeleton` or `Loader2` spinner while `pageLoading` is true
- Save button: show `Loader2` spinner + disable while `saving`
- Show empty state differently vs loading state in the table

