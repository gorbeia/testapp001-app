import { ReactNode } from 'react';
import { useAuth, hasAdminAccess, hasCellarmanAccess, hasTreasurerAccess } from '@/lib/auth';
import { useLocation } from 'wouter';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredAccess?: 'admin' | 'cellarman' | 'treasurer';
}

export function ProtectedRoute({ children, requiredAccess }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLocation('/');
      return;
    }

    let hasAccess = false;
    switch (requiredAccess) {
      case 'admin':
        hasAccess = hasAdminAccess(user);
        break;
      case 'cellarman':
        hasAccess = hasCellarmanAccess(user);
        break;
      case 'treasurer':
        hasAccess = hasTreasurerAccess(user);
        break;
      default:
        hasAccess = true;
    }

    if (!hasAccess) {
      setLocation('/'); // Redirect to dashboard
    }
  }, [isAuthenticated, user, requiredAccess, setLocation]);

  // Don't render children while checking access or redirecting
  if (!isAuthenticated || !user) {
    return null;
  }

  let hasAccess = false;
  switch (requiredAccess) {
    case 'admin':
      hasAccess = hasAdminAccess(user);
      break;
    case 'cellarman':
      hasAccess = hasCellarmanAccess(user);
      break;
    case 'treasurer':
      hasAccess = hasTreasurerAccess(user);
      break;
    default:
      hasAccess = true;
  }

  return hasAccess ? <>{children}</> : null;
}
