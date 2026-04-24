

## Continue branded auth email setup

DNS records are in at the registrar — now scaffold the branded templates and deploy the hook so password reset emails route through `notify.hashtag.dance` once DNS finishes propagating.

### Step 1 — Scaffold the 6 auth email templates

Generate the `auth-email-hook` edge function plus React Email templates for: `recovery`, `signup`, `magic-link`, `invite`, `email-change`, `reauthentication`.

### Step 2 — Apply Hashtag brand styling

Update each template to match the app's visual identity:

| Element | Value |
|---|---|
| Body background | `#ffffff` (always white for deliverability) |
| Heading / body text | Black on white |
| CTA button background | `#ff007f` (hot pink) |
| CTA button text | `#ffffff` |
| Button radius | from `--radius` in `src/index.css` |
| Font stack | `'Space Grotesk', -apple-system, Arial, sans-serif` |
| Header logo | `/favicon.png` uploaded to a new public `email-assets` bucket |
| Footer | `Sent by Hashtag · hashtag.dance` (muted) |
| Tone | Concise, brand voice (e.g. recovery: *"Reset your Hashtag password"* + single pink CTA) |

### Step 3 — Deploy

Deploy `auth-email-hook`. From this moment, every `supabase.auth.resetPasswordForEmail(...)` call (already wired in `Login.tsx`) renders through the branded template. Until DNS verifies, default Supabase emails continue shipping — zero downtime.

### Step 4 — Confirm

Open Cloud → Emails so you can monitor DNS verification status. Once green, password reset emails ship from `Hashtag <noreply@notify.hashtag.dance>` with the branded template.

### What does NOT change

- No edits to `Login.tsx`, `ResetPassword.tsx`, `useAuth.tsx`, or `create-staff-auth`
- No new secrets needed
- Resend (used for payment receipts) stays untouched on its own path

### Files added

- `supabase/functions/auth-email-hook/index.ts` + `deno.json`
- `supabase/functions/_shared/email-templates/{recovery,signup,magic-link,invite,email-change,reauthentication}.tsx`
- `supabase/config.toml` — auto-updated with the new function block
- New public `email-assets` storage bucket (for logo)

