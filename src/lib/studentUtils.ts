export interface StudentWithUser {
  phone?: string | null;
  email?: string | null;
  users?: { phone?: string | null; email?: string | null; name?: string | null } | null;
}

export function getDisplayPhone(student: StudentWithUser): string {
  return student.phone || student.users?.phone || "—";
}

export function getDisplayEmail(student: StudentWithUser): string {
  return student.email || student.users?.email || "—";
}

export type ContactSource = "Student" | "Primary" | null;

export function getPhoneSource(student: StudentWithUser): ContactSource {
  if (student.phone) return "Student";
  if (student.users?.phone) return "Primary";
  return null;
}

export function getEmailSource(student: StudentWithUser): ContactSource {
  if (student.email) return "Student";
  if (student.users?.email) return "Primary";
  return null;
}
