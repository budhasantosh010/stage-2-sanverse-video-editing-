import {
  WORKSPACE_LAYOUT_SCHEMA_VERSION,
  WORKSPACE_STORAGE_KEY,
  isStudioWorkspace,
  isWorkspacePreset,
  isWorkspaceRightTab,
  type WorkspaceLayoutV1,
  type WorkspaceViewport,
} from './workspace-contract'
import { clampWorkspaceLayout, defaultWorkspaceLayout } from './workspace-layout'

type WorkspaceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const EXPECTED_KEYS = Object.freeze([
  'schemaVersion',
  'activeWorkspace',
  'leftDockWidthPx',
  'rightDockWidthPx',
  'timelineHeightPx',
  'leftDockCollapsed',
  'rightDockCollapsed',
  'aiExpanded',
  'activeRightTab',
  'preset',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const validateWorkspaceLayout = (value: unknown): WorkspaceLayoutV1 | null => {
  if (!isRecord(value)) return null
  const keys = Object.keys(value)
  if (keys.length !== EXPECTED_KEYS.length || keys.some((key) => !EXPECTED_KEYS.includes(key))) return null
  if (value.schemaVersion !== WORKSPACE_LAYOUT_SCHEMA_VERSION) return null
  if (!isStudioWorkspace(value.activeWorkspace)) return null
  if (!isWorkspaceRightTab(value.activeRightTab)) return null
  if (!isWorkspacePreset(value.preset)) return null
  for (const key of ['leftDockWidthPx', 'rightDockWidthPx', 'timelineHeightPx'] as const) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0) return null
  }
  for (const key of ['leftDockCollapsed', 'rightDockCollapsed', 'aiExpanded'] as const) {
    if (typeof value[key] !== 'boolean') return null
  }
  return Object.freeze(value as WorkspaceLayoutV1)
}

export const loadWorkspaceLayout = (
  storage: WorkspaceStorage | null,
  viewport: WorkspaceViewport,
): WorkspaceLayoutV1 => {
  if (!storage) return clampWorkspaceLayout(defaultWorkspaceLayout(), viewport)
  try {
    const raw = storage.getItem(WORKSPACE_STORAGE_KEY)
    if (!raw) return clampWorkspaceLayout(defaultWorkspaceLayout(), viewport)
    const validated = validateWorkspaceLayout(JSON.parse(raw))
    if (!validated) return clampWorkspaceLayout(defaultWorkspaceLayout(), viewport)
    return clampWorkspaceLayout(validated, viewport)
  } catch {
    return clampWorkspaceLayout(defaultWorkspaceLayout(), viewport)
  }
}

export const saveWorkspaceLayout = (storage: WorkspaceStorage | null, layout: WorkspaceLayoutV1): boolean => {
  if (!storage) return false
  const validated = validateWorkspaceLayout(layout)
  if (!validated) return false
  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(validated))
    return true
  } catch {
    return false
  }
}

export const clearWorkspaceLayout = (storage: WorkspaceStorage | null): void => {
  try {
    storage?.removeItem(WORKSPACE_STORAGE_KEY)
  } catch {
    // Local preference cleanup must never break the editor.
  }
}
