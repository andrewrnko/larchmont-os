// Larchmont OS sidebar — icon-only rail with portal-mounted hover tooltips.
//
// Styled like the Creative Studio toolbar: each row is a single icon tile
// (40×40, centered in the 68px rail), and its label surfaces as a floating
// tooltip on hover. The tooltip is portalled to document.body so it's not
// clipped by the sidebar's overflow-hidden.
//
// Driven by useUIStore.sidebarMode:
//   - 'full' / 'rail'  → render the 68px rail
//   - 'hidden'         → animate width to 0

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, Trash2, LogOut } from 'lucide-react'
import { logout } from '@/components/auth-gate'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { OBJECT_ROUTES, ROUTE_META } from './route-meta'

const SIDEBAR_WIDTH = 68
const TILE_SIZE = 40

// ─────────────────────────────────────────────────────────────────────────────
// Portal-mounted hover tooltip. Fixed positioning using the anchor row's
// bounding rect so it escapes the sidebar's overflow-hidden clipping.
// ─────────────────────────────────────────────────────────────────────────────

interface TooltipPortalProps {
  label: string
  hint?: string
  anchorRect: DOMRect
}

function TooltipPortal({ label, hint, anchorRect }: TooltipPortalProps) {
  const [mounted, setMounted] = useState(false)
  // Standard SSR-safe portal mount check — document is only available on
  // the client, so we defer portal creation until after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div
      className="pointer-events-none fixed z-[1000] whitespace-nowrap"
      style={{
        left: anchorRect.right + 10,
        top: anchorRect.top + anchorRect.height / 2,
        transform: 'translateY(-50%)',
      }}
    >
      <div
        className="rounded-md border px-3 py-2 shadow-xl"
        style={{
          background: 'var(--bg2)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium" style={{ color: 'var(--text0)' }}>
            {label}
          </span>
          {hint && (
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[11px]"
              style={{ background: 'var(--bg4)', color: 'var(--text1)' }}
            >
              {hint}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tile — the 40×40 clickable element. Centered in its parent via flex.
// All rows (avatar, search, routes, bin, logout) share this exact footprint
// so every center lines up on the same x axis.
// ─────────────────────────────────────────────────────────────────────────────

interface TileProps {
  label: string
  hint?: string
  href?: string
  onClick?: () => void
  isActive?: boolean
  count?: number
  danger?: boolean
  /** Optional explicit background (for route tint colors). */
  background?: string
  /** Optional explicit foreground color. */
  color?: string
  children: React.ReactNode
}

function Tile({
  label,
  hint,
  href,
  onClick,
  isActive,
  count,
  danger,
  background,
  color,
  children,
}: TileProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const onEnter = () => {
    if (wrapperRef.current) {
      setAnchorRect(wrapperRef.current.getBoundingClientRect())
    }
  }
  const onLeave = () => setAnchorRect(null)

  const tileClasses = cn(
    'group relative flex items-center justify-center rounded-[10px]',
    'transition-all duration-150 ease-out',
    'hover:scale-[1.04]',
    isActive && !background && 'text-[color:var(--text0)]'
  )

  const tileStyle: React.CSSProperties = {
    width: TILE_SIZE,
    height: TILE_SIZE,
    background: isActive && !background ? 'var(--bg3)' : background ?? 'var(--bg3)',
    color: color ?? 'var(--text1)',
    boxShadow: isActive ? 'inset 0 0 0 1.5px var(--accent)' : undefined,
  }

  const content = (
    <>
      {children}
      {count !== undefined && count > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none"
          style={{ background: 'var(--accent)', color: '#0a0a09' }}
        >
          {count}
        </span>
      )}
    </>
  )

  return (
    <div
      ref={wrapperRef}
      className="flex w-full justify-center"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {href ? (
        <Link
          href={href}
          className={tileClasses}
          style={tileStyle}
          aria-current={isActive ? 'page' : undefined}
          aria-label={label}
        >
          {content}
        </Link>
      ) : (
        <button
          onClick={onClick}
          className={tileClasses}
          style={tileStyle}
          aria-label={label}
          onMouseEnter={
            danger
              ? (e) => {
                  e.currentTarget.style.background = 'rgba(224,80,80,0.12)'
                  e.currentTarget.style.color = '#e05050'
                }
              : undefined
          }
          onMouseLeave={
            danger
              ? (e) => {
                  e.currentTarget.style.background = 'var(--bg3)'
                  e.currentTarget.style.color = 'var(--text1)'
                }
              : undefined
          }
        >
          {content}
        </button>
      )}
      {anchorRect && <TooltipPortal label={label} hint={hint} anchorRect={anchorRect} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RouteTile — thin wrapper that reads icon/tint from ROUTE_META
// ─────────────────────────────────────────────────────────────────────────────

function RouteTile({
  href,
  isActive,
  count,
}: {
  href: string
  isActive: boolean
  count?: number
}) {
  const meta = ROUTE_META[href]
  if (!meta) return null
  const Icon = meta.icon
  return (
    <Tile
      href={href}
      isActive={isActive}
      label={meta.title}
      count={count}
      background={meta.tint}
      color={meta.tintFg}
    >
      <Icon size={18} strokeWidth={2.2} />
    </Tile>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkspaceAvatar — the L tile. Same 40×40 footprint so it aligns perfectly
// with every row below it.
// ─────────────────────────────────────────────────────────────────────────────

function WorkspaceAvatar() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  return (
    <div
      ref={wrapperRef}
      className="flex w-full justify-center"
      onMouseEnter={() => {
        if (wrapperRef.current) {
          setAnchorRect(wrapperRef.current.getBoundingClientRect())
        }
      }}
      onMouseLeave={() => setAnchorRect(null)}
    >
      <div
        className="flex items-center justify-center rounded-[10px] text-[15px] font-semibold transition-transform duration-150 ease-out hover:scale-[1.04]"
        style={{
          width: TILE_SIZE,
          height: TILE_SIZE,
          background:
            'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
          color: '#0a0a09',
        }}
      >
        L
      </div>
      {anchorRect && (
        <TooltipPortal label="Larchmont OS" hint="Personal Space" anchorRect={anchorRect} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar root
// ─────────────────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const sidebarMode = useUIStore((s) => s.sidebarMode)
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)

  const [mounted, setMounted] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // SSR-safe hydration marker — standard Next.js pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const fetchCount = async () => {
      const { count } = await supabase
        .from('inbox_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'New')
      setUnreadCount(count ?? 0)
    }
    fetchCount()
    const onFocus = () => fetchCount()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(fetchCount, 30000)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [])

  const isActiveRoute = useMemo(
    () => (href: string) => pathname === href || pathname.startsWith(href + '/'),
    [pathname]
  )

  const countForRoute = (href: string): number | undefined => {
    if (href === '/inbox' && mounted) return unreadCount
    return undefined
  }

  // Visible unless explicitly hidden. Both 'full' and 'rail' render as the
  // rail since the distinction no longer matters visually.
  const width = sidebarMode === 'hidden' ? 0 : SIDEBAR_WIDTH

  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-r"
      style={{
        background: 'var(--bg1)',
        borderColor: 'var(--border)',
      }}
      aria-label="Main navigation"
    >
      <div className="flex h-full w-[68px] shrink-0 flex-col">
        {/* Workspace avatar — no text, tooltip on hover */}
        <div
          className="flex h-[56px] shrink-0 items-center justify-center border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <WorkspaceAvatar />
        </div>

        {/* Search — same Tile footprint as routes */}
        <div className="pt-2">
          <Tile
            label="Search"
            hint="⌘K"
            onClick={() => setCommandPaletteOpen(true)}
          >
            <Search size={18} strokeWidth={2.2} />
          </Tile>
        </div>

        <div className="mx-3 my-2 h-px" style={{ background: 'var(--border)' }} />

        {/* Routes — flat list, icon-only tiles, tooltips on hover.
            scrollbar-gutter: stable prevents scrollbar flicker that otherwise
            causes sibling rows to jitter while scrolling. */}
        <nav
          className="flex flex-1 flex-col gap-1.5 overflow-y-auto py-0.5"
          style={{ scrollbarGutter: 'stable' }}
          aria-label="Primary navigation"
        >
          {OBJECT_ROUTES.map((href) => (
            <RouteTile
              key={href}
              href={href}
              isActive={isActiveRoute(href)}
              count={countForRoute(href)}
            />
          ))}
        </nav>

        {/* Footer — Bin + optional Logout */}
        <div
          className="flex shrink-0 flex-col gap-1.5 border-t py-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <Tile href="/archive" isActive={isActiveRoute('/archive')} label="Bin">
            <Trash2 size={17} />
          </Tile>
          {process.env.NEXT_PUBLIC_APP_PASSWORD && (
            <Tile label="Logout" onClick={logout} danger>
              <LogOut size={17} />
            </Tile>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
