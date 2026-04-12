// Anytype-style page header / breadcrumb bar.
// 48px tall, sits just below the global TopChrome. Back/forward + customize
// on the left, icon + title in the center-left, actions slot on the right
// (pages can still pass their own buttons via `actions`).

'use client'

import { usePathname } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROUTE_META } from '@/components/layout/route-meta'

interface PageHeaderProps {
  title?: string
  /**
   * @deprecated Description line was removed from the header. Prop kept for
   * backwards compatibility with callers that still pass it — the value is
   * intentionally ignored.
   */
  description?: string
  actions?: React.ReactNode
  className?: string
}

function ChromeIcon({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick?: () => void
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-[4px]',
        'text-[color:var(--text2)] transition-colors duration-100',
        'hover:bg-[color:var(--bg3)] hover:text-[color:var(--text0)]'
      )}
    >
      {children}
    </button>
  )
}

export function PageHeader({ title, actions, className }: PageHeaderProps) {
  // `description` is accepted via PageHeaderProps for backwards compatibility
  // but intentionally ignored — the subhead was removed in the redesign.
  const pathname = usePathname()
  const meta = ROUTE_META[pathname]
  const resolvedTitle = title ?? meta?.title ?? 'Untitled'
  const Icon = meta?.icon

  return (
    <div
      suppressHydrationWarning
      className={cn(
        'sticky top-0 z-20 -mx-6 -mt-6 mb-6 flex h-12 items-center gap-2 border-b px-3',
        className
      )}
      style={{
        background: 'var(--bg0)',
        borderColor: 'var(--border)',
      }}
    >
      {/* ── Left: nav arrows ── */}
      <ChromeIcon onClick={() => window.history.back()} title="Back">
        <ArrowLeft size={16} />
      </ChromeIcon>
      <ChromeIcon onClick={() => window.history.forward()} title="Forward">
        <ArrowRight size={16} />
      </ChromeIcon>

      <div className="mx-1 h-4 w-px" style={{ background: 'var(--border)' }} />

      {/* ── Center: icon + title ── */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {Icon && (
          <span
            className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[4px]"
            style={{
              background: meta?.tint,
              color: meta?.tintFg,
            }}
          >
            <Icon size={13} strokeWidth={2.4} />
          </span>
        )}
        <h1
          className="truncate text-[15px] font-normal"
          style={{ color: 'var(--text0)' }}
        >
          {resolvedTitle}
        </h1>
      </div>

      {/* ── Right: pass-through actions only (star lives in TopChrome) ── */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
