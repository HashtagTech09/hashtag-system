

# IST Timezone Fix + Data Reset

## Problem
All `new Date().toISOString().split("T")[0]` calls return UTC date, which can be wrong for IST (UTC+5:30) — e.g., at 1 AM IST, it returns yesterday's date.

## Part 1: IST Helper

### New file: `src/lib/dateUtils.ts`
Create a utility that returns today's date in IST:
```typescript
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  // returns "yyyy-MM-dd" format
}

export function nowIST(): Date {
  // Returns a Date object adjusted to IST for display purposes
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcOffset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() + utcOffset + istOffset);
}
```

### Files to update (replace `new Date().toISOString().split("T")[0]` with `todayIST()`):
1. **`src/pages/Enrollments.tsx`** — 6 occurrences for today comparisons
2. **`src/pages/Dashboard.tsx`** — 1 occurrence for attendance date
3. **`src/pages/Attendance.tsx`** — 1 occurrence for date state
4. **`src/pages/DropIns.tsx`** — 1 occurrence for session filtering
5. **`src/pages/PlanCycles.tsx`** — 1 occurrence for registration deadline check
6. **`src/components/BatchSessionsDialog.tsx`** — 1 occurrence for marking completed sessions
7. **`supabase/functions/mark-completed-sessions/index.ts`** — use IST-aware date

## Part 2: Data Reset (via insert tool)

Delete data in dependency order:
1. `DELETE FROM attendance`
2. `DELETE FROM drop_ins`
3. `DELETE FROM enrollments`
4. `DELETE FROM payments`
5. `DELETE FROM batch_sessions`
6. `DELETE FROM batches`
7. `DELETE FROM students`
8. `DELETE FROM user_roles`
9. `DELETE FROM users`
10. `DELETE FROM plan_cycles`
11. `DELETE FROM subscription_plan_cycles`
12. `DELETE FROM subscription_plans`
13. `DELETE FROM pricing_plans`
14. `DELETE FROM system_settings`
15. `DELETE FROM studios`

This clears all operational data so the user can start fresh.

