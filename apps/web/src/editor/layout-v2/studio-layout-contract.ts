import type { StudioWorkspace, WorkspacePresetId } from '../workspace'

export const STUDIO_LAYOUT_V2_SCHEMA = 'sanverse.studio-layout/v2' as const

export type StudioAiMode = 'collapsed' | 'expanded' | 'overlay'
export type StudioLayoutV2State = Readonly<{
  schemaVersion: typeof STUDIO_LAYOUT_V2_SCHEMA
  rootLayout: readonly [number, number]
  mainVerticalLayout: readonly [number, number]
  upperLayout: readonly [number, number, number]
  aiMode: StudioAiMode
  mediaCollapsed: boolean
  toolCollapsed: boolean
  activeWorkspace: StudioWorkspace
  preset: WorkspacePresetId
}>

const KEYS = Object.freeze([
  'schemaVersion', 'rootLayout', 'mainVerticalLayout', 'upperLayout', 'aiMode',
  'mediaCollapsed', 'toolCollapsed', 'activeWorkspace', 'preset',
])
const WORKSPACES = new Set(['edit', 'creative', 'effects', 'color', 'audio'])
const PRESETS = new Set(['custom', 'edit', 'motion', 'timeline', 'review', 'ai', 'audio'])
const AI_MODES = new Set(['collapsed', 'expanded', 'overlay'])

const validGroup = (value: unknown, length: number): value is readonly number[] =>
  Array.isArray(value)
  && value.length === length
  && value.every((item) => typeof item === 'number' && Number.isFinite(item) && item > 0)
  && Math.abs(value.reduce((sum, item) => sum + item, 0) - 100) < 0.01

export const validateStudioLayoutV2 = (value: unknown): StudioLayoutV2State | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length !== KEYS.length || keys.some((key) => !KEYS.includes(key))) return null
  if (record.schemaVersion !== STUDIO_LAYOUT_V2_SCHEMA) return null
  if (!validGroup(record.rootLayout, 2) || !validGroup(record.mainVerticalLayout, 2) || !validGroup(record.upperLayout, 3)) return null
  if (!AI_MODES.has(record.aiMode as string)) return null
  if (typeof record.mediaCollapsed !== 'boolean' || typeof record.toolCollapsed !== 'boolean') return null
  if (!WORKSPACES.has(record.activeWorkspace as string) || !PRESETS.has(record.preset as string)) return null
  return Object.freeze(record as unknown as StudioLayoutV2State)
}

export const normalizeGroup = <T extends readonly number[]>(values: T): T => {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (!Number.isFinite(total) || total <= 0) return values
  return Object.freeze(values.map((value) => (value / total) * 100)) as unknown as T
}
