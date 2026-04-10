// Top-level client wrapper: hydrates stores, lays out planner + sidebar + canvas.

'use client'

import { useEffect, useState } from 'react'
import { useCanvasStore, usePlannerStore } from './store'
import { Canvas } from './Canvas'
import { Toolbar, type ToolId } from './Toolbar'
import { BoardSidebar } from './BoardSidebar'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    hydrate()
    hydratePlanner()
  }, [hydrate, hydratePlanner])

  if (!hydrated || !plannerHydrated) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[13px] text-neutral-500">
        Loading Creative Studio…
      </div>
    )
  }

  if (boards.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="rounded-lg border border-[#2a2a2a] bg-[#141414] p-8 text-center">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-amber-500">Creative Studio</div>
          <h2 className="mt-2 text-[17px] font-semibold text-white">Nothing here yet</h2>
          <button
            onClick={() => createBoard('My First Board', '🎬')}
            className="mt-4 rounded bg-amber-500 px-4 py-2 text-[13px] font-medium text-black hover:bg-amber-400"
          >
            Create your first board →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0a0a0a]">
      <DayHyperplanner />
      <DailyRepeatables />
      <div className="relative flex flex-1 overflow-hidden">
        <BoardSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
        <div className="relative flex-1">
          <Canvas tool={tool} setTool={setTool} />
          <Toolbar active={tool} setActive={setTool} />
          <SubpageEditor />
        </div>
      </div>
      <FocusOverlay />
    </div>
  )
}
