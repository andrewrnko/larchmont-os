'use client'

import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: LucideIcon
  trend?: { direction: 'up' | 'down' | 'neutral'; label: string }
  children?: React.ReactNode
  className?: string
  onClick?: () => void
}

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  children,
  className,
  onClick,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'group rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4',
        'transition-all duration-150',
        onClick && 'cursor-pointer hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-1.5">
            {Icon && (
              <Icon className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
            )}
            <span className="text-[12px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              {label}
            </span>
          </div>
          <div className="text-[24px] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
            {value}
          </div>
          {subtext && (
            <div className="mt-1 text-[13px] text-[var(--text-secondary)]">{subtext}</div>
          )}
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
