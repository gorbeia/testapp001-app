import { z } from "zod";

/** Fine-grained permissions checked on API and client (via role mapping). */
export const Permission = {
  USERS_LIST: "users.list",
  USERS_MANAGE: "users.manage",
  PRODUCTS_MANAGE: "products.manage",
  CATEGORIES_MANAGE: "categories.manage",
  TABLES_MANAGE: "tables.manage",
  SUBSCRIPTIONS_MANAGE: "subscriptions.manage",
  /** Full society reservation list / filters (admin + treasurer; not cellarman). */
  RESERVATIONS_REGISTRY: "reservations.registry",
  /** View or cancel another member’s reservation (admin, treasurer, cellarman). */
  RESERVATIONS_MODERATE: "reservations.moderate",
  RESERVATIONS_ADMIN: "reservations.admin",
  CONSUMPTIONS_ADMIN: "consumptions.admin",
  CREDITS_VIEW: "credits.view",
  CREDITS_MANAGE: "credits.manage",
  SEPA_EXPORT: "sepa.export",
  MOVEMENTS_VIEW: "movements.view",
  MOVEMENTS_MANAGE: "movements.manage",
  BANK_TRANSFERS_MANAGE: "bank-transfers.manage",
  NOTES_MANAGE: "notes.manage",
  SOCIETY_MANAGE: "society.manage",
  /** Create notifications targeted at users other than self (staff). */
  NOTIFICATIONS_BROADCAST: "notifications.broadcast",
} as const;

/** A single permission string (values of {@link Permission}). */
export type AppPermission = (typeof Permission)[keyof typeof Permission];

export const accessRoleSchema = z.enum(["admin", "treasurer", "cellarman", "member"]);
export type AccessRole = z.infer<typeof accessRoleSchema>;

export const membershipTypeSchema = z.enum(["full_member", "companion"]);
export type MembershipType = z.infer<typeof membershipTypeSchema>;

const allPermissionValues = Object.values(Permission) as AppPermission[];

export const ALL_PERMISSIONS: readonly AppPermission[] = allPermissionValues;

const treasurerPermissions: AppPermission[] = [
  Permission.USERS_LIST,
  Permission.CREDITS_VIEW,
  Permission.CREDITS_MANAGE,
  Permission.SEPA_EXPORT,
  Permission.MOVEMENTS_VIEW,
  Permission.MOVEMENTS_MANAGE,
  Permission.BANK_TRANSFERS_MANAGE,
  Permission.SOCIETY_MANAGE,
  Permission.CATEGORIES_MANAGE,
  Permission.NOTIFICATIONS_BROADCAST,
  Permission.RESERVATIONS_REGISTRY,
  Permission.RESERVATIONS_MODERATE,
];

const cellarmanPermissions: AppPermission[] = [
  Permission.PRODUCTS_MANAGE,
  Permission.CONSUMPTIONS_ADMIN,
  Permission.RESERVATIONS_MODERATE,
  Permission.USERS_LIST,
  Permission.NOTIFICATIONS_BROADCAST,
];

/** Maps each access role to the permissions it grants. */
export const ROLE_PERMISSIONS: Record<AccessRole, readonly AppPermission[]> = {
  admin: ALL_PERMISSIONS,
  treasurer: treasurerPermissions,
  cellarman: cellarmanPermissions,
  member: [],
};

export function hasPermission(role: AccessRole, permission: AppPermission): boolean {
  const parsed = accessRoleSchema.safeParse(role);
  if (!parsed.success) return false;
  return ROLE_PERMISSIONS[parsed.data].includes(permission);
}

export function hasAnyPermission(role: AccessRole, permissions: readonly AppPermission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/** Product write access: staff with product permission, full members only (companions never). */
export function canMutateProducts(user: {
  accessRole: AccessRole;
  membershipType: MembershipType;
}): boolean {
  return (
    hasPermission(user.accessRole, Permission.PRODUCTS_MANAGE) &&
    user.membershipType === "full_member"
  );
}

/** Society-wide reservation list without member-only filters (admin + treasurer). */
export function canViewReservationRegistry(role: AccessRole): boolean {
  return hasPermission(role, Permission.RESERVATIONS_REGISTRY);
}

/** View or cancel another user’s reservation (admin, treasurer, cellarman). */
export function canModerateReservations(role: AccessRole): boolean {
  return hasPermission(role, Permission.RESERVATIONS_MODERATE);
}

/** Consumption session admin paths (not same as reservation list filter). */
export function canModerateConsumptions(role: AccessRole): boolean {
  return hasPermission(role, Permission.CONSUMPTIONS_ADMIN);
}
