import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    localStorage.removeItem('retail_token');
    localStorage.removeItem('retail_user');
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setIsReady(true));
  }, []);

  const login = userData => {
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
    api.post('/auth/logout').catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isReady, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
