// Daily Repeatables types

export type TimeSlot = 'morning' | 'midday' | 'evening'

export interface RepeatableItem {
  id: string
  title: string
  category?: string
  timeSlot: TimeSlot
  order: number
  streak: number
  createdAt: number
}

export interface RepeatableCheck {
  itemId: string
  date: string // YYYY-MM-DD
  checked: boolean
}

export interface RepeatableDayLog {
  date: string
  totalItems: number
  completedItems: number
  streaks: Record<string, number> // itemId → streak at that date
}
