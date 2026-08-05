alter table public.cash_payment_requests
  add column if not exists expires_at timestamptz,
  add column if not exists recipient_user_ids jsonb not null default '[]'::jsonb;

update public.cash_payment_requests
set expires_at = coalesce(expires_at, created_at + interval '10 minutes')
where expires_at is null;
