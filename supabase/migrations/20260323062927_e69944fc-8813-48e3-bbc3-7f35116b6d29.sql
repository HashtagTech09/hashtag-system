
ALTER TABLE public.studios ADD COLUMN wingperson_id bigint REFERENCES public.users(id);
ALTER TABLE public.studios ADD COLUMN dreamcatcher_id bigint REFERENCES public.users(id);
ALTER TABLE public.studios DROP COLUMN wingperson;
ALTER TABLE public.studios DROP COLUMN dreamcatcher;
