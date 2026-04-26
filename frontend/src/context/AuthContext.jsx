// src/context/AuthContext.jsx
// Provides user session state to the whole app.

import React, { createContext, useContext, useEffect, useState } from 'react'
import { getMe, logout as apiLogout } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // null = not yet loaded
  const [loading, setLoading] = useState(true)

  // On mount, check if a session cookie already exists
  useEffect(() => {
    getMe()
      .then(({ data }) => setUser(data))
      .catch(() => setUser(undefined))  // undefined = confirmed not logged in
      .finally(() => setLoading(false))
  }, [])

  const login = (userData) => setUser(userData)

  const logout = async () => {
    await apiLogout().catch(() => {})
    setUser(undefined)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
