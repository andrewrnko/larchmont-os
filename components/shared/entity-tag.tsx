import { cn } from '@/lib/utils'
import type { ClientEntity } from '@/lib/types'

const ENTITY_STYLES: Record<ClientEntity, string> = {
  'Larchmont': 'bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]/30',
  'ScaleGenie': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Crosspoint': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Other': 'bg-[var(--surface-2)] text-[var(--text-tertiary)] border-[var(--border)]',
}

interface EntityTagProps {
  entity: ClientEntity
  className?: string
}

export function EntityTag({ entity, className }: EntityTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[11px] font-medium',
        ENTITY_STYLES[entity],
        className
      )}
    >
      {entity}
    </span>
  )
}
