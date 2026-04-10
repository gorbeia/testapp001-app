import { createContext, useContext } from "react";
import {
  accessRoleSchema,
  hasPermission,
  membershipTypeSchema,
  type AccessRole,
  type AppPermission,
  type MembershipType,
} from "@shared/permissions";
import { communicationLanguageSchema, type CommunicationLanguage } from "@shared/schema";

export type { AccessRole, MembershipType, AppPermission };

/** Alias for permission string literals (see `Permission` constants in `@shared/permissions`). */
export type Permission = AppPermission;

export type { CommunicationLanguage };

export interface User {
  id: string;
  email: string;
  name: string;
  accessRole: AccessRole;
  membershipType: MembershipType;
  societyId: string;
  linkedMemberId?: string;
  linkedMemberName?: string;
  iban?: string;
  phone?: string;
  avatarUrl?: string;
  /** When true, user-targeted jakinarazpenak are also sent to `email` (login address). */
  notifyEmail: boolean;
  /** Locale for emails and future off-app messages (not the same as UI language). */
  communicationLanguage: CommunicationLanguage;
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
  const comm = communicationLanguageSchema.safeParse(userData.communicationLanguage);
  return {
    id: typeof userData.id === "string" ? userData.id : "",
    email: username,
    name: (typeof userData.name === "string" && userData.name) || username,
    societyId: typeof userData.societyId === "string" ? userData.societyId : "",
    accessRole: ar.success ? ar.data : "member",
    membershipType: mt.success ? mt.data : "full_member",
    phone: typeof userData.phone === "string" ? userData.phone : undefined,
    iban: typeof userData.iban === "string" ? userData.iban : undefined,
    linkedMemberId:
      typeof userData.linkedMemberId === "string" ? userData.linkedMemberId : undefined,
    linkedMemberName:
      typeof userData.linkedMemberName === "string" ? userData.linkedMemberName : undefined,
    avatarUrl:
      typeof userData.avatarUrl === "string" && userData.avatarUrl ? userData.avatarUrl : undefined,
    notifyEmail: typeof userData.notifyEmail === "boolean" ? userData.notifyEmail : true,
    communicationLanguage: comm.success ? comm.data : "eu",
  };
}

/** Parse `auth:user` from localStorage after RBAC migrations or schema changes. */
export function parseStoredUser(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.email !== "string") return null;
  if (typeof o.societyId !== "string" || !o.societyId) return null;
  const ar = accessRoleSchema.safeParse(o.accessRole);
  const mt = membershipTypeSchema.safeParse(o.membershipType);
  const comm = communicationLanguageSchema.safeParse(o.communicationLanguage);
  return {
    id: o.id,
    email: o.email,
    name: (typeof o.name === "string" && o.name) || o.email,
    societyId: o.societyId,
    accessRole: ar.success ? ar.data : "member",
    membershipType: mt.success ? mt.data : "full_member",
    phone: typeof o.phone === "string" ? o.phone : undefined,
    iban: typeof o.iban === "string" ? o.iban : undefined,
    linkedMemberId: typeof o.linkedMemberId === "string" ? o.linkedMemberId : undefined,
    linkedMemberName: typeof o.linkedMemberName === "string" ? o.linkedMemberName : undefined,
    avatarUrl: typeof o.avatarUrl === "string" && o.avatarUrl ? o.avatarUrl : undefined,
    notifyEmail: typeof o.notifyEmail === "boolean" ? o.notifyEmail : true,
    communicationLanguage: comm.success ? comm.data : "eu",
  };
}

/** True if the user has the given permission (via access role). */
export const userCan = (user: User | null, permission: AppPermission): boolean => {
  if (!user) return false;
  return hasPermission(user.accessRole, permission);
};
