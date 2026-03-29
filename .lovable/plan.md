

# Fix IST Timezone in Enrollment Deadline Checks

## Change
Replace `new Date().toISOString().split("T")[0]` with `todayIST()` on lines 131 and 148, and add the import.

## Files — `src/pages/Enrollments.tsx`

1. **Add import** at the top: `import { todayIST } from "@/lib/dateUtils";`
2. **Line 131**: `const todayStr = new Date().toISOString().split("T")[0];` → `const todayStr = todayIST();`
3. **Line 148**: same replacement

No database changes needed.

