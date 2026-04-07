import { cn } from '@/lib/utils'

interface SkeletonProps {
  shape?: 'card' | 'row' | 'text' | 'circle'
  className?: string
  lines?: number
}

function SkeletonBase({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[4px] bg-[var(--surface-2)]',
        className
      )}
    />
  )
}

export function Skeleton({ shape = 'text', className, lines = 3 }: SkeletonProps) {
  if (shape === 'circle') {
    return <SkeletonBase className={cn('h-10 w-10 rounded-full', className)} />
  }

  if (shape === 'row') {
    return (
      <div className={cn('flex items-center gap-3 py-2', className)}>
        <SkeletonBase className="h-2 w-2 rounded-full" />
        <SkeletonBase className="h-4 flex-1" />
        <SkeletonBase className="h-4 w-20" />
        <SkeletonBase className="h-5 w-16 rounded-[4px]" />
      </div>
    )
  }

  if (shape === 'card') {
    return (
      <div
        className={cn(
          'rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3',
          className
        )}
      >
        <SkeletonBase className="h-[120px] w-full rounded-[6px]" />
        <SkeletonBase className="h-4 w-3/4" />
        <SkeletonBase className="h-3 w-1/2" />
        <div className="flex gap-2">
          <SkeletonBase className="h-5 w-16 rounded-[4px]" />
          <SkeletonBase className="h-5 w-20 rounded-[4px]" />
        </div>
      </div>
    )
  }

  // text
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase
          key={i}
          className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}
