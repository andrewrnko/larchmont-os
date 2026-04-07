'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  collapsed?: boolean
  className?: string
}

export function ThemeToggle({ collapsed, className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className={cn('h-8 w-8 rounded-[6px] bg-[var(--surface-2)]', className)} />
    )
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={cn(
        'flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-[13px] text-[var(--text-secondary)]',
        'hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-all duration-150',
        collapsed && 'justify-center px-1.5',
        className
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4 flex-shrink-0" />
      ) : (
        <Moon className="h-4 w-4 flex-shrink-0" />
      )}
      {!collapsed && (
        <span className="truncate">{isDark ? 'Light mode' : 'Dark mode'}</span>
      )}
    </button>
  )
}
