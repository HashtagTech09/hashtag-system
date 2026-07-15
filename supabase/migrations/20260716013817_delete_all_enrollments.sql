-- Clear all enrollment-related records while preserving students, users, payments, and batches.
DELETE FROM public.application_cases;
DELETE FROM public.enrollment_cycles;
DELETE FROM public.pending_enrollments;
DELETE FROM public.enrollments;
