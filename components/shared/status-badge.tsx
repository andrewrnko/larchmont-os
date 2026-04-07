'use client'

import { cn } from '@/lib/utils'

const COLOR_MAP: Record<string, string> = {
  gray: 'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]',
  blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
  green: 'bg-green-500/10 text-green-400 border border-green-500/20',
  neutral: 'bg-[var(--surface-2)] text-[var(--text-tertiary)] border border-[var(--border)]',
  red: 'bg-red-500/10 text-red-400 border border-red-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
}

const STATUS_TO_COLOR: Record<string, string> = {
  'Planning': 'gray',
  'Draft': 'gray',
  'Idea': 'gray',
  'Not Started': 'gray',
  'Planned': 'gray',
  'Active': 'blue',
  'Approved': 'blue',
  'In Production': 'blue',
  'Scripted': 'blue',
  'Shot': 'blue',
  'Confirmed': 'blue',
  'In Progress': 'blue',
  'Prepped': 'blue',
  'In Review': 'yellow',
  'In Edit': 'yellow',
  'Review': 'yellow',
  'Executing': 'yellow',
  'Scheduled': 'yellow',
  'Complete': 'green',
  'Final': 'green',
  'Published': 'green',
  'Wrapped': 'green',
  'Done': 'green',
  'Locked': 'green',
  'Paused': 'neutral',
  'Blocked': 'neutral',
  'Archived': 'neutral',
  'Cancelled': 'neutral',
  'Critical': 'red',
  'P0': 'red',
  'P1': 'orange',
  'P2': 'yellow',
  'P3': 'gray',
}

interface StatusBadgeProps {
  status: string
  className?: string
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const color = STATUS_TO_COLOR[status] ?? 'gray'
  const colorClass = COLOR_MAP[color] ?? COLOR_MAP.gray

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] font-medium',
        size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-[12px] px-2 py-0.5',
        colorClass,
        className
      )}
    >
      {status}
    </span>
  )
}
