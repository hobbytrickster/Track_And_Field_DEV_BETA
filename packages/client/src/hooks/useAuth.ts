import { useState, useEffect, useCallback } from 'react';
import { api, setToken, getToken } from '../api/client';

interface User {
  id: string;
  email: string;
  displayName: string;
  coins: number;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  appearance?: any;
  stadium?: any;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getMe();
      setUser(data);
    } catch {
      setToken(null);
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await api.login(email, password);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (email: string, password: string, displayName: string) => {
    const data = await api.register(email, password, displayName);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  return { user, loading, login, register, logout, refreshUser, updateUser };
}
