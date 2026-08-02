import type { WorkspaceLayoutV1, WorkspaceViewport } from '../workspace'
import { defaultStudioLayoutV2 } from './studio-layout-defaults'
import { normalizeGroup, type StudioLayoutV2State } from './studio-layout-contract'

const finitePositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

export const migrateWorkspaceLayoutV1 = (value: WorkspaceLayoutV1, viewport: WorkspaceViewport): StudioLayoutV2State => {
  if (!finitePositive(value.leftDockWidthPx) || !finitePositive(value.rightDockWidthPx) || !finitePositive(value.timelineHeightPx)) return defaultStudioLayoutV2()
  const width = Math.max(960, viewport.width)
  const height = Math.max(640, viewport.height - 112)
  const ai = value.aiExpanded ? Math.min(35, Math.max(20, value.rightDockWidthPx / width * 100)) : 4
  const media = value.leftDockCollapsed ? 8 : Math.min(32, Math.max(14, value.leftDockWidthPx / width * 100))
  const tool = value.rightDockCollapsed ? 8 : Math.min(38, Math.max(22, value.rightDockWidthPx / width * 100))
  const timeline = Math.min(65, Math.max(28, value.timelineHeightPx / height * 100))
  return Object.freeze({
    ...defaultStudioLayoutV2(),
    rootLayout: normalizeGroup([ai, 100 - ai] as const),
    mainVerticalLayout: normalizeGroup([100 - timeline, timeline] as const),
    upperLayout: normalizeGroup([media, Math.max(20, 100 - media - tool), tool] as const),
    aiMode: value.aiExpanded ? 'expanded' : 'collapsed',
    mediaCollapsed: value.leftDockCollapsed,
    toolCollapsed: value.rightDockCollapsed,
    activeWorkspace: value.activeWorkspace,
    preset: value.preset,
  })
}
