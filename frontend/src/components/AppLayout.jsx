import { Layout, Menu, Avatar, Typography, Popconfirm, Switch } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  ProfileOutlined,
  BarChartOutlined,
  SafetyOutlined,
  LogoutOutlined,
  EnvironmentOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import logo from '../assets/logo.png'

const { Content } = Layout
const { Text } = Typography

const SIDEBAR_BG_LIGHT = '#A8A8A8'
const SIDEBAR_BG_DARK  = '#1c2128'
const SIDEBAR_WIDTH = 220
const SIDEBAR_COLLAPSED = 64

const ALL_ITEMS = [
  { key: '/instructions',      pageKey: 'instructions',      icon: <FileTextOutlined />,    label: 'Instructions'     },
  { key: '/clients',           pageKey: 'clients',           icon: <TeamOutlined />,        label: 'Clients'          },
  { key: '/surveyors',         pageKey: 'surveyors',         icon: <UserOutlined />,        label: 'Surveyors'        },
  { key: '/survey-types',      pageKey: 'survey-types',      icon: <ProfileOutlined />,     label: 'Survey Types'     },
  { key: '/postcode-coverage', pageKey: 'postcode-coverage', icon: <EnvironmentOutlined />, label: 'Postcode Coverage'},
  { key: '/stats',             pageKey: 'stats',             icon: <BarChartOutlined />,    label: 'Stats'            },
  { key: '/users',             pageKey: 'users',             icon: <SafetyOutlined />,      label: 'Users'            },
]

export default function AppLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { dark, toggleDark } = useTheme()
  const [hovered, setHovered] = useState(false)
  const SIDEBAR_BG = dark ? SIDEBAR_BG_DARK : SIDEBAR_BG_LIGHT

  const allowedPages = user?.page_permissions
    ? new Set(user.page_permissions.split(',').map(p => p.trim()))
    : new Set(['instructions', 'clients', 'surveyors', 'survey-types', 'postcode-coverage'])

  const menuItems = ALL_ITEMS.filter(i => allowedPages.has(i.pageKey))

  const selectedKey = menuItems
    .map(i => i.key)
    .find(k => location.pathname === k || location.pathname.startsWith(k + '/')) || '/instructions'

  const expanded = hovered

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          zIndex: 100,
          width: expanded ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED,
          background: SIDEBAR_BG,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo */}
        <div style={{
          padding: '16px 12px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{ width: 40, height: 38, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
            <img
              src={logo}
              alt="Taylor Wilkinson Surveyors"
              style={{ position: 'absolute', width: 130, top: 0, left: 0, mixBlendMode: 'darken' }}
            />
          </div>
        </div>

        {/* Nav */}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          inlineCollapsed={!expanded}
          style={{ background: SIDEBAR_BG, border: 'none', marginTop: 8, width: expanded ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED, flex: 1 }}
          theme="dark"
        />

        {/* Dark mode toggle */}
        <div style={{
          padding: expanded ? '8px 16px' : '8px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded ? 'space-between' : 'center',
          gap: 8,
          overflow: 'hidden',
        }}>
          {expanded && (
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, whiteSpace: 'nowrap' }}>
              {dark ? 'Dark mode' : 'Light mode'}
            </span>
          )}
          <Switch
            size="small"
            checked={dark}
            onChange={toggleDark}
            checkedChildren={<MoonOutlined />}
            unCheckedChildren={<SunOutlined />}
          />
        </div>

        {/* User + logout */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: expanded ? '12px 16px' : '12px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          justifyContent: expanded ? 'flex-start' : 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <Avatar size={32} style={{ background: '#8753A8', flexShrink: 0, fontSize: 13 }}>
            {user?.email?.[0]?.toUpperCase()}
          </Avatar>
          {expanded && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: '#fff', fontSize: 12, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'capitalize' }}>
                {user?.role}
              </Text>
            </div>
          )}
          {expanded && (
            <Popconfirm title="Sign out?" onConfirm={logout} okText="Sign out" placement="topRight">
              <LogoutOutlined style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }} />
            </Popconfirm>
          )}
        </div>
      </div>

      {/* Main content */}
      <Layout style={{ marginLeft: expanded ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED, transition: 'margin-left 0.2s ease' }}>
        <Content style={{ margin: 24 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
