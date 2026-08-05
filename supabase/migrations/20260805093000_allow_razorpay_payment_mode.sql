alter table public.payments drop constraint if exists payments_payment_mode_check;

alter table public.payments
  add constraint payments_payment_mode_check
  check (payment_mode = any (array['cash'::text, 'upi'::text, 'online'::text, 'razorpay'::text]));
