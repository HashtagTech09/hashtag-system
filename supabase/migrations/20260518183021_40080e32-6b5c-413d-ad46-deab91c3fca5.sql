DELETE FROM enrollment_cycles WHERE created_at >= '2026-05-18 18:22:00+00';
DELETE FROM enrollments WHERE created_at >= '2026-05-18 18:22:00+00';
DELETE FROM students WHERE created_at >= '2026-05-18 18:22:00+00';
DELETE FROM users WHERE created_at >= '2026-05-18 18:22:00+00' AND auth_id IS NULL;