export type StudioWorkspace = 'edit' | 'creative' | 'effects' | 'color' | 'audio'

export type WorkspaceRightTab = 'tool' | 'ai'

export type WorkspacePresetId =
  | 'custom'
  | 'edit'
  | 'motion'
  | 'timeline'
  | 'review'
  | 'ai'
  | 'audio'

export type WorkspaceLayoutV1 = Readonly<{
  schemaVersion: 'sanverse.workspace-layout/v1'
  activeWorkspace: StudioWorkspace
  leftDockWidthPx: number
  rightDockWidthPx: number
  timelineHeightPx: number
  leftDockCollapsed: boolean
  rightDockCollapsed: boolean
  aiExpanded: boolean
  activeRightTab: WorkspaceRightTab
  preset: WorkspacePresetId
}>

export type WorkspaceViewport = Readonly<{
  width: number
  height: number
}>

export const WORKSPACE_LAYOUT_SCHEMA_VERSION = 'sanverse.workspace-layout/v1' as const
export const WORKSPACE_STORAGE_KEY = 'sanverse.workspace-layout/v1'

export const STUDIO_WORKSPACES: readonly StudioWorkspace[] = Object.freeze([
  'edit',
  'creative',
  'effects',
  'color',
  'audio',
])

export const WORKSPACE_PRESETS: readonly Exclude<WorkspacePresetId, 'custom'>[] = Object.freeze([
  'edit',
  'motion',
  'timeline',
  'review',
  'ai',
  'audio',
])

export const WORKSPACE_RIGHT_TABS: readonly WorkspaceRightTab[] = Object.freeze(['tool', 'ai'])

export const isStudioWorkspace = (value: unknown): value is StudioWorkspace =>
  typeof value === 'string' && STUDIO_WORKSPACES.includes(value as StudioWorkspace)

export const isWorkspacePreset = (value: unknown): value is WorkspacePresetId =>
  value === 'custom' || WORKSPACE_PRESETS.includes(value as Exclude<WorkspacePresetId, 'custom'>)

export const isWorkspaceRightTab = (value: unknown): value is WorkspaceRightTab =>
  typeof value === 'string' && WORKSPACE_RIGHT_TABS.includes(value as WorkspaceRightTab)
