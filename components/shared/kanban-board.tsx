'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KanbanItem {
  id: string
  status: string
}

export interface KanbanBoardProps<T extends KanbanItem> {
  items: T[]
  columns: readonly string[]
  onStatusChange: (itemId: string, newStatus: string) => Promise<void>
  renderCard: (item: T) => React.ReactNode
  renderOverlay?: (item: T) => React.ReactNode
  renderColumnHeader?: (column: string, count: number) => React.ReactNode
  renderColumnFooter?: (column: string) => React.ReactNode
  getColumnBorderClass?: (column: string) => string
  columnWidth?: string
}

// ── Sortable wrapper — wraps each card with dnd-kit drag handles ──────────────

function SortableWrapper({
  id,
  isActiveItem,
  children,
}: {
  id: string
  isActiveItem: boolean
  children: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  )
}

// ── Droppable column ──────────────────────────────────────────────────────────

function KanbanColumn<T extends KanbanItem>({
  column,
  items,
  renderCard,
  renderColumnHeader,
  renderColumnFooter,
  getColumnBorderClass,
  columnWidth,
}: {
  column: string
  items: T[]
  renderCard: (item: T) => React.ReactNode
  renderColumnHeader?: (column: string, count: number) => React.ReactNode
  renderColumnFooter?: (column: string) => React.ReactNode
  getColumnBorderClass?: (column: string) => string
  columnWidth: string
  activeItemId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column })
  const borderClass = getColumnBorderClass?.(column) ?? 'border-[var(--border)]'

  return (
    <div className={`flex-shrink-0 flex flex-col ${columnWidth} min-h-[400px]`}>
      {/* Column header */}
      {renderColumnHeader ? (
        renderColumnHeader(column, items.length)
      ) : (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--text-primary)]">{column}</span>
          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">
            {items.length}
          </span>
        </div>
      )}

      {/* Drop zone — covers full column including empty space */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[360px] rounded-[8px] border p-2 transition-colors duration-150',
          isOver
            ? 'border-[var(--accent)]/60 bg-[var(--accent-muted)]'
            : `border-dashed ${borderClass} bg-transparent`
        )}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((item) => (
              <SortableWrapper key={item.id} id={item.id} isActiveItem={false}>
                {renderCard(item)}
              </SortableWrapper>
            ))}
          </div>
        </SortableContext>

        {/* Column footer (e.g. "Add task" button) */}
        {renderColumnFooter && (
          <div className="mt-2">{renderColumnFooter(column)}</div>
        )}
      </div>
    </div>
  )
}

// ── Main KanbanBoard component ────────────────────────────────────────────────

export function KanbanBoard<T extends KanbanItem>({
  items,
  columns,
  onStatusChange,
  renderCard,
  renderOverlay,
  renderColumnHeader,
  renderColumnFooter,
  getColumnBorderClass,
  columnWidth = 'w-[260px]',
}: KanbanBoardProps<T>) {
  const [activeItem, setActiveItem] = useState<T | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (e: DragStartEvent) => {
    const item = items.find((i) => i.id === e.active.id)
    if (item) setActiveItem(item)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    setActiveItem(null)
    if (!over) return

    const itemId = active.id as string
    const overId = over.id as string

    // over.id is either a column name or another item's id
    let newStatus: string
    if (columns.includes(overId)) {
      newStatus = overId
    } else {
      const overItem = items.find((i) => i.id === overId)
      if (!overItem) return
      newStatus = overItem.status
    }

    const item = items.find((i) => i.id === itemId)
    if (!item || item.status === newStatus) return

    await onStatusChange(itemId, newStatus)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column}
            column={column}
            items={items.filter((i) => i.status === column)}
            renderCard={renderCard}
            renderColumnHeader={renderColumnHeader}
            renderColumnFooter={renderColumnFooter}
            getColumnBorderClass={getColumnBorderClass}
            columnWidth={columnWidth}
            activeItemId={activeItem?.id ?? null}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem && (
          <div className="rotate-1 shadow-xl cursor-grabbing opacity-95">
            {renderOverlay ? renderOverlay(activeItem) : renderCard(activeItem)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
