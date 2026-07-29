import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [realUser, setRealUser] = useState(null)
  const [impersonating, setImpersonating] = useState(null) // { email, role, page_permissions }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('tws_user')
    if (stored) {
      try { setRealUser(JSON.parse(stored)) }
      catch { localStorage.removeItem('tws_user') }
    }
    setLoading(false)
  }, [])

  const login = (email, role, token, page_permissions) => {
    localStorage.setItem('tws_token', token)
    localStorage.setItem('tws_user', JSON.stringify({ email, role, page_permissions }))
    setRealUser({ email, role, page_permissions })
    setImpersonating(null)
  }

  const logout = () => {
    localStorage.removeItem('tws_token')
    localStorage.removeItem('tws_user')
    setRealUser(null)
    setImpersonating(null)
  }

  const impersonate = (target) => {
    // target: { email, role, page_permissions }
    setImpersonating({ email: target.email, role: target.role, page_permissions: target.page_permissions })
  }

  const stopImpersonating = () => {
    setImpersonating(null)
  }

  // What the rest of the app sees as "current user"
  const user = impersonating ?? realUser

  return (
    <AuthContext.Provider value={{ user, realUser, impersonating, login, logout, impersonate, stopImpersonating, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
