import { cn } from '@/lib/utils'

const PRIORITY_COLORS: Record<string, string> = {
  'P0': 'bg-[#E05050]',
  'P1': 'bg-[#E5923A]',
  'P2': 'bg-[#E5B93A]',
  'P3': 'bg-[var(--text-tertiary)]',
  'Critical': 'bg-[#E05050]',
  'High': 'bg-[#E5923A]',
  'Medium': 'bg-[#E5B93A]',
  'Low': 'bg-[var(--text-tertiary)]',
}

interface PriorityDotProps {
  priority: string
  className?: string
}

export function PriorityDot({ priority, className }: PriorityDotProps) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 flex-shrink-0 rounded-full',
        PRIORITY_COLORS[priority] ?? 'bg-[var(--text-tertiary)]',
        className
      )}
      title={priority}
      aria-label={`Priority: ${priority}`}
    />
  )
}
