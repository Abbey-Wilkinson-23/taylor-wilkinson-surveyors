import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Typography, Alert } from 'antd'
import { GoogleLogin } from '@react-oauth/google'
import { googleAuth } from '../api/client'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

const { Text } = Typography

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState(null)

  const from = location.state?.from?.pathname || '/instructions'

  const handleSuccess = async (credentialResponse) => {
    setError(null)
    try {
      const data = await googleAuth(credentialResponse.credential)
      login(data.email, data.role, data.access_token)
      navigate(from, { replace: true })
    } catch (e) {
      setError(e.response?.data?.detail || 'Login failed. You may not have access to this system.')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: 'inherit',
    }}>
      {/* Left panel — branding */}
      <div style={{
        flex: '0 0 45%',
        background: 'linear-gradient(160deg, #794899 0%, #9462b6 50%, #b388ce 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: -80, left: -80,
          width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position: 'absolute', bottom: 120, left: -40,
          width: 160, height: 160, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }} />

        <img
          src={logo}
          alt="Taylor Wilkinson Surveyors"
          style={{ width: 420, mixBlendMode: 'multiply', filter: 'contrast(3) brightness(1.1)' }}
        />
        <div style={{ textAlign: 'center', position: 'relative', marginTop: 24 }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, maxWidth: 260 }}>
            Internal management system for instructions, clients, and surveyors.
          </div>
        </div>
      </div>

      {/* Right panel — sign in */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa',
        padding: 48,
      }}>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
              Welcome back
            </div>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Sign in with your approved Google account to continue.
            </Text>
          </div>

          {error && (
            <Alert
              type="error"
              message={error}
              style={{ marginBottom: 20, fontSize: 13 }}
              showIcon
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError('Google sign-in failed. Please try again.')}
              useOneTap
              width="340"
            />
          </div>

          <div style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: '1px solid #f0f0f0',
            textAlign: 'center',
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Don't have access?{' '}
              <span style={{ color: '#8753A8' }}>Contact your administrator.</span>
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}
