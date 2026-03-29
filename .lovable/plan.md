

# Fix Enrollment Plan Selection and Fee Display

## Problem
1. When the enrollment dialog opens, the form state is never reset — stale `subscription_plan_id`, `batch_ids`, `student_id` persist from prior interactions.
2. The auto-select `useEffect` at line 177 has an incomplete dependency array (`[dialogOpen, validPlans.length]`), causing `computeCycleAssignment` to run with stale closures over `subPlans`, `subPlanCycles`, and `planCycles`.
3. When reopening the dialog with a previously selected plan, the condition `!form.subscription_plan_id` is false, so auto-select never fires.

## Fix — `src/pages/Enrollments.tsx`

### 1. Reset form on dialog open
Change `onOpenChange={setDialogOpen}` (line 464) to reset the form when opening:
```ts
onOpenChange={(open) => {
  setDialogOpen(open);
  if (open) {
    setForm({
      student_id: "", batch_ids: [], payment_mode: "cash",
      subscription_plan_id: "", computed_start: "", computed_end: "",
      start_cycle_name: "", end_cycle_name: "",
      start_cycle_id: null, end_cycle_id: null,
      regular_cycles: 1, grid_cycles: 0,
    });
    setEligibleDropIn(null);
    setDetectedStatus("NEW");
    setLatestEndDate(null);
    setPreviousBatchIds([]);
  }
}}
```

### 2. Fix auto-select useEffect dependencies
Update the effect (line 176-181) to depend on the actual data arrays, not just `.length`, and reference `validPlans` correctly:
```ts
useEffect(() => {
  if (dialogOpen && validPlans.length > 0 && (!form.subscription_plan_id || form.subscription_plan_id === "none")) {
    computeCycleAssignment(String(validPlans[0].id));
  }
}, [dialogOpen, validPlans, form.subscription_plan_id, subPlans, subPlanCycles, planCycles]);
```

This ensures the effect re-runs when data finishes loading and correctly picks the first valid plan with up-to-date closure values.

## No database changes needed.

