import {
  WORKSPACE_LAYOUT_SCHEMA_VERSION,
  type WorkspaceLayoutV1,
  type WorkspacePresetId,
  type WorkspaceViewport,
} from './workspace-contract'
import { clampWorkspaceLayout, defaultWorkspaceLayout } from './workspace-layout'

const presetLayout = (preset: Exclude<WorkspacePresetId, 'custom'>): WorkspaceLayoutV1 => {
  const base = defaultWorkspaceLayout()
  if (preset === 'motion') return Object.freeze({ ...base, preset, leftDockCollapsed: true, rightDockWidthPx: 380, timelineHeightPx: 320 })
  if (preset === 'timeline') return Object.freeze({ ...base, preset, leftDockCollapsed: true, rightDockCollapsed: true, timelineHeightPx: 560 })
  if (preset === 'review') return Object.freeze({ ...base, preset, leftDockCollapsed: true, rightDockCollapsed: true, timelineHeightPx: 240 })
  if (preset === 'ai') return Object.freeze({ ...base, preset, leftDockCollapsed: true, rightDockWidthPx: 420, activeRightTab: 'ai', aiExpanded: true, timelineHeightPx: 320 })
  if (preset === 'audio') return Object.freeze({ ...base, preset, activeWorkspace: 'audio', leftDockWidthPx: 240, rightDockWidthPx: 340, timelineHeightPx: 500 })
  return Object.freeze({ ...base, preset: 'edit' })
}

export const applyWorkspacePreset = (
  preset: Exclude<WorkspacePresetId, 'custom'>,
  viewport: WorkspaceViewport,
): WorkspaceLayoutV1 => clampWorkspaceLayout(Object.freeze({
  ...presetLayout(preset),
  schemaVersion: WORKSPACE_LAYOUT_SCHEMA_VERSION,
}), viewport)

export const resetWorkspaceLayout = (viewport: WorkspaceViewport): WorkspaceLayoutV1 =>
  applyWorkspacePreset('edit', viewport)
