import React, { createContext, useContext } from 'react'

export const Colors = {
  background: {
    primary: '#F8F9FA',
    secondary: '#FFFFFF',
    card: '#FFFFFF',
    elevated: '#F1F3F5',
  },
  gradient: {
    primary: ['#667EEA', '#764BA2'] as readonly string[],
    secondary: ['#F093FB', '#F5576C'] as readonly string[],
    success: ['#11998E', '#38EF7D'] as readonly string[],
    danger: ['#EE0979', '#FF6A00'] as readonly string[],
    warning: ['#F2994A', '#F2C94C'] as readonly string[],
    accent: ['#FA709A', '#FEE140'] as readonly string[],
    canceled: ['#4A5568', '#2D3748'] as readonly string[],
    silent: ['#FF6B6B', '#EE5A6F'] as readonly string[],
  },
  accent: {
    primary: '#FA709A',
    secondary: '#667EEA',
    dark: '#764BA2',
    purple: '#9333EA',
    blue: '#3B82F6',
    green: '#10B981',
    pink: '#EC4899',
  },
  text: {
    primary: '#1A1D29',
    secondary: '#6B7280',
    muted: '#9CA3AF',
    disabled: '#D1D5DB',
  },
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  border: {
    default: '#E5E7EB',
    light: '#F3F4F6',
  },
  badge: {
    silent: '#EF4444',
    silentBg: 'rgba(239, 68, 68, 0.15)',
    worthIt: '#10B981',
    worthItBg: 'rgba(16, 185, 129, 0.15)',
    overpriced: '#F59E0B',
    overpricedBg: 'rgba(245, 158, 11, 0.15)',
    unused: '#6B7280',
    unusedBg: 'rgba(107, 114, 128, 0.15)',
  },
  shadow: {
    small: 'rgba(0, 0, 0, 0.05)',
    medium: 'rgba(0, 0, 0, 0.1)',
    large: 'rgba(0, 0, 0, 0.15)',
  },
}

interface ThemeContextType {
  colors: typeof Colors
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ colors: Colors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}