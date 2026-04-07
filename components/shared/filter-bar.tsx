'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterOption {
  label: string
  value: string
  count?: number
}

interface FilterBarProps {
  filters: FilterOption[]
  active: string[]
  onToggle: (value: string) => void
  onClear: () => void
  className?: string
}

export function FilterBar({ filters, active, onToggle, onClear, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {filters.map((f) => {
        const isActive = active.includes(f.value)
        return (
          <button
            key={f.value}
            onClick={() => onToggle(f.value)}
            className={cn(
              'inline-flex items-center gap-1 rounded-[6px] border px-2.5 py-1 text-[12px] font-medium transition-all duration-150',
              isActive
                ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
            )}
          >
            {f.label}
            {f.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1 text-[10px]',
                  isActive ? 'bg-[var(--accent)] text-[var(--accent-fg)]' : 'bg-[var(--surface-2)] text-[var(--text-tertiary)]'
                )}
              >
                {f.count}
              </span>
            )}
          </button>
        )
      })}
      {active.length > 0 && (
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  )
}
