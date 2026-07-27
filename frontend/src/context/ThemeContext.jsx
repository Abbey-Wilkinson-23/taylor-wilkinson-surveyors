import { createContext, useContext } from 'react'

export const ThemeContext = createContext({ dark: false, toggleDark: () => {} })
export const useTheme = () => useContext(ThemeContext)
