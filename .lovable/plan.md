

# Add Test Messaging Panel to Settings

## What
Add a "Test Messaging" section to the Settings page where admins can send a custom WhatsApp message or email to a specific recipient for testing purposes.

## UI
A new card on the Settings page with:
- **Channel selector**: Toggle between "WhatsApp" and "Email"
- **Recipient**: Phone number input (for WhatsApp) or email address input (for Email)
- **Message**: Text area for custom message content
- **Send Test** button

Results shown via toast (success/failure).

## Implementation

### `src/pages/Settings.tsx`
Add a "Test Messaging" card below existing settings with:
- State for channel, recipient, message
- On send: calls `supabase.functions.invoke("send-test-message", { body: { channel, recipient, message } })`

### `supabase/functions/send-test-message/index.ts` — NEW
- Accepts `{ channel, recipient, message }`
- **WhatsApp**: Sends via Interakt API using a simple text message (not template-based)
- **Email**: Sends via Resend API with the message wrapped in a simple HTML layout
- Logs to `notification_log` table
- Respects test_mode — if enabled, logs only without sending

## Files Changed
- `src/pages/Settings.tsx` — add Test Messaging card
- `supabase/functions/send-test-message/index.ts` — new edge function

