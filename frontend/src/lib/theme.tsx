import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'
// Keep in sync with public/theme.js, which applies the saved theme before the app loads.
const THEME_KEY = 'hsmlis.theme'

type ThemeState = { theme: Theme; setTheme: (theme: Theme) => void }

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(THEME_KEY, next)
    document.documentElement.dataset.theme = next
    setThemeState(next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
