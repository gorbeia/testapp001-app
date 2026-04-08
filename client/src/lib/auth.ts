import { createContext, useContext } from "react";
import {
  accessRoleSchema,
  hasPermission,
  membershipTypeSchema,
  type AccessRole,
  type AppPermission,
  type MembershipType,
} from "@shared/permissions";

export type { AccessRole, MembershipType, AppPermission };

/** Alias for permission string literals (see `Permission` constants in `@shared/permissions`). */
export type Permission = AppPermission;

export interface User {
  id: string;
  email: string;
  name: string;
  accessRole: AccessRole;
  membershipType: MembershipType;
  linkedMemberId?: string;
  linkedMemberName?: string;
  iban?: string;
  phone?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, societyId: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
  updateUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Normalize API/login payload (handles missing or legacy invalid enum values). */
export function userFromApiSessionPayload(userData: Record<string, unknown>): User {
  const username = typeof userData.username === "string" ? userData.username : "";
  const ar = accessRoleSchema.safeParse(userData.accessRole);
  const mt = membershipTypeSchema.safeParse(userData.membershipType);
  return {
    id: typeof userData.id === "string" ? userData.id : "",
    email: username,
    name: (typeof userData.name === "string" && userData.name) || username,
    accessRole: ar.success ? ar.data : "member",
    membershipType: mt.success ? mt.data : "full_member",
    phone: typeof userData.phone === "string" ? userData.phone : undefined,
    iban: typeof userData.iban === "string" ? userData.iban : undefined,
    linkedMemberId: typeof userData.linkedMemberId === "string" ? userData.linkedMemberId : undefined,
    linkedMemberName: typeof userData.linkedMemberName === "string" ? userData.linkedMemberName : undefined,
  };
}

/** Parse `auth:user` from localStorage after RBAC migrations or schema changes. */
export function parseStoredUser(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.email !== "string") return null;
  const ar = accessRoleSchema.safeParse(o.accessRole);
  const mt = membershipTypeSchema.safeParse(o.membershipType);
  return {
    id: o.id,
    email: o.email,
    name: (typeof o.name === "string" && o.name) || o.email,
    accessRole: ar.success ? ar.data : "member",
    membershipType: mt.success ? mt.data : "full_member",
    phone: typeof o.phone === "string" ? o.phone : undefined,
    iban: typeof o.iban === "string" ? o.iban : undefined,
    linkedMemberId: typeof o.linkedMemberId === "string" ? o.linkedMemberId : undefined,
    linkedMemberName: typeof o.linkedMemberName === "string" ? o.linkedMemberName : undefined,
  };
}

/** True if the user has the given permission (via access role). */
export const userCan = (user: User | null, permission: AppPermission): boolean => {
  if (!user) return false;
  return hasPermission(user.accessRole, permission);
};
