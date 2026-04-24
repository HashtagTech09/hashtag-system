
## Clarifying user vs student in the registration portal

There is no separate "student login" anywhere in the system. There is **one OTP login per phone number = one User**. A User can manage multiple Students (e.g. a parent with two kids, or an adult who is also their own student). Today's portal blurs this because it picks `students[0]` automatically — that is the bug we are fixing.

### Mental model (the only one we want)

```text
   Phone + OTP
       |
       v
     User                 (parent / account owner)
    /  |  \
  S1  S2  S3              (students under this user)
```

- Login = identifying the **User**
- Every action (Join Batch, Drop-In, view enrollments) happens **for one Student at a time**
- The User can switch students, add a new student, or pay for any of them — without ever logging out

### Current flows (what's broken)

```text
JOIN BATCH (today)
Studio → Style → Level → Batch → Phone+OTP → [ silently picks students[0] ] → Pay
                                            \
                                             → if no student, ask name → create User+Student → Pay

DROP-IN (today)
Browse → Phone+OTP → [ silently picks students[0] ] → Confirm
                   \
                    → ask name → create User+Student → Confirm

MY ACCOUNT (today)
Phone+OTP → [ silently picks students[0] ] → StudentDashboard
          \
           → "no account" toast
```

Problem: a parent verifying their phone can only ever see/enroll the first student attached to their account. Sibling students are invisible. New students can never be added under an existing user.

### Target flows (after fix)

```text
JOIN BATCH (target)
Studio → Style → Level → Batch → Phone+OTP
                                    │
                                    ▼
                             ┌─ User Hub ─┐
                             │  S1   S2   │  ← pick OR "+ Add student"
                             │  + Add     │
                             └──────┬─────┘
                                    ▼
                                  Pay (for chosen student)

DROP-IN (target)
Browse → Phone+OTP → User Hub → pick/add student → Confirm

MY ACCOUNT (target)
Phone+OTP → User Hub
              │
              ├─ pick student → StudentDashboard (view, renew, add batch)
              │                    └─ header shows "Switch student" / "Add student"
              └─ "+ Add student" → name → create new Student under same User
```

If the user has exactly **one** student, the Hub auto-skips and goes straight to the next step (no friction for single-child accounts).

### What gets built

1. **Refactor `PhoneEntry`** — return `{ user, students[] }` instead of `{ student, user }`. After OTP, query `users` by phone first, then fetch all `students` where `user_id = user.id`. (Keeps the split-query strategy from `mem://logic/student-identification-strategy`.)
2. **New `UserHub` component** — shows the verified user's name + a list of their students as selectable cards, plus an "+ Add another student" tile that captures a name and inserts a new `students` row under the same `user_id`.
3. **New first-time signup path** — when phone is unknown, ask for **two** names: account owner name (User) and first student name (Student). Defaults the student name to the owner's name with a single click for adult solo registrants.
4. **Wire all three flows** to the new contract:
   - `JoinBatchFlow`: insert `userHub` step between `phone` and `pay`
   - `DropInFlow`: insert `userHub` step between `phone` and `confirm`
   - `AccountFlow`: replace direct dashboard mount with Hub → Dashboard
5. **`StudentDashboard` header** — add "Logged in as **{user.name}** · viewing **{student.name}**" with a "Switch student" button that returns to the Hub without re-OTP.
6. **Copy + visuals** — labels reinforce the model: phone screen says "Log in to your account", Hub says "Who is this for?", new-student tile uses a `+` icon. Dashboard banner becomes "Welcome back, {user.name} 👋" and student name appears as a sub-line.

### Files touched

- `src/components/register/PhoneEntry.tsx` (change callback contract)
- `src/components/register/UserHub.tsx` (**new**)
- `src/components/register/JoinBatchFlow.tsx` (insert hub step, update signup to capture user name)
- `src/components/register/DropInFlow.tsx` (insert hub step, same signup change)
- `src/components/register/AccountFlow.tsx` (route through hub)
- `src/components/register/StudentDashboard.tsx` (header + switch-student affordance)

### What does NOT change

- Database schema — the existing `users` (1) → `students` (many) relationship already supports this; no migration needed
- OTP / WhatsApp infrastructure
- Pricing, enrollment, payment, or cycle logic
- Staff / admin portal
