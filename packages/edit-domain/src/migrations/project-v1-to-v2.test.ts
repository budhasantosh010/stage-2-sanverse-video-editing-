import { describe, expect, it } from 'vitest'

import type { AddNameplateAction } from '../actions'
import { accept, createHistory } from '../history'
import { activeOperations, blockedChangeSets, serializeProject } from '../project'
import { TEST_CLIP_ID, TEST_COMPOSITION_ID, TEST_PROJECT_ID, TEST_TRACK_ID, ms, testAsset } from '../test-fixtures'
import { migrateProjectV1ToV2 } from './project-v1-to-v2'

const action = (overrides: Partial<AddNameplateAction> = {}): AddNameplateAction => ({
  schemaVersion: 'sanverse.action/v1',
  actionId: 'action-1',
  kind: 'add-nameplate',
  target: { x: 0.25, y: 0.75, sourceTimeMs: 2_000 },
  primaryText: 'Ada Lovelace',
  secondaryText: 'Mathematician',
  startMs: 2_000,
  durationMs: 5_000,
  ...overrides,
})

const v1Project = (actions: readonly AddNameplateAction[]) => {
  let history = createHistory()
  for (const candidate of actions) {
    const result = accept(history, candidate)
    if (!result.ok) throw new Error(`setup failed: ${JSON.stringify(result.error)}`)
    history = result.value
  }
  return { schemaVersion: 'sanverse.project/v1', projectId: TEST_PROJECT_ID, history }
}

const migrate = (actions: readonly AddNameplateAction[], asset = testAsset()) =>
  migrateProjectV1ToV2({
    v1: v1Project(actions),
    asset,
    projectId: TEST_PROJECT_ID,
    compositionId: TEST_COMPOSITION_ID,
    trackId: TEST_TRACK_ID,
    clipId: TEST_CLIP_ID,
  })

describe('migrating a saved v1 project', () => {
  it('carries every accepted edit across as its own change set', () => {
    const result = migrate([action(), action({ actionId: 'action-2', startMs: 10_000 })])
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return
    expect(result.value.report.migratedChangeSets).toBe(2)
    expect(result.value.project.revision).toBe(2)
    expect(activeOperations(result.value.project)).toHaveLength(2)
  })

  it('converts milliseconds exactly, with no rounding anywhere', () => {
    const result = migrate([action({ startMs: 2_137, durationMs: 4_913 })])
    if (!result.ok) throw new Error('setup failed')
    const operation = activeOperations(result.value.project)[0]
    expect(operation.compositionInterval.start).toEqual(ms(2_137))
    expect(operation.compositionInterval.duration).toEqual(ms(4_913))
    expect(operation.sampledClipTime).toEqual(ms(2_000))
  })

  it('keeps migrated nameplates where they already were on screen', () => {
    // v1 put the top-left corner on the clicked point. New nameplates centre
    // on the click, but changing an already-approved video would move it.
    const result = migrate([action()])
    if (!result.ok) throw new Error('setup failed')
    const operation = activeOperations(result.value.project)[0]
    expect(operation.target.anchor).toBe('top-left')
    expect(operation.target.coordinateSpace).toBe('composition-normalized')
    expect(operation.target.point).toEqual({ x: 0.25, y: 0.75 })
  })

  it('preserves the original edit ID so provenance survives', () => {
    const result = migrate([action({ actionId: 'action-original' })])
    if (!result.ok) throw new Error('setup failed')
    const operation = activeOperations(result.value.project)[0]
    expect(operation.extensions['sanverse.migration/legacy-action-id']).toBe('action-original')
  })

  it('produces byte-identical output when run twice', () => {
    // Migration must be safe to retry after a crash.
    const first = migrate([action(), action({ actionId: 'action-2', startMs: 10_000 })])
    const second = migrate([action(), action({ actionId: 'action-2', startMs: 10_000 })])
    if (!first.ok || !second.ok) throw new Error('setup failed')
    expect(serializeProject(first.value.project)).toEqual(serializeProject(second.value.project))
  })

  it('carries an impossible v1 edit across as blocked instead of dropping or fixing it', () => {
    // The v1 defect: this nameplate starts long after the 30-second video ends.
    // It was accepted, previewed, and saved, and failed only at export.
    const result = migrate([action(), action({ actionId: 'action-bad', startMs: 4_980_000 })])
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return

    expect(result.value.report.blocked).toHaveLength(1)
    expect(result.value.report.blocked[0].legacyActionId).toBe('action-bad')
    // It is still in the project, visible to the user...
    expect(result.value.project.changeSets).toHaveLength(2)
    // ...but it contributes nothing to the exported video...
    expect(activeOperations(result.value.project)).toHaveLength(1)
    // ...and the good edit beside it is untouched.
    expect(blockedChangeSets(result.value.project)).toHaveLength(1)
  })

  it('refuses to migrate a project ID that does not match', () => {
    const result = migrateProjectV1ToV2({
      v1: v1Project([action()]),
      asset: testAsset(),
      projectId: 'project_bbbbbbbbbbbbbbbb',
      compositionId: TEST_COMPOSITION_ID,
      trackId: TEST_TRACK_ID,
      clipId: TEST_CLIP_ID,
    })
    expect(result).toEqual({ ok: false, error: { code: 'PROJECT_ID_MISMATCH' } })
  })

  it('refuses a v1 project that is not valid v1 in the first place', () => {
    const result = migrateProjectV1ToV2({
      v1: { schemaVersion: 'sanverse.project/v1', projectId: TEST_PROJECT_ID },
      asset: testAsset(),
      projectId: TEST_PROJECT_ID,
      compositionId: TEST_COMPOSITION_ID,
      trackId: TEST_TRACK_ID,
      clipId: TEST_CLIP_ID,
    })
    expect(result).toEqual({ ok: false, error: { code: 'V1_PROJECT_INVALID' } })
  })

  it('produces a project the ordinary reader accepts', () => {
    const result = migrate([action()])
    if (!result.ok) throw new Error('setup failed')
    expect(serializeProject(result.value.project)).toMatchObject({ ok: true })
  })
})
