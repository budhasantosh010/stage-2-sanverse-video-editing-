import {
  WORKSPACE_LAYOUT_SCHEMA_VERSION,
  type WorkspaceLayoutV1,
  type WorkspaceViewport,
} from './workspace-contract'

export const WORKSPACE_CONSTRAINTS = Object.freeze({
  leftDockMinPx: 200,
  leftDockMaxPx: 420,
  rightDockMinPx: 280,
  rightDockMaxPx: 520,
  previewMinPx: 480,
  timelineMinPx: 240,
  timelineMaxViewportRatio: 0.65,
  splitterPx: 12,
  pagePaddingPx: 32,
})

const finite = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum))

export const defaultWorkspaceLayout = (): WorkspaceLayoutV1 => Object.freeze({
  schemaVersion: WORKSPACE_LAYOUT_SCHEMA_VERSION,
  activeWorkspace: 'edit',
  leftDockWidthPx: 220,
  rightDockWidthPx: 320,
  timelineHeightPx: 390,
  leftDockCollapsed: false,
  rightDockCollapsed: false,
  aiExpanded: false,
  activeRightTab: 'tool',
  preset: 'edit',
})

export const workspaceTimelineMaximum = (viewport: WorkspaceViewport): number =>
  Math.max(
    WORKSPACE_CONSTRAINTS.timelineMinPx,
    Math.floor(Math.max(0, finite(viewport.height, 900) - 112) * WORKSPACE_CONSTRAINTS.timelineMaxViewportRatio),
  )

export const clampWorkspaceLayout = (
  input: WorkspaceLayoutV1,
  viewport: WorkspaceViewport,
): WorkspaceLayoutV1 => {
  const defaults = defaultWorkspaceLayout()
  const width = Math.max(0, finite(viewport.width, 1440))
  const height = Math.max(0, finite(viewport.height, 900))
  const compact = width < 1100
  const available = Math.max(0, width - WORKSPACE_CONSTRAINTS.pagePaddingPx)

  let leftCollapsed = Boolean(input.leftDockCollapsed)
  let rightCollapsed = Boolean(input.rightDockCollapsed)
  if (compact) {
    leftCollapsed = true
    rightCollapsed = true
  } else {
    const requestedSideWidth =
      (leftCollapsed ? 0 : finite(input.leftDockWidthPx, defaults.leftDockWidthPx)) +
      (rightCollapsed ? 0 : finite(input.rightDockWidthPx, defaults.rightDockWidthPx)) +
      (leftCollapsed ? 0 : WORKSPACE_CONSTRAINTS.splitterPx) +
      (rightCollapsed ? 0 : WORKSPACE_CONSTRAINTS.splitterPx)
    if (available - requestedSideWidth < WORKSPACE_CONSTRAINTS.previewMinPx) {
      leftCollapsed = true
    }
    const withoutLeft =
      (rightCollapsed ? 0 : finite(input.rightDockWidthPx, defaults.rightDockWidthPx)) +
      (rightCollapsed ? 0 : WORKSPACE_CONSTRAINTS.splitterPx)
    if (available - withoutLeft < WORKSPACE_CONSTRAINTS.previewMinPx) {
      rightCollapsed = true
    }
  }

  const maximumLeft = Math.min(
    WORKSPACE_CONSTRAINTS.leftDockMaxPx,
    Math.max(WORKSPACE_CONSTRAINTS.leftDockMinPx, available - WORKSPACE_CONSTRAINTS.previewMinPx - WORKSPACE_CONSTRAINTS.rightDockMinPx - WORKSPACE_CONSTRAINTS.splitterPx * 2),
  )
  const maximumRight = Math.min(
    WORKSPACE_CONSTRAINTS.rightDockMaxPx,
    Math.max(WORKSPACE_CONSTRAINTS.rightDockMinPx, available - WORKSPACE_CONSTRAINTS.previewMinPx - WORKSPACE_CONSTRAINTS.leftDockMinPx - WORKSPACE_CONSTRAINTS.splitterPx * 2),
  )

  return Object.freeze({
    ...input,
    leftDockWidthPx: clamp(finite(input.leftDockWidthPx, defaults.leftDockWidthPx), WORKSPACE_CONSTRAINTS.leftDockMinPx, maximumLeft),
    rightDockWidthPx: clamp(finite(input.rightDockWidthPx, defaults.rightDockWidthPx), WORKSPACE_CONSTRAINTS.rightDockMinPx, maximumRight),
    timelineHeightPx: clamp(finite(input.timelineHeightPx, defaults.timelineHeightPx), WORKSPACE_CONSTRAINTS.timelineMinPx, workspaceTimelineMaximum({ width, height })),
    leftDockCollapsed: leftCollapsed,
    rightDockCollapsed: rightCollapsed,
  })
}

export const withCustomWorkspaceLayout = (
  layout: WorkspaceLayoutV1,
  patch: Partial<Omit<WorkspaceLayoutV1, 'schemaVersion' | 'preset'>>,
  viewport: WorkspaceViewport,
): WorkspaceLayoutV1 => clampWorkspaceLayout(Object.freeze({
  ...layout,
  ...patch,
  schemaVersion: WORKSPACE_LAYOUT_SCHEMA_VERSION,
  preset: 'custom',
}), viewport)
