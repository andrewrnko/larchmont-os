import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
  color?: 'accent' | 'blue' | 'green'
}

export function ProgressBar({
  value,
  max = 100,
  className,
  showLabel = false,
  color = 'accent',
}: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100)

  const trackColor = {
    accent: 'bg-[var(--accent)]',
    blue: 'bg-blue-400',
    green: 'bg-green-400',
  }[color]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', trackColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums w-8 text-right">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  )
}
