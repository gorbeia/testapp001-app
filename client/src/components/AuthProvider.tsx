import { useState, type ReactNode } from 'react';
import { AuthContext, type User } from '@/lib/auth';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem('auth:user');
      const token = window.localStorage.getItem('auth:token');
      if (!stored || !token) return null;
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  });

  const login = async (email: string, password: string): Promise<void> => {
    const lowerEmail = email.toLowerCase();

    // Authenticate with the backend
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lowerEmail, password }),
    });

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

    const { user: userData, token } = await response.json();
    
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
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
