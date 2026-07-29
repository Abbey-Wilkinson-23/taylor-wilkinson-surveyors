import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)   // { email, role }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('tws_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) }
      catch { localStorage.removeItem('tws_user') }
    }
    setLoading(false)
  }, [])

  const login = (email, role, token, page_permissions) => {
    localStorage.setItem('tws_token', token)
    localStorage.setItem('tws_user', JSON.stringify({ email, role, page_permissions }))
    setUser({ email, role, page_permissions })
  }

  const logout = () => {
    localStorage.removeItem('tws_token')
    localStorage.removeItem('tws_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
