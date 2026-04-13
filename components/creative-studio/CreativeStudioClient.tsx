// Top-level client wrapper: hydrates stores, lays out planner + sidebar + canvas.
// Manages toolbar auto-hide when planner panels are expanded.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasStore, usePlannerStore } from './store'
import { Canvas } from './Canvas'
import { Toolbar, type ToolId } from './Toolbar'
import { BoardPopover } from './BoardPopover'
import { DayHyperplanner } from './DayHyperplanner'
import { DailyRepeatables } from './DailyRepeatables'
import { FocusOverlay } from './FocusOverlay'
import { SubpageEditor } from './SubpageEditor'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const LS_TOOLBAR = 'cs:toolbar-visible'

function loadBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? raw === 'true' : fallback
  } catch { return fallback }
}

export function CreativeStudioClient() {
  const hydrate = useCanvasStore((s) => s.hydrate)
  const hydrated = useCanvasStore((s) => s.hydrated)
  const hydratePlanner = usePlannerStore((s) => s.hydrate)
  const plannerHydrated = usePlannerStore((s) => s.hydrated)
  const boards = useCanvasStore((s) => s.boards)
  const createBoard = useCanvasStore((s) => s.createBoard)

  const [tool, setTool] = useState<ToolId>('select')

  // ── Toolbar visibility ──
  const [toolbarVisible, setToolbarVisible] = useState(() => loadBool(LS_TOOLBAR, true))
  const [dayExpanded, setDayExpanded] = useState(true) // DayHyperplanner starts expanded
  const [repeatExpanded, setRepeatExpanded] = useState(false) // DailyRepeatables starts collapsed
  const plannerExpanded = dayExpanded || repeatExpanded

  // Track previous planner state to detect changes (skip initial render)
  const prevPlannerRef = useRef(plannerExpanded)
  const initialRender = useRef(true)

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false
      return
    }
    if (prevPlannerRef.current !== plannerExpanded) {
      prevPlannerRef.current = plannerExpanded
      setToolbarVisible(!plannerExpanded)
    }
  }, [plannerExpanded])

  const toggleToolbar = useCallback(() => {
    setToolbarVisible((v) => {
      const next = !v
      try { localStorage.setItem(LS_TOOLBAR, String(next)) } catch {}
      return next
    })
  }, [])

  const onDayExpandedChange = useCallback((expanded: boolean) => setDayExpanded(expanded), [])
  const onRepeatExpandedChange = useCallback((expanded: boolean) => setRepeatExpanded(expanded), [])

  useEffect(() => {
    hydrate()
    hydratePlanner()
  }, [hydrate, hydratePlanner])

  if (!hydrated || !plannerHydrated) {
    return (
      <div className="cs-anytype flex h-full w-full items-center justify-center text-[13px]"
           style={{ color: 'var(--cs-text2)' }}>
        Loading Creative Studio…
      </div>
    )
  }

  if (boards.length === 0) {
    return (
      <div className="cs-anytype flex h-full w-full items-center justify-center">
        <div className="rounded-[6px] border p-10 text-center"
             style={{ borderColor: 'var(--cs-border)', background: 'var(--cs-bg2)' }}>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.08em]"
               style={{ color: 'var(--cs-text3)' }}>Creative Studio</div>
          <h2 className="mt-3 text-[20px] font-normal"
              style={{ color: 'var(--cs-text0)' }}>Nothing here yet</h2>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--cs-text2)' }}>
            Create your first board to get started.
          </p>
          <button
            onClick={() => createBoard('My First Board', '🎬')}
            className="mt-5 rounded-[4px] border px-3 py-1.5 text-[13px] transition-colors duration-100 hover:bg-[color:var(--cs-bg4)]"
            style={{
              borderColor: 'var(--cs-border2)',
              background: 'var(--cs-bg3)',
              color: 'var(--cs-text1)',
            }}
          >
            New board →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cs-anytype flex h-full w-full flex-col overflow-hidden">
      <DayHyperplanner onExpandedChange={onDayExpandedChange} />
      <DailyRepeatables onExpandedChange={onRepeatExpandedChange} />
      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <Canvas tool={tool} setTool={setTool} />
          <BoardPopover />
          <Toolbar active={tool} setActive={setTool} hidden={!toolbarVisible} />
          <SubpageEditor />

          {/* Toggle tab — thin pill at left edge, always accessible */}
          <button
            onClick={toggleToolbar}
            className="absolute left-0 top-1/2 z-[31] flex h-12 w-5 items-center justify-center rounded-r-md border-y border-r backdrop-blur"
            style={{
              transform: 'translateY(-50%)',
              background: 'color-mix(in srgb, var(--bg2) 90%, transparent)',
              borderColor: 'var(--border)',
              color: 'var(--text2)',
              transition: 'color 150ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text0)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text2)')}
            title={toolbarVisible ? 'Hide toolbar' : 'Show toolbar'}
          >
            {toolbarVisible ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>
      </div>
      <FocusOverlay />
    </div>
  )
}
