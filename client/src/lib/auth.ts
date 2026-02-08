import { createContext, useContext } from "react";

export type UserRole = "bazkidea" | "laguna";
export type UserFunction = "administratzailea" | "diruzaina" | "sotolaria" | "arrunta";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  function: UserFunction;
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

export const hasAdminAccess = (user: User | null): boolean => {
  return user?.function === "administratzailea";
};

export const hasTreasurerAccess = (user: User | null): boolean => {
  return user?.function === "diruzaina" || user?.function === "administratzailea";
};

export const hasCellarmanAccess = (user: User | null): boolean => {
  return user?.function === "sotolaria" || user?.function === "administratzailea";
};

export const canPostAnnouncements = (user: User | null): boolean => {
  return (
    user?.function === "administratzailea" ||
    user?.function === "diruzaina" ||
    user?.function === "sotolaria"
  );
};
