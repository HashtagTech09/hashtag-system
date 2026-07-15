# Hashtag System — Capabilities Report + PDF

## Goal
Produce a comprehensive, structured write-up of everything the Hashtag studio management system currently does, and deliver it as a downloadable PDF (plus render the same content in chat).

## Deliverable
- `/mnt/documents/hashtag-system-capabilities.pdf` — branded PDF (hot pink #ff007f + black, Space Grotesk-style headings via a Unicode TTF) attached via `<presentation-artifact>`.
- Same content summarized in the chat reply.

## Report structure
1. **Overview** — what the platform is, who uses it, tech stack (React + Vite + TS + Tailwind + shadcn, Lovable Cloud backend, edge functions, Razorpay, Interakt WhatsApp, Resend email).
2. **User roles & portals** — admin, manager, front desk, instructor, parent/member, student; role-based routing and scoped data access.
3. **Student registration funnel** — phone + WhatsApp OTP, account/student creation, studio → style → level → batch selection, kids division auto-level rule, cart persistence / abandoned cart recovery.
4. **Plans, cycles & pricing** — plan cycles (regular/grid), subscription plans, greedy cycle assignment, fixed-price plans (5R1G / 10R2G), multi-batch discount hierarchy, GST, registration fee logic, NEW/REN/REV status detection with grace days.
5. **Payments** — Razorpay checkout + webhook finalization, cash flow with staff email magic-link confirmation, payment allocations per batch/studio, receipts via Resend.
6. **Enrollments** — creation only on successful payment, cycle-based ownership (start/end cycle), renewal attribution (previous_batch_id), drop-ins with credits matched by Style+Level.
7. **Operations** — batches, studios, sessions (auto-completion cron + frontend check), attendance, instructor reports & evaluations (star ratings, checklists, video uploads), choreography uploads, application cases.
8. **Analytics dashboard** — Total Dreams, Head Count, carry-forward logic, batch details popup.
9. **Admin utilities** — staff management, plan cycles, studios, system settings, data import/migration with fuzzy cycle matching, test mode for outbound messages.
10. **Integrations** — Razorpay (dual-account routing, pending_enrollments), Interakt WhatsApp (login_otp template + receipts), Resend (branded emails), Lovable Cloud (Supabase auth/DB/storage/edge functions).
11. **Architecture notes** — multi-tenant via organization_id, IST standardization, paginated fetchAll for >1000 rows, split-query student lookup, RLS + user_roles with has_role security-definer.
12. **Known limitations** — hardcoded org_id=1 and prices in edge functions, cash flow blocked on staff email, business logic split between FE and edge functions, single-tenant assumptions.

## PDF technical approach
- Python `reportlab` Platypus flow (SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table for the roles/limitations grids).
- Register DejaVu Sans TTF via fontconfig for reliable rendering; H1 in hot pink #ff007f, body black on white, subtle divider rules.
- No unicode bullets — use ReportLab list bullets or `•` inside Paragraph markup with proper font.
- QA: `pdftoppm -jpeg -r 150` every page and inspect each image; fix any overflow/clipping and re-render before delivering.

## Scope
Report only — no code changes to the app.