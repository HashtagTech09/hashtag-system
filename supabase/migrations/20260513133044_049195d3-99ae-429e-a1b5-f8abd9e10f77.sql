ALTER TABLE public.application_cases
  ADD CONSTRAINT application_cases_enrollment_id_fkey
    FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE,
  ADD CONSTRAINT application_cases_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  ADD CONSTRAINT application_cases_batch_id_fkey
    FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE,
  ADD CONSTRAINT application_cases_requested_by_user_id_fkey
    FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT application_cases_reviewed_by_user_id_fkey
    FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;