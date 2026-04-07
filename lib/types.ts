export type Priority = 'Critical' | 'High' | 'Medium' | 'Low'
export type ProjectStatus = 'Planning' | 'Active' | 'In Review' | 'Complete' | 'Paused' | 'Archived'
export type ProjectCategory = 'Brand' | 'Video' | 'Web' | 'Events' | 'Paid Ads' | 'Print' | 'Ops' | 'Strategy'
export type ClientEntity = 'Larchmont' | 'ScaleGenie' | 'Crosspoint' | 'Other'
export type TaskStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Done' | 'Cancelled'
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type BriefType = 'Video' | 'Brand' | 'Web' | 'Ad Campaign' | 'Event' | 'Print' | 'Copy'
export type BriefStatus = 'Draft' | 'Approved' | 'In Production' | 'Locked'
export type CampaignGoal = 'Awareness' | 'Lead Gen' | 'Conversion' | 'Retention' | 'Brand Equity'
export type CampaignStatus = 'Planned' | 'Active' | 'Paused' | 'Complete'
export type AssetType = 'Logo' | 'Video' | 'Photo' | 'Ad Creative' | 'Copy' | 'Web Design' | 'Print' | 'Audio' | 'Other'
export type AssetStatus = 'Draft' | 'In Review' | 'Final' | 'Archived'
export type ContentFormat = 'Short Form' | 'Long Form' | 'Documentary' | 'Paid Ad' | 'Email' | 'Blog' | 'Podcast'
export type ContentStatus = 'Idea' | 'Scripted' | 'Shot' | 'In Edit' | 'Review' | 'Scheduled' | 'Published' | 'Archived'
export type ResourceCategory = 'Psychology' | 'Brand Strategy' | 'Cinematography' | 'Color' | 'Copy' | 'Design' | 'Business' | 'Legal' | 'Ops'
export type EventType = 'Production Shoot' | 'Brand Event' | 'Community Activation' | 'Client Meeting' | 'Podcast' | 'Trade Show'
export type EventStatus = 'Planned' | 'Confirmed' | 'Prepped' | 'Executing' | 'Wrapped' | 'Archived'
export type InboxStatus = 'New' | 'Processed' | 'Archived'

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  priority: Priority
  category: ProjectCategory
  entity: ClientEntity
  startDate?: string
  deadline?: string
  progress: number
  budget?: number
  notes?: string
  coverImage?: string
  briefIds: string[]
  taskIds: string[]
  assetIds: string[]
  campaignIds: string[]
  resourceIds: string[]
}

export interface Task {
  id: string
  name: string
  projectId: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  estimatedTime?: string
  type: string
  dependencyIds: string[]
  notes?: string
  completedOn?: string
}

export interface CreativeBrief {
  id: string
  name: string
  projectId: string
  type: BriefType
  status: BriefStatus
  objective?: string
  targetAudience?: string
  tone: string[]
  lensNotes?: string
  colorGradeDirection?: string
  copyDirection?: string
  deliverables?: string
  approvalDate?: string
  moodBoardImages: { url: string; caption: string }[]
  shots: {
    id: string
    shotNumber: number
    imageUrl?: string
    lens?: string
    frame?: string
    movement?: string
    light?: string
    gradeTarget?: string
    emotionalIntent?: string
  }[]
  resourceIds: string[]
}

export interface Campaign {
  id: string
  name: string
  goal: CampaignGoal
  status: CampaignStatus
  startDate?: string
  endDate?: string
  budget?: number
  channels: string[]
  projectIds: string[]
  kpis?: string
  targetAudience?: string
  results?: string
}

export interface Asset {
  id: string
  name: string
  type: AssetType
  projectId?: string
  campaignId?: string
  status: AssetStatus
  fileUrl?: string
  thumbnailUrl?: string
  format?: string
  version: number
  notes?: string
  createdOn: string
}

export interface ResourceItem {
  id: string
  name: string
  category: ResourceCategory
  type: string
  sourceUrl?: string
  summary?: string
  tags: string[]
  linkedProjectIds: string[]
  linkedBriefIds: string[]
  addedOn: string
}

export interface EventRecord {
  id: string
  name: string
  type: EventType
  projectId?: string
  dateTime: string
  location?: string
  status: EventStatus
  callTime?: string
  crew?: string
  deliverablesExpected?: string
  contingencyNotes?: string
  postNotes?: string
}

export interface ContentItem {
  id: string
  title: string
  format: ContentFormat
  platforms: string[]
  status: ContentStatus
  projectId?: string
  campaignId?: string
  briefId?: string
  assetId?: string
  shootDate?: string
  publishDate?: string
  hook?: string
  cta?: string
  performanceNotes?: string
}

export interface InboxItem {
  id: string
  text: string
  capturedOn: string
  type?: string
  status: InboxStatus
  assignedProjectId?: string
}
