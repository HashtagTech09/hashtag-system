alter table public.payments
  add column if not exists business_date date;

create index if not exists idx_payments_business_date
  on public.payments (business_date);
