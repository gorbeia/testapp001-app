import { useState, useEffect, type ReactNode } from 'react';
import { AuthContext, type User } from '@/lib/auth';

// Helper function to parse expiration time (e.g., "1h" -> 3600 seconds)
const parseExpirationTime = (expiresIn: string): number => {
  const match = expiresIn.match(/(\d+)([smhd])/);
  if (!match) return 3600; // Default to 1 hour
  
  const [, value, unit] = match;
  const num = parseInt(value, 10);
  
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return 3600;
  }
};

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem('auth:user');
      const token = window.localStorage.getItem('auth:token');
      const tokenExpires = window.localStorage.getItem('auth:tokenExpires');
      
      if (!stored || !token) return null;
      
      // Check if token is expired
      if (tokenExpires && Date.now() > parseInt(tokenExpires, 10)) {
        // Token is expired, clear storage
        window.localStorage.removeItem('auth:user');
        window.localStorage.removeItem('auth:token');
        window.localStorage.removeItem('auth:tokenExpires');
        return null;
      }
      
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  });

  // Refresh token function
  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        credentials: 'include', // Important for cookies
      });

      if (!response.ok) {
        // Refresh failed, clear auth data
        setUser(null);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('auth:user');
          window.localStorage.removeItem('auth:token');
          window.localStorage.removeItem('auth:tokenExpires');
        }
        return false;
      }

      const { user: userData, token, expiresIn } = await response.json();
      
      const updatedUser: User = {
        id: userData.id,
        email: userData.username,
        name: userData.name || userData.username,
        role: userData.role || 'bazkidea',
        function: userData.function || 'arrunta',
        phone: userData.phone,
        iban: userData.iban,
        linkedMemberId: userData.linkedMemberId,
        linkedMemberName: userData.linkedMemberName,
      };

      setUser(updatedUser);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('auth:user', JSON.stringify(updatedUser));
        window.localStorage.setItem('auth:token', token);
        const expirationTime = Date.now() + (parseExpirationTime(expiresIn) * 1000);
        window.localStorage.setItem('auth:tokenExpires', expirationTime.toString());
      }
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  // Check for token expiration on user interaction
  useEffect(() => {
    if (!user) return;

    const checkTokenExpiration = () => {
      const tokenExpires = window.localStorage.getItem('auth:tokenExpires');
      if (tokenExpires && Date.now() > parseInt(tokenExpires, 10)) {
        // Token expired, try to refresh
        refreshToken();
      }
    };

    // Check expiration every 2 minutes (more frequent for 15-minute tokens)
    const interval = setInterval(checkTokenExpiration, 2 * 60 * 1000);
    
    // Also check on visibility change (user returns to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkTokenExpiration();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const login = async (email: string, password: string, societyId: string): Promise<void> => {
    const lowerEmail = email.toLowerCase();

    try {
      // Authenticate with the backend
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lowerEmail, password, societyId }),
      });

      if (!response.ok) {
        // Check if it's a network/server error vs authentication error
        if (response.status === 0 || response.type === 'error') {
          throw new Error('Server connection failed');
        }
        
        // For other HTTP errors, check if it's specifically invalid credentials
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401 || errorData.message?.includes('credentials')) {
          throw new Error('Invalid credentials');
        } else {
          throw new Error('Server error occurred');
        }
      }

      const { user: userData, token, expiresIn } = await response.json();
      
      // Convert backend user format to frontend User format
      const user: User = {
        id: userData.id,
        email: userData.username,
        name: userData.name || userData.username,
        role: userData.role || 'bazkidea',
        function: userData.function || 'arrunta',
        phone: userData.phone,
        iban: userData.iban,
        linkedMemberId: userData.linkedMemberId,
        linkedMemberName: userData.linkedMemberName,
      };

      setUser(user);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('auth:user', JSON.stringify(user));
        window.localStorage.setItem('auth:token', token);
        // Store token expiration time
        const expirationTime = Date.now() + (parseExpirationTime(expiresIn) * 1000);
        window.localStorage.setItem('auth:tokenExpires', expirationTime.toString());
      }
    } catch (error) {
      // Re-throw the error to be handled by the LoginForm
      throw error;
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('auth:user', JSON.stringify(updatedUser));
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to invalidate session
      const token = window.localStorage.getItem('auth:token');
      if (token) {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }
    } catch (error) {
      // Continue with local logout even if server logout fails
      console.error('Logout error:', error);
    }
    
    setUser(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('auth:user');
      window.localStorage.removeItem('auth:token');
      window.localStorage.removeItem('auth:tokenExpires');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
