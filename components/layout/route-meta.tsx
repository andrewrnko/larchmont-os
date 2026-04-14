// Shared route registry for the Anytype-style chrome.
// Sidebar and TopChrome both read from here so titles/icons stay in sync.
// Each entry also has an Anytype-style colored square accent used by the
// sidebar's Objects section.

import type { ElementType } from 'react'
import {
  LayoutDashboard, Bot, Moon, TrendingUp, BarChart2, Inbox,
  FolderKanban, FileEdit, Megaphone, ImageIcon, Library, Palette,
  CalendarDays, Film, Mic, Sparkles, Archive, Settings,
  CheckSquare2, CalendarRange,
} from 'lucide-react'

export interface RouteMeta {
  title: string
  icon: ElementType
  /** Background color for the sidebar's colored-square icon container. */
  tint: string
  /** Icon color inside the square. */
  tintFg: string
}

/**
 * Canonical ordered list of navigable Objects.
 * Drives the sidebar Objects section AND the TopChrome back/forward cycling.
 * Change this array to re-order navigation everywhere at once.
 */
export const OBJECT_ROUTES = [
  '/dashboard',
  '/briefing',
  '/inbox',
  '/projects',
  '/tasks',
  '/planner',
  '/briefs',
  '/campaigns',
  '/assets',
  '/resources',
  '/brand',
  '/events',
  '/content',
  '/voice-notes',
  '/creative-studio',
  '/analytics',
  '/debrief',
  '/weekly-review',
] as const

export const ROUTE_META: Record<string, RouteMeta> = {
  '/':                 { title: 'Dashboard',        icon: LayoutDashboard, tint: 'rgba(74,156,245,0.18)',  tintFg: '#4a9cf5' },
  '/dashboard':        { title: 'Dashboard',        icon: LayoutDashboard, tint: 'rgba(74,156,245,0.18)',  tintFg: '#4a9cf5' },
  '/briefing':         { title: 'Assistant',        icon: Bot,             tint: 'rgba(168,85,247,0.18)',  tintFg: '#b47cf5' },
  '/debrief':          { title: 'End of Day',       icon: Moon,            tint: 'rgba(129,140,248,0.18)', tintFg: '#818cf8' },
  '/weekly-review':    { title: 'Weekly Review',    icon: TrendingUp,      tint: 'rgba(167,139,250,0.18)', tintFg: '#a78bfa' },
  '/analytics':        { title: 'Analytics',        icon: BarChart2,       tint: 'rgba(56,189,248,0.18)',  tintFg: '#38bdf8' },
  '/inbox':            { title: 'Inbox',            icon: Inbox,           tint: 'rgba(232,93,58,0.18)',   tintFg: '#e85d3a' },
  '/projects':         { title: 'Projects',         icon: FolderKanban,    tint: 'rgba(82,169,106,0.18)',  tintFg: '#52a96a' },
  '/briefs':           { title: 'Creative Briefs',  icon: FileEdit,        tint: 'rgba(212,162,52,0.18)',  tintFg: '#d4a234' },
  '/campaigns':        { title: 'Campaigns',        icon: Megaphone,       tint: 'rgba(239,104,80,0.18)',  tintFg: '#ef6850' },
  '/assets':           { title: 'Assets',           icon: ImageIcon,       tint: 'rgba(82,169,150,0.18)',  tintFg: '#52a996' },
  '/resources':        { title: 'Resource Library', icon: Library,         tint: 'rgba(147,165,180,0.18)', tintFg: '#93a5b4' },
  '/brand':            { title: 'Brand Identity',   icon: Palette,         tint: 'rgba(236,72,153,0.18)',  tintFg: '#ec4899' },
  '/events':           { title: 'Events & Shoots',  icon: CalendarDays,    tint: 'rgba(212,162,52,0.18)',  tintFg: '#d4a234' },
  '/content':          { title: 'Content Pipeline', icon: Film,            tint: 'rgba(74,156,245,0.18)',  tintFg: '#4a9cf5' },
  '/voice-notes':      { title: 'Voice Notes',      icon: Mic,             tint: 'rgba(250,108,148,0.18)', tintFg: '#fa6c94' },
  '/creative-studio':  { title: 'Creative Studio',  icon: Sparkles,        tint: 'rgba(232,93,58,0.18)',   tintFg: '#e85d3a' },
  '/tasks':            { title: 'Tasks',            icon: CheckSquare2,    tint: 'rgba(82,169,106,0.18)',  tintFg: '#52a96a' },
  '/planner':          { title: 'Planner',          icon: CalendarRange,   tint: 'rgba(129,140,248,0.18)', tintFg: '#818cf8' },
  '/archive':          { title: 'Archive',          icon: Archive,         tint: 'rgba(107,114,128,0.18)', tintFg: '#9ca3af' },
  '/settings':         { title: 'Settings',         icon: Settings,        tint: 'rgba(107,114,128,0.18)', tintFg: '#9ca3af' },
}
