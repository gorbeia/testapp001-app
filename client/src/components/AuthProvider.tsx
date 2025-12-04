import { useState, type ReactNode } from 'react';
import { AuthContext, type User } from '@/lib/auth';

interface AuthProviderProps {
  children: ReactNode;
}

// todo: remove mock functionality - replace with real authentication
const mockUsers: Record<string, User> = {
  'admin@txokoa.eus': {
    id: '1',
    email: 'admin@txokoa.eus',
    name: 'Mikel Etxeberria',
    role: 'bazkidea',
    function: 'administratzailea',
    iban: 'ES91 2100 0418 4502 0005 1332',
    phone: '+34 943 123 456',
  },
  'diruzaina@txokoa.eus': {
    id: '2',
    email: 'diruzaina@txokoa.eus',
    name: 'Ane Zelaia',
    role: 'bazkidea',
    function: 'diruzaina',
    iban: 'ES91 2100 0418 4502 0005 1333',
    phone: '+34 943 234 567',
  },
  'sotolaria@txokoa.eus': {
    id: '3',
    email: 'sotolaria@txokoa.eus',
    name: 'Jon Agirre',
    role: 'bazkidea',
    function: 'sotolaria',
    iban: 'ES91 2100 0418 4502 0005 1334',
    phone: '+34 943 345 678',
  },
  'bazkidea@txokoa.eus': {
    id: '4',
    email: 'bazkidea@txokoa.eus',
    name: 'Miren Urrutia',
    role: 'bazkidea',
    function: 'arrunta',
    iban: 'ES91 2100 0418 4502 0005 1335',
    phone: '+34 943 456 789',
  },
  'laguna@txokoa.eus': {
    id: '5',
    email: 'laguna@txokoa.eus',
    name: 'Andoni Garcia',
    role: 'laguna',
    function: 'arrunta',
    linkedMemberId: '4',
    linkedMemberName: 'Miren Urrutia',
    phone: '+34 943 567 890',
  },
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, _password: string): Promise<void> => {
    // todo: remove mock functionality - implement real login API call
    const mockUser = mockUsers[email.toLowerCase()];
    if (mockUser) {
      setUser(mockUser);
    } else {
      throw new Error('Invalid credentials');
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
