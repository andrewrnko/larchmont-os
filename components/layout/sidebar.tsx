'use client'

import type { ElementType } from 'react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Inbox, FolderKanban, FileEdit,
  Megaphone, ImageIcon, Library, Palette, CalendarDays, Film,
  Archive, Settings, Zap, ChevronLeft, ChevronRight, Bot, Mic,
  Moon, BarChart2, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { ThemeToggle } from './theme-toggle'
import { QuickCapture } from '../shared/quick-capture'

const NAV_ITEMS: { href: string; label: string; icon: ElementType; badge?: boolean; briefing?: boolean; debrief?: boolean; weeklyReview?: boolean }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/briefing', label: 'Assistant', icon: Bot },
  { href: '/debrief', label: 'End of Day Debrief', icon: Moon, debrief: true },
  { href: '/weekly-review', label: 'Weekly Review', icon: TrendingUp, weeklyReview: true },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/inbox', label: 'Inbox', icon: Inbox, badge: true },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/briefs', label: 'Creative Briefs', icon: FileEdit },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/assets', label: 'Assets', icon: ImageIcon },
  { href: '/resources', label: 'Resource Library', icon: Library },
  { href: '/brand', label: 'Brand Identity', icon: Palette },
  { href: '/events', label: 'Events & Shoots', icon: CalendarDays },
  { href: '/content', label: 'Content Pipeline', icon: Film },
  { href: '/voice-notes', label: 'Voice Notes', icon: Mic },
]

const BOTTOM_NAV = [
  { href: '/archive', label: 'Archive', icon: Archive },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, setSidebarCollapsed, setCommandPaletteOpen } = useUIStore()
  const [mounted, setMounted] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    setMounted(true)
    // Fetch real unread count from Supabase
    const fetchCount = async () => {
      const { count } = await supabase
        .from('inbox_items').select('id', { count: 'exact', head: true }).eq('status', 'New')
      setUnreadCount(count ?? 0)
    }
    fetchCount()
    // Re-fetch whenever window gains focus (inbox updates from other tabs/actions)
    const onFocus = () => fetchCount()
    window.addEventListener('focus', onFocus)
    // Also poll every 30s
    const interval = setInterval(fetchCount, 30000)
    return () => { window.removeEventListener('focus', onFocus); clearInterval(interval) }
  }, [])
  const hour = mounted ? new Date().getHours() : 9
  // Debrief badge: after 4pm
  const shouldShowDebriefBadge = mounted && hour >= 16
  // Weekly review badge: Monday (day 1)
  const shouldShowWeeklyBadge = mounted && new Date().getDay() === 1

  const collapsed = sidebarCollapsed

  return (
    <motion.aside
      animate={{ width: collapsed ? 48 : 240 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'relative flex h-screen flex-shrink-0 flex-col overflow-hidden',
        'border-r border-[var(--border)] bg-[var(--surface)]',
        'transition-colors duration-150',
      )}
      aria-label="Main navigation"
    >
      {/* ── Header ── */}
      <div className={cn(
        'flex h-14 items-center border-b border-[var(--border)] px-3',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[6px] bg-[var(--accent)]">
              <span className="text-[11px] font-bold text-[var(--accent-fg)]">L</span>
            </div>
            <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
              Larchmont HQ
            </span>
          </div>
        )}
        {collapsed && (
          <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[var(--accent)]">
            <span className="text-[11px] font-bold text-[var(--accent-fg)]">L</span>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="rounded-[6px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Scrollable nav ── */}
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-3">
        {/* Theme toggle */}
        <div className={cn('px-2 pb-2', collapsed && 'px-1.5')}>
          <ThemeToggle collapsed={collapsed} />
        </div>

        {/* Cmd+K hint */}
        {!collapsed && (
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className={cn(
              'mx-2 mb-3 flex items-center gap-2 rounded-[6px] border border-[var(--border)]',
              'px-2.5 py-1.5 text-[12px] text-[var(--text-tertiary)]',
              'hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] transition-all duration-150'
            )}
          >
            <span className="flex-1 text-left">Search...</span>
            <kbd className="rounded bg-[var(--surface-2)] px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
        )}

        <div className={cn('mx-2 mb-2 border-t border-[var(--border)]', collapsed && 'mx-1.5')} />

        {/* Main nav */}
        <nav className="flex flex-col gap-0.5 px-2" aria-label="Primary navigation">
          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const count = item.badge ? unreadCount : 0

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.15 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-[13px] font-medium',
                    'transition-all duration-150 cursor-pointer',
                    collapsed && 'justify-center px-0 py-2',
                    isActive
                      ? 'border-l-[3px] border-l-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)] pl-1.5'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]',
                    isActive && collapsed && 'border-l-0 pl-0'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn(
                    'flex-shrink-0',
                    collapsed ? 'h-5 w-5' : 'h-4 w-4',
                    isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'
                  )} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-medium text-white">
                          {count}
                        </span>
                      )}
                      {(item as { debrief?: boolean }).debrief && shouldShowDebriefBadge && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
                        </span>
                      )}
                      {(item as { weeklyReview?: boolean }).weeklyReview && shouldShowWeeklyBadge && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && count > 0 && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--destructive)]" />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </nav>

        <div className={cn('mx-2 my-2 border-t border-[var(--border)]', collapsed && 'mx-1.5')} />

        {/* Bottom nav */}
        <nav className="flex flex-col gap-0.5 px-2" aria-label="Secondary navigation">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-[13px]',
                  'transition-all duration-150',
                  collapsed && 'justify-center px-0 py-2',
                  isActive
                    ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                    : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* ── Quick Capture pinned bottom ── */}
      <div className={cn('border-t border-[var(--border)] p-2', collapsed && 'p-1.5')}>
        {collapsed ? (
          <button
            onClick={() => useUIStore.getState().setQuickCaptureOpen(true)}
            className="flex w-full items-center justify-center rounded-[6px] bg-[var(--accent)] py-2 text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            aria-label="Quick capture"
          >
            <Zap className="h-4 w-4" />
          </button>
        ) : (
          <QuickCapture />
        )}
      </div>

      {/* ── Expand button (collapsed state) ── */}
      {collapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="absolute -right-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-tertiary)] shadow-[var(--shadow-card)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.aside>
  )
}
