// Top-level client wrapper: hydrates stores, lays out planner + sidebar + canvas.

'use client'

import { useEffect, useState } from 'react'
import { useCanvasStore, usePlannerStore } from './store'
import { Canvas } from './Canvas'
import { Toolbar, type ToolId } from './Toolbar'
import { BoardPopover } from './BoardPopover'
import { DayHyperplanner } from './DayHyperplanner'
import { DailyRepeatables } from './DailyRepeatables'
import { FocusOverlay } from './FocusOverlay'
import { SubpageEditor } from './SubpageEditor'

export function CreativeStudioClient() {
  const hydrate = useCanvasStore((s) => s.hydrate)
  const hydrated = useCanvasStore((s) => s.hydrated)
  const hydratePlanner = usePlannerStore((s) => s.hydrate)
  const plannerHydrated = usePlannerStore((s) => s.hydrated)
  const boards = useCanvasStore((s) => s.boards)
  const createBoard = useCanvasStore((s) => s.createBoard)

  const [tool, setTool] = useState<ToolId>('select')

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
      <DayHyperplanner />
      <DailyRepeatables />
      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <Canvas tool={tool} setTool={setTool} />
          <BoardPopover />
          <Toolbar active={tool} setActive={setTool} />
          <SubpageEditor />
        </div>
      </div>
      <FocusOverlay />
    </div>
  )
}
