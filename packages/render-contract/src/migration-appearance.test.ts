import { describe, expect, it } from 'vitest'

import type { AddNameplateAction } from '@sanverse/edit-domain/actions'
import { accept, createHistory } from '@sanverse/edit-domain/history'
import { upgradeSavedProject } from '@sanverse/edit-domain/migrations/upgrade-project'
import {
  TEST_CLIP_ID,
  TEST_COMPOSITION_ID,
  TEST_PROJECT_ID,
  TEST_TRACK_ID,
  testAsset,
} from '@sanverse/edit-domain/test-fixtures'
import { compileProjectToRenderPlan } from './compile-project.ts'

describe('old project component appearance', () => {
  it('retains the exact v1 component, anchor, words, and render style after migration', () => {
    const action: AddNameplateAction = {
      schemaVersion: 'sanverse.action/v1',
      actionId: 'legacy-nameplate-1',
      kind: 'add-nameplate',
      target: { x: 0.25, y: 0.75, sourceTimeMs: 2_000 },
      primaryText: 'Ada Lovelace',
      secondaryText: 'Mathematician',
      startMs: 2_000,
      durationMs: 5_000,
    }
    const accepted = accept(createHistory(), action)
    if (!accepted.ok) throw new Error('legacy fixture failed')
    const input = {
      saved: {
        schemaVersion: 'sanverse.project/v1' as const,
        projectId: TEST_PROJECT_ID,
        history: accepted.value,
      },
      asset: testAsset(),
      projectId: TEST_PROJECT_ID,
      compositionId: TEST_COMPOSITION_ID,
      trackId: TEST_TRACK_ID,
      clipId: TEST_CLIP_ID,
    }
    const migrated = upgradeSavedProject(input)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const first = compileProjectToRenderPlan(migrated.value.project)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.value.overlays[0]).toMatchObject({
      kind: 'text-overlay',
      target: {
        coordinateSpace: 'composition-normalized',
        point: { x: 0.25, y: 0.75 },
        anchor: 'top-left',
      },
      primaryText: 'Ada Lovelace',
      secondaryText: 'Mathematician',
      styleId: 'sanverse.nameplate.default/v1',
    })

    const reopened = upgradeSavedProject({ ...input, saved: migrated.value.project })
    expect(reopened.ok).toBe(true)
    if (!reopened.ok) return
    const second = compileProjectToRenderPlan(reopened.value.project)
    expect(second).toEqual(first)
  })
})
