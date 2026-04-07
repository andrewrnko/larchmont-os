'use client'

import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ViewOption<T extends string> {
  value: T
  label: string
  icon: LucideIcon
}

interface ViewSwitcherProps<T extends string> {
  options: ViewOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}

export function ViewSwitcher<T extends string>({
  options,
  value,
  onChange,
  className,
}: ViewSwitcherProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-0.5',
        className
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150',
              active
                ? 'bg-[var(--surface-2)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
