import { useEffect, useState } from 'react'

const STORAGE_KEY = 'online-sudoers-util-theme'
type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    // localStorage / matchMedia may be unavailable; fall back to light.
  }
  return 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Persisting the preference is best-effort; ignore storage failures.
    }
  }, [theme])

  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Toggle dark mode"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
