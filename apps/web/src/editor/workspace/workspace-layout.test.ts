import { describe, expect, it } from 'vitest'

import { clampWorkspaceLayout, defaultWorkspaceLayout, withCustomWorkspaceLayout, workspaceTimelineMaximum } from './workspace-layout'

const desktop = Object.freeze({ width: 1440, height: 900 })

 describe('workspace layout', () => {
  it('provides a bounded Edit default without mutating it', () => {
    const input = defaultWorkspaceLayout()
    const before = JSON.stringify(input)
    const result = clampWorkspaceLayout(input, desktop)
    expect(result).toMatchObject({
      schemaVersion: 'sanverse.workspace-layout/v1',
      activeWorkspace: 'edit',
      leftDockWidthPx: 220,
      rightDockWidthPx: 320,
      timelineHeightPx: 390,
      leftDockCollapsed: false,
      rightDockCollapsed: false,
      activeRightTab: 'tool',
      preset: 'edit',
    })
    expect(JSON.stringify(input)).toBe(before)
  })

  it('clamps every dimension and refuses NaN or Infinity to escape', () => {
    const base = defaultWorkspaceLayout()
    const result = clampWorkspaceLayout({
      ...base,
      leftDockWidthPx: Number.NaN,
      rightDockWidthPx: Number.POSITIVE_INFINITY,
      timelineHeightPx: 99_999,
    }, desktop)
    expect(result.leftDockWidthPx).toBe(220)
    expect(result.rightDockWidthPx).toBe(320)
    expect(result.timelineHeightPx).toBe(workspaceTimelineMaximum(desktop))
    expect(Object.values(result).some((value) => typeof value === 'number' && !Number.isFinite(value))).toBe(false)
  })

  it('collapses side docks on a laptop while preserving Preview and Timeline', () => {
    const result = clampWorkspaceLayout({
      ...defaultWorkspaceLayout(),
      leftDockWidthPx: 420,
      rightDockWidthPx: 520,
      timelineHeightPx: 700,
    }, { width: 1024, height: 768 })
    expect(result.leftDockCollapsed).toBe(true)
    expect(result.rightDockCollapsed).toBe(true)
    expect(result.timelineHeightPx).toBeLessThanOrEqual(workspaceTimelineMaximum({ width: 1024, height: 768 }))
    expect(result.leftDockWidthPx).toBeGreaterThanOrEqual(200)
    expect(result.rightDockWidthPx).toBeGreaterThanOrEqual(280)
  })

  it('turns a manual resize after a preset into a custom layout', () => {
    const result = withCustomWorkspaceLayout(defaultWorkspaceLayout(), { leftDockWidthPx: 360 }, desktop)
    expect(result.leftDockWidthPx).toBe(360)
    expect(result.preset).toBe('custom')
    expect(result.schemaVersion).toBe('sanverse.workspace-layout/v1')
  })
})
