'use client'

import { useMemo } from 'react'
import { format, eachDayOfInterval, subDays } from 'date-fns'
import { cn } from '@/lib/utils'

export interface HeatmapDay {
  date: string // YYYY-MM-DD
  completionRate: number // 0-100
  tasksDone: number
  tasksPlanned: number
  p0Hit: boolean
  energyLevel?: string
}

interface CompletionHeatmapProps {
  data: HeatmapDay[]
  days?: number
}

function getIntensity(rate: number): string {
  if (rate <= 0) return 'bg-[var(--surface-2)]'
  if (rate < 25) return 'bg-emerald-900/70'
  if (rate < 50) return 'bg-emerald-700/80'
  if (rate < 75) return 'bg-emerald-500/80'
  return 'bg-emerald-400'
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['','M','','W','','F','']

export function CompletionHeatmap({ data, days = 90 }: CompletionHeatmapProps) {
  const today = useMemo(() => new Date(), [])
  const start = useMemo(() => subDays(today, days - 1), [today, days])

  const allDays = useMemo(() => eachDayOfInterval({ start, end: today }), [start, today])

  const dataMap = useMemo(() => {
    const m = new Map<string, HeatmapDay>()
    data.forEach((d) => m.set(d.date, d))
    return m
  }, [data])

  // Pad start so first day aligns to its weekday (Mon = 0)
  const startDow = (start.getDay() + 6) % 7 // convert Sun=0 to Mon=0
  const paddedDays: (Date | null)[] = [...Array(startDow).fill(null), ...allDays]

  // Group into columns of 7
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7))
  }

  // Month labels
  const monthLabels: { label: string; col: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const firstReal = week.find((d) => d != null)
    if (firstReal) {
      const m = firstReal.getMonth()
      if (m !== lastMonth) { monthLabels.push({ label: MONTHS[m], col: wi }); lastMonth = m }
    }
  })

  if (data.length === 0) {
    return (
      <div className="flex h-[100px] items-center justify-center rounded-[8px] border border-dashed border-[var(--border)] text-[13px] text-[var(--text-tertiary)]">
        No data yet — complete your first debrief to start tracking
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        {/* Month labels */}
        <div className="mb-1 flex gap-[3px] pl-[22px]">
          {weeks.map((_, wi) => {
            const ml = monthLabels.find((m) => m.col === wi)
            return (
              <div key={wi} className="w-3 text-[11px] text-[var(--text-tertiary)]">
                {ml?.label ?? ''}
              </div>
            )
          })}
        </div>

        <div className="flex gap-[3px]">
          {/* Day labels */}
          <div className="mr-[3px] flex flex-col gap-[3px]">
            {DAYS.map((d, i) => (
              <div key={i} className="flex h-3 items-center text-[11px] text-[var(--text-tertiary)]">{d}</div>
            ))}
          </div>

          {/* Grid */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="h-3 w-3" />
                const dateStr = format(day, 'yyyy-MM-dd')
                const d = dataMap.get(dateStr)
                const isToday = dateStr === format(today, 'yyyy-MM-dd')
                return (
                  <div
                    key={di}
                    title={d
                      ? `${format(day, 'MMM d')} · ${d.tasksDone}/${d.tasksPlanned} tasks · ${d.completionRate}%${d.p0Hit ? ' · P0 ✓' : ''}${d.energyLevel ? ` · ${d.energyLevel}` : ''}`
                      : format(day, 'MMM d')}
                    className={cn(
                      'h-3 w-3 rounded-[2px] cursor-default transition-opacity hover:opacity-80',
                      d ? getIntensity(d.completionRate) : 'bg-[var(--surface-2)]',
                      isToday && 'ring-1 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--background)]'
                    )}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center gap-2 pl-[22px]">
          <span className="text-[11px] text-[var(--text-tertiary)]">Less</span>
          {[0, 25, 50, 75, 100].map((r) => (
            <div key={r} className={cn('h-3 w-3 rounded-[2px]', getIntensity(r))} />
          ))}
          <span className="text-[11px] text-[var(--text-tertiary)]">More</span>
        </div>
      </div>
    </div>
  )
}
