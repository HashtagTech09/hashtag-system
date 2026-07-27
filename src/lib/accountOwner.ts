export const ACCOUNT_OWNER_TYPES = ["self", "parent_guardian"] as const;

export type AccountOwnerType = (typeof ACCOUNT_OWNER_TYPES)[number];

export function isAccountOwnerType(value: string | null | undefined): value is AccountOwnerType {
  return ACCOUNT_OWNER_TYPES.includes(value as AccountOwnerType);
}

export function needsAccountSetup(user: {
  account_setup_completed?: boolean | null;
  account_owner_type?: string | null;
}) {
  return user.account_setup_completed === false || !isAccountOwnerType(user.account_owner_type);
}
