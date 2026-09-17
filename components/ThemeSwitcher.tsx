'use client'

import { useEffect, useState } from 'react'

const themes = [
  { name: 'Terre', class: 'theme-defaut' },
  { name: 'Moisson', class: 'theme-moisson' },
  { name: 'Nuit Agricole', class: 'theme-nuit-agricole' },
]

const applyTheme = (themeClass: string) => {
  themes.forEach((t) => document.documentElement.classList.remove(t.class))
  if (themeClass !== 'theme-defaut') {
    document.documentElement.classList.add(themeClass)
  }
}

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState('theme-defaut')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'theme-defaut'
    setCurrentTheme(savedTheme)
    applyTheme(savedTheme)
    setMounted(true)
  }, [])

  const changeTheme = (themeClass: string) => {
    setCurrentTheme(themeClass)
    localStorage.setItem('app-theme', themeClass)
    applyTheme(themeClass)
  }

  if (!mounted) return null

  return (
    <div className="flex items-center gap-2">
      {themes.map((theme) => (
        <button
          key={theme.name}
          type="button"
          onClick={() => changeTheme(theme.class)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
            currentTheme === theme.class
              ? 'bg-primary text-white border-primary shadow-sm'
              : 'bg-surface text-foreground-muted border-surface-border hover:text-foreground hover:bg-black/5'
          }`}
        >
          {theme.name}
        </button>
      ))}
    </div>
  )
}
