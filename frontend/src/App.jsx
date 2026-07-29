import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { GoogleOAuthProvider } from '@react-oauth/google'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Instructions from './pages/Instructions'
import NewInstruction from './pages/NewInstruction'
import InstructionDetail from './pages/InstructionDetail'
import Clients from './pages/Clients'
import Surveyors from './pages/Surveyors'
import SurveyorDetail from './pages/SurveyorDetail'
import SurveyTypes from './pages/SurveyTypes'
import Stats from './pages/Stats'
import Users from './pages/Users'
import PostcodeCoverage from './pages/PostcodeCoverage'
import { AuthProvider, useAuth } from './context/AuthContext'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spin style={{ display: 'block', marginTop: 80 }} />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (adminOnly && user.role !== 'admin' && user.role !== 'developer') return <Navigate to="/instructions" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/instructions" replace /> : <Login />} />
      <Route path="/" element={<Navigate to="/instructions" replace />} />
      <Route path="/instructions" element={<ProtectedRoute><AppLayout><Instructions /></AppLayout></ProtectedRoute>} />
      <Route path="/instructions/new" element={<ProtectedRoute><AppLayout><NewInstruction /></AppLayout></ProtectedRoute>} />
      <Route path="/instructions/:id" element={<ProtectedRoute><AppLayout><InstructionDetail /></AppLayout></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><AppLayout><Clients /></AppLayout></ProtectedRoute>} />
      <Route path="/surveyors" element={<ProtectedRoute><AppLayout><Surveyors /></AppLayout></ProtectedRoute>} />
      <Route path="/surveyors/:id" element={<ProtectedRoute><AppLayout><SurveyorDetail /></AppLayout></ProtectedRoute>} />
      <Route path="/survey-types" element={<ProtectedRoute><AppLayout><SurveyTypes /></AppLayout></ProtectedRoute>} />
<Route path="/stats" element={<ProtectedRoute adminOnly><AppLayout><Stats /></AppLayout></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute adminOnly><AppLayout><Users /></AppLayout></ProtectedRoute>} />
      <Route path="/postcode-coverage" element={<ProtectedRoute><AppLayout><PostcodeCoverage /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/instructions" replace />} />
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
