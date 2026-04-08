

# Expose Registration API for External Lovable Website

## Summary
Your existing backend (edge functions + database tables) already has CORS set to `*`, meaning any external website can call them directly. The other Lovable site just needs to hit your Supabase endpoints with the anon key — no new edge functions needed for most operations.

## What already works cross-origin

The external site can directly query your database tables (batches, studios, plan_cycles, subscription_plans, students, users, enrollments) and invoke your edge functions — all have `anon` RLS policies allowing SELECT/INSERT.

**Direct table reads (no auth needed):**
- `batches` — anon SELECT allowed
- `studios` — anon SELECT allowed
- `plan_cycles` — anon SELECT allowed
- `subscription_plans` — anon SELECT allowed
- `batch_sessions` — anon SELECT allowed

**Edge functions (CORS: *):**
- `send-whatsapp-otp` — sends OTP
- `verify-whatsapp-otp` — verifies OTP
- `create-razorpay-order` — payment initiation
- `send-cash-confirmation` — cash flow

**Direct table writes (anon INSERT allowed):**
- `students`, `users`, `enrollments`, `enrollment_cycles`, `payments`, `cash_payment_requests`, `pending_enrollments`

## What the external site needs

### 1. Initialize Supabase client pointing to THIS project
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://plrpurjponddhelgtebw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // anon key
);
```

### 2. Fetch batches (same queries your components use)
```typescript
// Get studios
const { data: studios } = await supabase.from('studios').select('*').eq('organization_id', 1);

// Get batches by studio + style
const { data: batches } = await supabase.from('batches').select('*')
  .eq('organization_id', 1).eq('studio_id', studioId).eq('style_base', 'Jazz');

// Get plan cycles & subscription plans
const { data: cycles } = await supabase.from('plan_cycles').select('*').eq('organization_id', 1);
const { data: plans } = await supabase.from('subscription_plans').select('*').eq('organization_id', 1).eq('is_active', true);
```

### 3. OTP verification
```typescript
// Send OTP
const { data } = await supabase.functions.invoke('send-whatsapp-otp', { body: { phone: '9876543210' } });

// Verify OTP
const { data } = await supabase.functions.invoke('verify-whatsapp-otp', { body: { phone: '9876543210', otp: '123456' } });
```

### 4. Create student & enroll (same insert logic from JoinBatchFlow)

## Implementation: Create a single "registration-api" edge function

Rather than having the external site make 5+ separate calls, create **one orchestrator edge function** that bundles the registration logic (the same logic in `JoinBatchFlow.handleEnroll`) server-side:

**New edge function: `supabase/functions/registration-api/index.ts`**

Endpoints (via request body `action` field):
- `get-catalog` — returns studios, batches, plan_cycles, subscription_plans in one call
- `send-otp` — proxies to send-whatsapp-otp
- `verify-otp` — proxies to verify-whatsapp-otp, returns student if found
- `create-student` — creates user + student records
- `enroll` — runs the full enrollment + payment logic server-side

This gives the external site a clean, single-endpoint API instead of requiring them to replicate all the client-side logic from `JoinBatchFlow`, `enrollmentUtils`, and `styleHierarchy`.

## Shared logic to move

The fee calculation logic currently in `src/lib/enrollmentUtils.ts` and `src/lib/styleHierarchy.ts` would need to be duplicated into the edge function (since edge functions can't import from `src/`). This ensures the external site doesn't need to implement fee breakdowns — the API returns computed fees.

## Files changed
- **New:** `supabase/functions/registration-api/index.ts` — single orchestrator edge function with 5 actions
- No changes to existing files

## Alternative: No code changes needed
If the other Lovable site is comfortable using the Supabase JS client directly and replicating the enrollment logic from your `enrollmentUtils.ts` / `styleHierarchy.ts`, then **zero changes are needed here** — everything is already accessible via anon policies and CORS `*`. You'd just share the Supabase URL + anon key with the other project.

