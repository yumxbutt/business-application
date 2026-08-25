import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(authService.getUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const currentUser = await authService.refreshSession();
        setUser(currentUser);
      } catch {
        try {
          const currentUser = await authService.me();
          setUser(currentUser);
        } catch {
          sessionStorage.removeItem('bms_user');
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (credentials) => {
    const payload = await authService.login(credentials);
    setUser(payload.user);
    return payload.user;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      sessionStorage.removeItem('bms_user');
    }
    setUser(null);
  };

  const updateProfile = async (payload) => {
    const updatedUser = await authService.updateProfile(payload);
    setUser(updatedUser);
    return updatedUser;
  };

  const refreshSession = async () => {
    const updatedUser = await authService.refreshSession();
    setUser(updatedUser);
    return updatedUser;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      updateProfile,
      refreshSession,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
