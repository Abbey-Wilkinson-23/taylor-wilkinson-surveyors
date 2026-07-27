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
