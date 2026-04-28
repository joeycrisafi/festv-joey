import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, ApiResponse, UserRole } from '../types';
import { authApi } from '../utils/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'CLIENT' | 'PROVIDER';
    roles?: ('CLIENT' | 'PROVIDER')[];
  }) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => Promise<void>;
  addRole: (role: UserRole) => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('accessToken')
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    localStorage.getItem('refreshToken')
  );
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await authApi.getMe(token) as ApiResponse<User>;
        if (response.success && response.data) {
          // Backend returns user directly in data, not nested
          setUser(response.data as User);
        } else {
          logout();
        }
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [token, logout]);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password }) as ApiResponse<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>;

    if (response.success && response.data) {
      const { user, accessToken, refreshToken: newRefreshToken } = response.data;
      setUser(user);
      setToken(accessToken);
      setRefreshToken(newRefreshToken);
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
    } else {
      throw new Error(response.message || 'Login failed');
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'CLIENT' | 'PROVIDER';
    roles?: ('CLIENT' | 'PROVIDER')[];
  }) => {
    const response = await authApi.register(data) as ApiResponse<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>;

    if (response.success && response.data) {
      const { user, accessToken, refreshToken: newRefreshToken } = response.data;
      setUser(user);
      setToken(accessToken);
      setRefreshToken(newRefreshToken);
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
    } else {
      throw new Error(response.message || 'Registration failed');
    }
  };

  const switchRole = async (role: UserRole) => {
    if (!token) throw new Error('Not authenticated');
    
    const response = await authApi.switchRole(role, token) as ApiResponse<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>;

    if (response.success && response.data) {
      const { user, accessToken, refreshToken: newRefreshToken } = response.data;
      setUser(user);
      setToken(accessToken);
      setRefreshToken(newRefreshToken);
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
    } else {
      throw new Error(response.message || 'Failed to switch role');
    }
  };

  const addRole = async (role: UserRole) => {
    if (!token) throw new Error('Not authenticated');
    
    const response = await authApi.addRole(role, token) as ApiResponse<User>;

    if (response.success && response.data) {
      setUser(response.data);
    } else {
      throw new Error(response.message || 'Failed to add role');
    }
  };

  const hasRole = (role: UserRole): boolean => {
    if (!user) return false;
    return user.roles?.includes(role) || user.role === role;
  };

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const response = await authApi.getMe(token) as ApiResponse<User>;
      if (response.success && response.data) {
        setUser(response.data as User);
      }
    } catch {
      // silently fail
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchRole,
        addRole,
        hasRole,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
