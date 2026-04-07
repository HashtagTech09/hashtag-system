
-- 1. Delete enrollment_cycles
DELETE FROM enrollment_cycles;

-- 2. Delete attendance
DELETE FROM attendance;

-- 3. Delete drop_ins
DELETE FROM drop_ins;

-- 4. Delete drop_in_credits
DELETE FROM drop_in_credits;

-- 5. Delete cycle_adjustments
DELETE FROM cycle_adjustments;

-- 6. Delete pending_enrollments
DELETE FROM pending_enrollments;

-- 7. Delete payment_allocations
DELETE FROM payment_allocations;

-- 8. Delete enrollments
DELETE FROM enrollments;

-- 9. Delete payments
DELETE FROM payments;

-- 10. Delete cash_payment_requests
DELETE FROM cash_payment_requests;

-- 11. Delete all students
DELETE FROM students;

-- 12. Delete non-staff user_roles (keep roles tied to organization-type roles)
DELETE FROM user_roles
WHERE user_id NOT IN (
  SELECT ur.user_id FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE r.type = 'organization'
);

-- 13. Delete non-staff users
DELETE FROM users
WHERE organization_id = 1
AND id NOT IN (
  SELECT ur.user_id FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE r.type = 'organization'
);
