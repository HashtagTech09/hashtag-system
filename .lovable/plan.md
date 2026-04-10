

# Add Hashtag Logo + Rebrand to "Hashtag"

## Overview
Copy the uploaded logo files into the project, use `Pink.png` as favicon, and replace the `#` text / Music icon with the actual logo image across all branding touchpoints. Rename "Hashtag Dance" / "Dance Studio" to just "Hashtag" (or "Hashtag For Dance" where a longer form is needed).

## Assets
- Copy `user-uploads://hashtaglogo.png` → `public/images/hashtag-logo.png` (main logo, white bg — for dark UI use)
- Copy `user-uploads://Pink.png` → `public/favicon.png` and `src/assets/hashtag-pink.png` (pink logo — favicon + small inline use)

## Changes

### `index.html`
- Delete `public/favicon.ico` if exists
- Add `<link rel="icon" href="/favicon.png" type="image/png">`
- Title: "Hashtag | Management System"
- Meta descriptions: "Hashtag For Dance" instead of "Hashtag Dance Company/Studio"

### `src/pages/Login.tsx`
- Replace `<span className="text-gradient">#</span> Dance Studio` with `<img>` of pink logo (small, ~32px) + "Hashtag"
- Subtitle: "Staff Portal" stays

### `src/components/AppSidebar.tsx`
- Replace text `# Dance Studio` (line 78) with pink logo img (~24px) + "Hashtag"
- Collapsed state (line 81): show just the small pink logo instead of `#` text

### `src/pages/Register.tsx`
- Replace Music icon + "Hashtag Dance" with pink logo img (~32px) + "Hashtag"
- Subtitle: "Student Registration Portal" stays

### `src/pages/ConfirmCash.tsx`
- Same as Register — replace Music icon with pink logo + rename to "Hashtag"

### `src/lib/razorpayUtils.ts`
- Change `name: "Hashtag Dance"` → `name: "Hashtag"`

### Edge functions (email templates)
- `send-receipt/index.ts`: Change `<h1>Hashtag Dance</h1>` → `<h1>Hashtag</h1>`, `from:` field to `"Hashtag <receipts@hashtagdance.in>"`
- `send-cash-confirmation/index.ts`: Same rename in HTML and `from:` field
- `send-test-message/index.ts`: Same rename throughout

### `src/components/AdminLayout.tsx`
- No logo needed here (just shows page title), no changes

## Files changed
- `index.html` — favicon + title/meta rebrand
- `src/pages/Login.tsx` — logo + rename
- `src/components/AppSidebar.tsx` — logo + rename
- `src/pages/Register.tsx` — logo + rename
- `src/pages/ConfirmCash.tsx` — logo + rename
- `src/lib/razorpayUtils.ts` — rename
- `supabase/functions/send-receipt/index.ts` — rename
- `supabase/functions/send-cash-confirmation/index.ts` — rename
- `supabase/functions/send-test-message/index.ts` — rename

