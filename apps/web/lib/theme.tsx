'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

export type Theme = 'light' | 'dark'

/** localStorage key; also read by the pre-paint inline script in app/layout.tsx. */
export const THEME_STORAGE_KEY = 'meowlendar-theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The inline script in layout.tsx stamps data-theme before first paint, so
  // hydrate React state from the DOM rather than re-deciding here.
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    if (document.documentElement.dataset.theme === 'dark') {
      setThemeState('dark')
    }
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Private mode / storage disabled: theme still applies for the session.
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
