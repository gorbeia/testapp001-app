import { createContext, useContext } from "react";
import {
  hasPermission,
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

/** True if the user has the given permission (via access role). */
export const userCan = (user: User | null, permission: AppPermission): boolean => {
  if (!user) return false;
  return hasPermission(user.accessRole, permission);
};
