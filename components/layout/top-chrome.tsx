// Top chrome bar — Anytype-style header strip above everything.
//
// Left cluster: sidebar toggle → divider → back (prev Object) → forward
//   (next Object) → settings.
// Back/forward navigate through the canonical OBJECT_ROUTES list — NOT
// browser history — so the user cycles through their workspace the way
// Anytype does.
//
// Center: current route's icon + title (via ROUTE_META).
// Right: more menu.

'use client'

import { useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  PanelLeft, ArrowLeft, ArrowRight, Settings, MoreHorizontal,
} from 'lucide-react'
import { useUIStore, type SidebarMode } from '@/lib/store'
import { cn } from '@/lib/utils'
import { OBJECT_ROUTES, ROUTE_META } from './route-meta'

function TopIconButton({
  children,
  onClick,
  title,
  active,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  title?: string
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-[6px]',
        'transition-colors duration-150',
        disabled && 'cursor-not-allowed opacity-40',
        !disabled && active && 'text-[color:var(--text0)]',
        !disabled &&
          !active &&
          'text-[color:var(--text2)] hover:bg-[color:var(--bg3)] hover:text-[color:var(--text0)]'
      )}
    >
      {children}
    </button>
  )
}

const SIDEBAR_MODE_LABELS: Record<SidebarMode, string> = {
  full: 'Hide sidebar',
  rail: 'Show sidebar',
  hidden: 'Show sidebar',
}

export function TopChrome() {
  const router = useRouter()
  const pathname = usePathname()
  const sidebarMode = useUIStore((s) => s.sidebarMode)
  const cycleSidebarMode = useUIStore((s) => s.cycleSidebarMode)

  // Look up the current route in OBJECT_ROUTES to compute prev/next.
  const { prevRoute, nextRoute, meta } = useMemo(() => {
    // Match the active route. Use startsWith so nested routes still resolve
    // to their parent Object (e.g. /projects/abc → /projects).
    const activeIdx = OBJECT_ROUTES.findIndex(
      (r) => pathname === r || pathname.startsWith(r + '/')
    )
    const total = OBJECT_ROUTES.length
    const prev =
      activeIdx === -1
        ? OBJECT_ROUTES[total - 1]
        : OBJECT_ROUTES[(activeIdx - 1 + total) % total]
    const next =
      activeIdx === -1
        ? OBJECT_ROUTES[0]
        : OBJECT_ROUTES[(activeIdx + 1) % total]
    const m = ROUTE_META[pathname] ?? (activeIdx !== -1 ? ROUTE_META[OBJECT_ROUTES[activeIdx]] : undefined)
    return { prevRoute: prev, nextRoute: next, meta: m }
  }, [pathname])

  const Icon = meta?.icon ?? Settings
  const title = meta?.title ?? inferTitle(pathname)

  return (
    <header
      className="flex h-12 shrink-0 items-center justify-between border-b px-2.5"
      style={{
        background: 'var(--bg1)',
        borderColor: 'var(--border)',
      }}
    >
      {/* ── Left cluster ── */}
      <div className="flex items-center gap-1">
        <TopIconButton
          title={SIDEBAR_MODE_LABELS[sidebarMode]}
          onClick={cycleSidebarMode}
          active={sidebarMode !== 'hidden'}
        >
          <PanelLeft size={18} />
        </TopIconButton>

        <div className="mx-2 h-5 w-px" style={{ background: 'var(--border)' }} />

        <TopIconButton
          title={`Previous object · ${ROUTE_META[prevRoute]?.title ?? prevRoute}`}
          onClick={() => router.push(prevRoute)}
        >
          <ArrowLeft size={18} />
        </TopIconButton>
        <TopIconButton
          title={`Next object · ${ROUTE_META[nextRoute]?.title ?? nextRoute}`}
          onClick={() => router.push(nextRoute)}
        >
          <ArrowRight size={18} />
        </TopIconButton>
        <TopIconButton title="Settings" onClick={() => router.push('/settings')}>
          <Settings size={18} />
        </TopIconButton>
      </div>

      {/* ── Center cluster ── */}
      <div className="flex items-center gap-2.5 text-[14.5px]" style={{ color: 'var(--text1)' }}>
        <span
          className="flex h-[24px] w-[24px] items-center justify-center rounded-[6px]"
          style={{
            background: meta?.tint ?? 'var(--bg3)',
            color: meta?.tintFg ?? 'var(--text2)',
          }}
        >
          <Icon size={14} strokeWidth={2.2} />
        </span>
        <span className="font-medium" style={{ color: 'var(--text0)' }}>
          {title}
        </span>
      </div>

      {/* ── Right cluster ── */}
      <div className="flex items-center gap-1">
        <TopIconButton title="More">
          <MoreHorizontal size={18} />
        </TopIconButton>
      </div>
    </header>
  )
}

function inferTitle(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean).pop() ?? 'Home'
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
