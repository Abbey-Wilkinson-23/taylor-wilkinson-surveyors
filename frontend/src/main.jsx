import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme as antTheme } from 'antd'
import 'antd/dist/reset.css'
import App from './App.jsx'
import { ThemeContext } from './context/ThemeContext.jsx'

const THEME_KEY = 'tws_dark_mode'

function Root() {
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) === 'true')

  const toggleDark = (val) => {
    setDark(val)
    localStorage.setItem(THEME_KEY, val)
  }

  return (
    <ThemeContext.Provider value={{ dark, toggleDark }}>
      <ConfigProvider
        theme={{
          algorithm: dark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: {
            colorPrimary: '#8753A8',
            colorLink: '#8753A8',
            colorLinkHover: '#9f6dbf',
            borderRadius: 6,
            // Soft dark palette (GitHub "dark dimmed" inspired) — overrides the near-black defaults
            ...(dark ? {
              colorBgBase:       '#22272e',
              colorBgContainer:  '#2d333b',
              colorBgElevated:   '#2d333b',
              colorBgLayout:     '#1c2128',
              colorBorder:       '#444c56',
              colorBorderSecondary: '#373e47',
              colorText:         '#adbac7',
              colorTextSecondary:'#768390',
              colorTextTertiary: '#636e7b',
            } : {}),
          },
          components: {
            Button: { colorPrimary: '#8753A8', algorithm: true },
            Tag:    { colorPrimary: '#8753A8' },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
