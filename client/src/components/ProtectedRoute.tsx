import { ReactNode } from "react";
import { useAuth, userCan } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { AccessDenied } from "@/components/AccessDenied";
import type { AppPermission } from "@shared/permissions";

interface ProtectedRouteProps {
  children: ReactNode;
  /** User must have at least one of these permissions (OR). */
  requires?: AppPermission | AppPermission[];
}

export function ProtectedRoute({ children, requires }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const requiredList: AppPermission[] = !requires
    ? []
    : Array.isArray(requires)
      ? requires
      : [requires];

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLocation("/");
    }
  }, [isAuthenticated, user, setLocation]);

  if (!isAuthenticated || !user) {
    return null;
  }

  if (requiredList.length > 0) {
    const hasAccess = requiredList.some(p => userCan(user, p));
    if (!hasAccess) {
      return <AccessDenied />;
    }
  }

  return <>{children}</>;
}
