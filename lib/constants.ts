export const STATUS_COLORS: Record<string, string> = {
  'Planning': 'gray',
  'Draft': 'gray',
  'Idea': 'gray',
  'Not Started': 'gray',
  'Active': 'blue',
  'Approved': 'blue',
  'In Production': 'blue',
  'Scripted': 'blue',
  'Shot': 'blue',
  'Confirmed': 'blue',
  'In Progress': 'blue',
  'Prepped': 'blue',
  'In Review': 'yellow',
  'In Edit': 'yellow',
  'Review': 'yellow',
  'Executing': 'yellow',
  'Scheduled': 'yellow',
  'Complete': 'green',
  'Final': 'green',
  'Published': 'green',
  'Wrapped': 'green',
  'Done': 'green',
  'Locked': 'green',
  'Planned': 'gray',
  'Paused': 'neutral',
  'Blocked': 'neutral',
  'Archived': 'neutral',
  'Cancelled': 'neutral',
  'Critical': 'red',
  'P0': 'red',
  'P1': 'orange',
  'P2': 'yellow',
  'P3': 'gray',
}

export const PRIORITY_COLORS: Record<string, string> = {
  'P0': '#E05050',
  'P1': '#E5923A',
  'P2': '#E5B93A',
  'P3': '#6B6B68',
  'Critical': '#E05050',
  'High': '#E5923A',
  'Medium': '#E5B93A',
  'Low': '#6B6B68',
}

export const CATEGORY_ICONS: Record<string, string> = {
  'Brand': 'Palette',
  'Video': 'Video',
  'Web': 'Globe',
  'Events': 'Calendar',
  'Paid Ads': 'Megaphone',
  'Print': 'FileText',
  'Ops': 'Settings',
  'Strategy': 'BarChart2',
}

export const CONTENT_STAGES: Array<{ status: string; color: string }> = [
  { status: 'Idea', color: 'gray' },
  { status: 'Scripted', color: 'blue' },
  { status: 'Shot', color: 'blue' },
  { status: 'In Edit', color: 'yellow' },
  { status: 'Review', color: 'yellow' },
  { status: 'Scheduled', color: 'yellow' },
  { status: 'Published', color: 'green' },
]

export const BRIEF_TYPES = ['Video', 'Brand', 'Web', 'Ad Campaign', 'Event', 'Print', 'Copy'] as const

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/inbox', label: 'Inbox', icon: 'Inbox', badge: true },
  { href: '/projects', label: 'Projects', icon: 'FolderKanban' },
  { href: '/tasks', label: 'Tasks', icon: 'CheckSquare' },
  { href: '/briefs', label: 'Creative Briefs', icon: 'FileEdit' },
  { href: '/campaigns', label: 'Campaigns', icon: 'Megaphone' },
  { href: '/assets', label: 'Assets', icon: 'ImageIcon' },
  { href: '/resources', label: 'Resource Library', icon: 'Library' },
  { href: '/brand', label: 'Brand Identity', icon: 'Palette' },
  { href: '/events', label: 'Events & Shoots', icon: 'CalendarDays' },
  { href: '/content', label: 'Content Pipeline', icon: 'Film' },
] as const

export const ENTITY_COLORS: Record<string, string> = {
  'Larchmont': 'var(--accent)',
  'ScaleGenie': '#3B82F6',
  'Crosspoint': '#8B5CF6',
  'Other': 'var(--text-tertiary)',
}
