export interface UserRole {
  id: number;
  role_id: number;
  organization_id: number;
  is_primary: boolean;
  roles: { name: string; type: string } | null;
}

export const ORG_ROLES = ["admin", "manager", "instructor", "frontdesk"] as const;
export const STUDENT_SIDE_ROLES = ["parent", "member"] as const;
export const ALL_ROLES = [...ORG_ROLES, ...STUDENT_SIDE_ROLES] as const;

export function getRoleNames(userRoles: UserRole[]): string[] {
  return userRoles.map((ur) => ur.roles?.name).filter(Boolean) as string[];
}

export function getPrimaryRole(userRoles: UserRole[]): string | null {
  const primary = userRoles.find((ur) => ur.is_primary);
  return primary?.roles?.name || userRoles[0]?.roles?.name || null;
}

export function hasRole(userRoles: UserRole[], roleName: string): boolean {
  return userRoles.some((ur) => ur.roles?.name === roleName);
}

export function isOrgRole(roleName: string): boolean {
  return (ORG_ROLES as readonly string[]).includes(roleName);
}

export function isStudentSideRole(roleName: string): boolean {
  return (STUDENT_SIDE_ROLES as readonly string[]).includes(roleName);
}

export const roleColors: Record<string, string> = {
  admin: "bg-primary/20 text-primary",
  manager: "bg-warning/20 text-warning",
  frontdesk: "bg-success/20 text-success",
  instructor: "bg-secondary text-secondary-foreground",
  parent: "bg-accent text-accent-foreground",
  member: "bg-muted text-muted-foreground",
};
