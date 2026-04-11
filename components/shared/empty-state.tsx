import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  heading: string
  subtext: string
  cta?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, heading, subtext, cta, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-8 text-center',
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)]">
        <Icon className="h-5 w-5 text-[var(--text-tertiary)]" />
      </div>
      <h3 className="mb-1 text-[16px] font-medium text-[var(--text-primary)]">{heading}</h3>
      <p className="mb-4 max-w-xs text-[13px] text-[var(--text-secondary)] leading-relaxed">{subtext}</p>
      {cta}
    </div>
  )
}
