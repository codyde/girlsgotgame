import React, { createContext, useContext, useEffect, useState } from 'react'

export type ThemeName = 'orange-flames' | 'valkyries-purple' | 'fever-fire' | 'wings-teal' | 'court-dark'

interface Theme {
  name: ThemeName
  displayName: string
  description: string
  isDark: boolean
  fonts: {
    heading: string
    body: string
    accent: string
  }
  colors: {
    primary: {
      50: string
      100: string
      200: string
      300: string
      400: string
      500: string
      600: string
      700: string
      800: string
      900: string
    }
    secondary: {
      50: string
      100: string
      200: string
      300: string
      400: string
      500: string
      600: string
      700: string
      800: string
      900: string
    }
    background: {
      primary: string
      secondary: string
      tertiary: string
    }
    text: {
      primary: string
      secondary: string
      tertiary: string
    }
    border: {
      primary: string
      secondary: string
    }
  }
}

const themes: Record<ThemeName, Theme> = {
  'orange-flames': {
    name: 'orange-flames',
    displayName: 'Orange Flames',
    description: 'High energy orange theme',
    isDark: false,
    fonts: {
      heading: 'Bebas Neue',
      body: 'Inter',
      accent: 'Bebas Neue'
    },
    colors: {
      primary: {
        50: '#fff7ed',
        100: '#ffedd5',
        200: '#fed7aa',
        300: '#fdba74',
        400: '#fb923c',
        500: '#f97316',
        600: '#ea580c',
        700: '#c2410c',
        800: '#9a3412',
        900: '#7c2d12'
      },
      secondary: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f9fafb',
        tertiary: '#f3f4f6'
      },
      text: {
        primary: '#111827',
        secondary: '#374151',
        tertiary: '#6b7280'
      },
      border: {
        primary: '#e5e7eb',
        secondary: '#d1d5db'
      }
    }
  },
  'valkyries-purple': {
    name: 'valkyries-purple',
    displayName: 'Valkyries Purple',
    description: 'Golden State purple and gold power',
    isDark: false,
    fonts: {
      heading: 'Bebas Neue',
      body: 'Inter',
      accent: 'Bebas Neue'
    },
    colors: {
      primary: {
        50: '#faf5ff',
        100: '#f3e8ff',
        200: '#e9d5ff',
        300: '#d8b4fe',
        400: '#c084fc',
        500: '#9d4edd',
        600: '#663399',
        700: '#5a2d82',
        800: '#4c1d95',
        900: '#3b0764'
      },
      secondary: {
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#FFD700',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f'
      },
      background: {
        primary: '#ffffff',
        secondary: '#faf5ff',
        tertiary: '#f3e8ff'
      },
      text: {
        primary: '#111827',
        secondary: '#374151',
        tertiary: '#6b7280'
      },
      border: {
        primary: '#e9d5ff',
        secondary: '#d8b4fe'
      }
    }
  },
  'fever-fire': {
    name: 'fever-fire',
    displayName: 'Fever Fire',
    description: 'Indiana red hot championship energy',
    isDark: false,
    fonts: {
      heading: 'Bebas Neue',
      body: 'Inter',
      accent: 'Bebas Neue'
    },
    colors: {
      primary: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#C8102E',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d'
      },
      secondary: {
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#FFCD00',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f'
      },
      background: {
        primary: '#ffffff',
        secondary: '#fef2f2',
        tertiary: '#fee2e2'
      },
      text: {
        primary: '#111827',
        secondary: '#374151',
        tertiary: '#6b7280'
      },
      border: {
        primary: '#fecaca',
        secondary: '#fca5a5'
      }
    }
  },
  'wings-teal': {
    name: 'wings-teal',
    displayName: 'Wings Teal',
    description: 'Dallas teal and orange flight',
    isDark: false,
    fonts: {
      heading: 'Bebas Neue',
      body: 'Inter',
      accent: 'Bebas Neue'
    },
    colors: {
      primary: {
        50: '#f0fdfa',
        100: '#ccfbf1',
        200: '#99f6e4',
        300: '#5eead4',
        400: '#2dd4bf',
        500: '#008B8B',
        600: '#0d9488',
        700: '#0f766e',
        800: '#115e59',
        900: '#134e4a'
      },
      secondary: {
        50: '#fff7ed',
        100: '#ffedd5',
        200: '#fed7aa',
        300: '#fdba74',
        400: '#fb923c',
        500: '#FF6600',
        600: '#ea580c',
        700: '#c2410c',
        800: '#9a3412',
        900: '#7c2d12'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f0fdfa',
        tertiary: '#ccfbf1'
      },
      text: {
        primary: '#111827',
        secondary: '#374151',
        tertiary: '#6b7280'
      },
      border: {
        primary: '#99f6e4',
        secondary: '#5eead4'
      }
    }
  },
  'court-dark': {
    name: 'court-dark',
    displayName: 'Court Dark',
    description: 'Modern dark mode with orange highlights',
    isDark: true,
    fonts: {
      heading: 'Bebas Neue',
      body: 'Inter',
      accent: 'Bebas Neue'
    },
    colors: {
      primary: {
        50: '#fff7ed',
        100: '#ffedd5',
        200: '#fed7aa',
        300: '#fdba74',
        400: '#fb923c',
        500: '#f97316',
        600: '#ea580c',
        700: '#c2410c',
        800: '#9a3412',
        900: '#7c2d12'
      },
      secondary: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a'
      },
      background: {
        primary: '#111827',
        secondary: '#1f2937',
        tertiary: '#374151'
      },
      text: {
        primary: '#f9fafb',
        secondary: '#e5e7eb',
        tertiary: '#9ca3af'
      },
      border: {
        primary: '#374151',
        secondary: '#4b5563'
      }
    }
  }
}

interface ThemeContextType {
  currentTheme: ThemeName
  theme: Theme
  setTheme: (theme: ThemeName) => void
  themes: typeof themes
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('orange-flames')

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('girlsgotgame-theme') as ThemeName
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme)
    }
  }, [])

  // Apply CSS variables when theme changes
  useEffect(() => {
    const theme = themes[currentTheme]
    const root = document.documentElement

    // Apply primary colors
    Object.entries(theme.colors.primary).forEach(([shade, color]) => {
      root.style.setProperty(`--color-primary-${shade}`, color)
    })

    // Apply secondary colors
    Object.entries(theme.colors.secondary).forEach(([shade, color]) => {
      root.style.setProperty(`--color-secondary-${shade}`, color)
    })

    // Apply background colors
    Object.entries(theme.colors.background).forEach(([name, color]) => {
      root.style.setProperty(`--color-bg-${name}`, color)
    })

    // Apply text colors
    Object.entries(theme.colors.text).forEach(([name, color]) => {
      root.style.setProperty(`--color-text-${name}`, color)
    })

    // Apply border colors
    Object.entries(theme.colors.border).forEach(([name, color]) => {
      root.style.setProperty(`--color-border-${name}`, color)
    })

    // Apply font families
    root.style.setProperty('--font-heading', theme.fonts.heading)
    root.style.setProperty('--font-body', theme.fonts.body)
    root.style.setProperty('--font-accent', theme.fonts.accent)

    // Apply dark mode class
    if (theme.isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [currentTheme])

  const setTheme = (theme: ThemeName) => {
    setCurrentTheme(theme)
    localStorage.setItem('girlsgotgame-theme', theme)
  }

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        theme: themes[currentTheme],
        setTheme,
        themes
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}