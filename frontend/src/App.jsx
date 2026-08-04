import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { GoogleOAuthProvider } from '@react-oauth/google'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Instructions from './pages/Instructions'
import NewInstruction from './pages/NewInstruction'
import InstructionDetail from './pages/InstructionDetail'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Surveyors from './pages/Surveyors'
import SurveyorDetail from './pages/SurveyorDetail'
import SurveyTypes from './pages/SurveyTypes'
import Stats from './pages/Stats'
import Users from './pages/Users'
import PostcodeCoverage from './pages/PostcodeCoverage'
import { AuthProvider, useAuth } from './context/AuthContext'

const PAGE_ORDER = [
  { pageKey: 'instructions',      path: '/instructions'      },
  { pageKey: 'clients',           path: '/clients'           },
  { pageKey: 'surveyors',         path: '/surveyors'         },
  { pageKey: 'survey-types',      path: '/survey-types'      },
  { pageKey: 'postcode-coverage', path: '/postcode-coverage' },
  { pageKey: 'stats',             path: '/stats'             },
  { pageKey: 'users',             path: '/users'             },
]

function getDefaultRoute(user) {
  if (!user) return '/login'
  if (user.role === 'developer' || user.role === 'admin') return '/instructions'
  const allowed = new Set((user.page_permissions || '').split(',').map(p => p.trim()).filter(Boolean))
  const first = PAGE_ORDER.find(p => allowed.has(p.pageKey))
  return first ? first.path : '/instructions'
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { realUser, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spin style={{ display: 'block', marginTop: 80 }} />
  if (!realUser) return <Navigate to="/login" state={{ from: location }} replace />
  if (adminOnly && realUser.role !== 'admin' && realUser.role !== 'developer') return <Navigate to={getDefaultRoute(realUser)} replace />
  return children
}

function AppRoutes() {
  const { realUser } = useAuth()
  const defaultRoute = getDefaultRoute(realUser)
  return (
    <Routes>
      <Route path="/login" element={realUser ? <Navigate to={defaultRoute} replace /> : <Login />} />
      <Route path="/" element={<Navigate to={defaultRoute} replace />} />
      <Route path="/instructions" element={<ProtectedRoute><AppLayout><Instructions /></AppLayout></ProtectedRoute>} />
      <Route path="/instructions/new" element={<ProtectedRoute><AppLayout><NewInstruction /></AppLayout></ProtectedRoute>} />
      <Route path="/instructions/:id" element={<ProtectedRoute><AppLayout><InstructionDetail /></AppLayout></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><AppLayout><Clients /></AppLayout></ProtectedRoute>} />
      <Route path="/clients/:id" element={<ProtectedRoute><AppLayout><ClientDetail /></AppLayout></ProtectedRoute>} />
      <Route path="/surveyors" element={<ProtectedRoute><AppLayout><Surveyors /></AppLayout></ProtectedRoute>} />
      <Route path="/surveyors/:id" element={<ProtectedRoute><AppLayout><SurveyorDetail /></AppLayout></ProtectedRoute>} />
      <Route path="/survey-types" element={<ProtectedRoute><AppLayout><SurveyTypes /></AppLayout></ProtectedRoute>} />
<Route path="/stats" element={<ProtectedRoute adminOnly><AppLayout><Stats /></AppLayout></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute adminOnly><AppLayout><Users /></AppLayout></ProtectedRoute>} />
      <Route path="/postcode-coverage" element={<ProtectedRoute><AppLayout><PostcodeCoverage /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={defaultRoute} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  )
}
