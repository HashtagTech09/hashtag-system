ALTER TABLE public.drop_ins
  ADD COLUMN IF NOT EXISTS adjusted_payment_id bigint REFERENCES public.payments(id),
  ADD COLUMN IF NOT EXISTS adjusted_amount numeric;

CREATE INDEX IF NOT EXISTS idx_drop_ins_adjusted_payment_id
  ON public.drop_ins(adjusted_payment_id);
