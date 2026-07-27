import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import 'antd/dist/reset.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#8753A8',
          colorLink: '#8753A8',
          colorLinkHover: '#9f6dbf',
          borderRadius: 6,
        },
        components: {
          Button: {
            colorPrimary: '#8753A8',
            algorithm: true,
          },
          Tag: {
            colorPrimary: '#8753A8',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
)
