

# Fix Registration Fee for NEW Students

## Problems

1. **Reg fee not showing**: In `Register.tsx` line 111, `detectedStatus = student ? "REN" : "NEW"`. Once a new student creates their account in the "details" step, the `student` object gets set, so the status flips to "REN" — hiding the ₹500 fee. The fix is to use `detectStudentStatus()` with the student's actual enrollment history (which will be empty for new students → "NEW").

2. **₹500 should be after GST**: Currently `REG_FEE = 500` is added to the pre-GST subtotal, then 18% GST is applied on top (making it ~₹590). The user wants ₹500 to be the final after-GST amount, so the base fee should be `Math.round(500 / 1.18)` ≈ ₹424.

## Changes

### `src/lib/enrollmentUtils.ts`
- Change `REG_FEE` to `424` (so that 424 + 18% GST ≈ ₹500)
- Add a comment: `// Base registration fee (₹500 after 18% GST)`

### `src/pages/Register.tsx`
- **JoinBatchFlow**: Replace `const detectedStatus = student ? "REN" : "NEW"` with proper enrollment-based detection:
  - If `student` exists, query their enrollments and use `detectStudentStatus()`
  - If no student, status = "NEW"
  - Store this in state so it persists correctly through the flow

- **DropInFlow**: Apply the same fix if applicable

### `src/components/register/FeeBreakdown.tsx`
- Update the registration fee display label to show "₹500 incl. GST" for clarity, since the line item will show ₹424 (pre-GST) but the user expects to see ₹500

## Files changed
- `src/lib/enrollmentUtils.ts` — adjust REG_FEE constant
- `src/pages/Register.tsx` — fix detectedStatus logic for new students
- `src/components/register/FeeBreakdown.tsx` — update label

