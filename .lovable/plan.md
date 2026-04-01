

# Register Page UX Redesign — Style-First Experience

## Overview
Complete redesign of `/register` into a premium, conversion-focused multi-step experience with three main sections: Join a Batch (style-first funnel), Drop-In (casual trial flow), and My Account (personal dashboard).

## Architecture

The current `Register.tsx` (609 lines) contains all three flows inline. The redesign will extract each into dedicated components and add new sub-step components for the style-first funnel.

```text
Register.tsx (shell + tabs)
├── JoinBatchFlow.tsx (new)
│   ├── StyleSelection.tsx (Step 1 — 6 visual cards)
│   ├── StudioSelection.tsx (Step 2 — studios for chosen style)
│   ├── BatchSelection.tsx (Step 3 — filtered batches with spots left)
│   ├── PhoneEntry.tsx (Step 4 — existing, reused)
│   └── PaymentStep.tsx (Step 5 — plan + fee breakdown + pay)
├── DropInFlow.tsx (new)
│   ├── StudioSelection.tsx (reused)
│   ├── SessionList.tsx (sessions grouped by date)
│   ├── PhoneEntry.tsx (reused)
│   └── DropInConfirm.tsx
└── AccountFlow.tsx (new)
    ├── PhoneEntry.tsx (reused)
    └── StudentDashboard.tsx (enhanced)
```

## Detailed Changes

### 1. `src/pages/Register.tsx` — Slim shell
- Keep header, tabs (Join / Drop-In / My Account)
- Each tab renders its extracted flow component
- ~60 lines total

### 2. `src/components/register/StyleSelection.tsx` — NEW
- 6 large visual cards in a 2-col (mobile) / 3-col (desktop) grid
- Styles: Jazz, Ballet, Modern, Hip Hop, Heels, Kids Division
- Each card: gradient/image background, style name, 1-line description, hover zoom animation
- "Kids Division" filters batches where level starts with "Kids"
- On click → passes `styleBase` (or "Kids") to next step

### 3. `src/components/register/StudioSelection.tsx` — NEW
- Fetches studios that have batches matching the selected style
- Studio card: name, location, code, "View Batches" CTA
- Filters studios by checking which studios have batches with matching `style_base` (or `level LIKE 'Kids%'` for Kids Division)

### 4. `src/components/register/BatchSelection.tsx` — NEW
- Shows batches filtered by selected style + studio
- Each card: style badge, level badge, schedule (days + times), capacity, spots left (from batch_sessions count), instructor name (from users table via instructor_id)
- Multi-select with highlight ring (similar to current BatchBrowser)
- "Continue" button when ≥1 batch selected

### 5. `src/components/register/JoinBatchFlow.tsx` — NEW
- Manages step state: `style → studio → batch → phone → details → pay → waiting`
- Step indicator updated: Style → Studio → Batch → Verify → Pay (5 steps)
- Moves all enrollment/payment logic from current `JoinBatchFlow` function
- Keeps cash flow with staff selector + Razorpay flow

### 6. `src/components/register/DropInFlow.tsx` — NEW
- Flow: `studio → sessions → phone → details → confirm`
- Step 1: Studio selection (reuse StudioSelection, no style filter)
- Step 2: Session list filtered by studio — show style, level, date, time in a casual card format
- Banner: "Not ready to commit? Try a drop-in class"
- Moves logic from current `DropInFlow` function

### 7. `src/components/register/AccountFlow.tsx` — NEW
- Phone entry → StudentDashboard (enhanced)
- If user has multiple students under same phone, show student selector cards
- Enhanced StudentDashboard header: "Welcome back, {name}" with greeting
- Show drop-in credits summary if any exist
- Per-student: active batches with style/level/studio/valid-till/status
- Actions: Renew, Add Batch, Add New Student

### 8. `src/components/register/FeeBreakdown.tsx` — Minor update
- Already works, just ensure it renders correctly in the new PaymentStep context

### 9. Design tokens (already in index.css)
- Background: `--background: 0 0% 4%` (near-black) — keep
- Accent: `--primary: 330 100% 50%` (#ff007f) — keep
- Font: Space Grotesk — keep
- Add hover zoom utility class for style cards

## Data Flow
- StyleSelection queries `batches` table for distinct `style_base` values (+ checks for Kids levels)
- StudioSelection queries `batches` filtered by style, joins to `studios`
- BatchSelection queries `batches` filtered by style + studio_id, with enrollment counts for "spots left"
- All existing enrollment/payment logic preserved exactly — just moved into component files

## No Database Changes
All data already exists in the schema. No migrations needed.

## Files Changed
- `src/pages/Register.tsx` — rewrite as thin shell
- `src/components/register/StyleSelection.tsx` — new
- `src/components/register/StudioSelection.tsx` — new
- `src/components/register/BatchSelection.tsx` — new
- `src/components/register/JoinBatchFlow.tsx` — new (logic from Register.tsx)
- `src/components/register/DropInFlow.tsx` — new (logic from Register.tsx)
- `src/components/register/AccountFlow.tsx` — new (logic from Register.tsx)
- `src/index.css` — add card hover animation utility

