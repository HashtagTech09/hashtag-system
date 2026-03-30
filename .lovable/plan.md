

# Add Razorpay Webhook Secrets

## What's needed
You need to add **6 Razorpay secrets** to the project for the dual-account integration. None have been added yet.

## Secrets to add

| Secret Name | Where to find it |
|---|---|
| `RZP_PRIDE_KEY_ID` | Razorpay Dashboard → Pride account → Settings → API Keys → Key ID |
| `RZP_PRIDE_KEY_SECRET` | Razorpay Dashboard → Pride account → Settings → API Keys → Key Secret |
| `RZP_PRIDE_WEBHOOK_SECRET` | Razorpay Dashboard → Pride account → Settings → Webhooks → Secret |
| `RZP_PRUDENT_KEY_ID` | Razorpay Dashboard → Prudent account → Settings → API Keys → Key ID |
| `RZP_PRUDENT_KEY_SECRET` | Razorpay Dashboard → Prudent account → Settings → API Keys → Key Secret |
| `RZP_PRUDENT_WEBHOOK_SECRET` | Razorpay Dashboard → Prudent account → Settings → Webhooks → Secret |

## Implementation
Once you approve, I'll use the secret addition tool to prompt you for each value one at a time. You can paste each secret when prompted.

## Webhook URL
For the Razorpay webhook configuration in both dashboards, set the webhook URL to:
```
https://plrpurjponddhelgtebw.supabase.co/functions/v1/razorpay-webhook
```
Select the `payment.captured` event.

