import { describe, expect, it } from 'vitest'

import { WORKSPACE_PRESETS } from './workspace-contract'
import { WORKSPACE_CONSTRAINTS } from './workspace-layout'
import { applyWorkspacePreset, resetWorkspaceLayout } from './workspace-presets'

const desktop = Object.freeze({ width: 1440, height: 900 })

describe('workspace presets', () => {
  it('provides every required preset as bounded presentation state', () => {
    for (const preset of WORKSPACE_PRESETS) {
      const layout = applyWorkspacePreset(preset, desktop)
      expect(layout.preset).toBe(preset)
      expect(layout.leftDockWidthPx).toBeGreaterThanOrEqual(WORKSPACE_CONSTRAINTS.leftDockMinPx)
      expect(layout.rightDockWidthPx).toBeGreaterThanOrEqual(WORKSPACE_CONSTRAINTS.rightDockMinPx)
      expect(layout.timelineHeightPx).toBeGreaterThanOrEqual(WORKSPACE_CONSTRAINTS.timelineMinPx)
    }
  })

  it('makes Motion and Review prioritize Preview differently', () => {
    const motion = applyWorkspacePreset('motion', desktop)
    const review = applyWorkspacePreset('review', desktop)
    expect(motion.leftDockCollapsed).toBe(true)
    expect(motion.rightDockCollapsed).toBe(false)
    expect(review.leftDockCollapsed).toBe(true)
    expect(review.rightDockCollapsed).toBe(true)
    expect(review.timelineHeightPx).toBeLessThan(motion.timelineHeightPx)
  })

  it('activates Audio only for the Audio preset and resets to Edit', () => {
    expect(applyWorkspacePreset('audio', desktop).activeWorkspace).toBe('audio')
    expect(resetWorkspaceLayout(desktop)).toMatchObject({ activeWorkspace: 'edit', preset: 'edit' })
  })
})
