import { describe, expect, it } from 'vitest'

import { TRACK_OUTPUT_PRIMITIVE_ID, MUSIC_PRIMITIVE_ID } from './capabilities.ts'
import { validateOperation } from './operations.ts'
import {
  DEFAULT_TRACK_OUTPUTS,
  TIMELINE_TRACK_IDS,
  foldTrackOutputOperations,
  isTimelineTrackId,
  validateTrackOutputOperation,
  type SetTrackOutputOperation,
} from './track-output.ts'
import {
  acceptChangeSet,
  activeTrackOutputs,
  redoChangeSet,
  undoChangeSet,
  type EditProject,
} from './project.ts'
import { changeSetOf, testMultiAssetProject } from './test-fixtures.ts'

const setOutput = (
  trackId: string,
  outputEnabled: boolean,
  operationId = 'operation_output01',
): Record<string, unknown> => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'set-track-output',
  capabilityId: TRACK_OUTPUT_PRIMITIVE_ID,
  trackId,
  outputEnabled,
  extensions: {},
})

const accept = (
  project: EditProject,
  changeSetId: string,
  operations: readonly unknown[],
): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(changeSetId, project.revision, operations as never))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

describe('P1-F.1A C1.7 track output', () => {
  it('keeps exactly five legacy aliases while accepting stable T5 track ids', () => {
    expect(TIMELINE_TRACK_IDS).toEqual(['V2', 'V1', 'C1', 'A1', 'A2'])
    for (const trackId of TIMELINE_TRACK_IDS) expect(isTimelineTrackId(trackId)).toBe(true)
    expect(isTimelineTrackId('track_aaaaaaaa')).toBe(true)
    for (const invalid of ['V3', 'A3', 'v1', '', 'track_short', null, 7]) {
      expect(isTimelineTrackId(invalid)).toBe(false)
    }
  })

  it('starts every track switched on, so an untouched project behaves as it always did', () => {
    expect(DEFAULT_TRACK_OUTPUTS).toEqual({ V2: true, V1: true, C1: true, A1: true, A2: true })
    expect(activeTrackOutputs(testMultiAssetProject())).toEqual(DEFAULT_TRACK_OUTPUTS)
  })

  it('refuses a track it has never heard of rather than ignoring the request', () => {
    const result = validateTrackOutputOperation(setOutput('V3', false))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.path.endsWith('.trackId'))).toBe(true)
  })

  it('refuses an unknown key rather than dropping it', () => {
    const result = validateTrackOutputOperation({ ...setOutput('A2', false), fadeOut: 12 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'FIELD_UNKNOWN')).toBe(true)
  })

  it('refuses a capability that cannot produce this operation', () => {
    const result = validateTrackOutputOperation({ ...setOutput('A2', false), capabilityId: MUSIC_PRIMITIVE_ID })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'CAPABILITY_UNKNOWN')).toBe(true)
  })

  it('refuses a switch that is not a yes or a no', () => {
    const result = validateTrackOutputOperation({ ...setOutput('A2', false), outputEnabled: 'off' })
    expect(result.ok).toBe(false)
  })

  it('is reachable through the one operation validator every caller uses', () => {
    const result = validateOperation(setOutput('C1', false))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.kind).toBe('set-track-output')
  })

  it('lets the last word win, so two switches of one track cannot leave a third state', () => {
    const operations = [
      { trackId: 'A2', outputEnabled: false },
      { trackId: 'A2', outputEnabled: true },
      { trackId: 'A2', outputEnabled: false },
    ].map((entry, index) =>
      (validateTrackOutputOperation(
        setOutput(entry.trackId, entry.outputEnabled, `operation_output0${index}`),
      ) as { ok: true; value: SetTrackOutputOperation }).value,
    )
    expect(foldTrackOutputOperations(operations).A2).toBe(false)
    expect(foldTrackOutputOperations(operations).V1).toBe(true)
  })

  it('is an ordinary accepted edit: one revision, one Undo, and Redo brings it back', () => {
    const base = testMultiAssetProject()
    const muted = accept(base, 'changeset_output001', [setOutput('A1', false)])

    expect(muted.revision).toBe(base.revision + 1)
    expect(activeTrackOutputs(muted).A1).toBe(false)

    const undone = undoChangeSet(muted)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(activeTrackOutputs(undone.value).A1).toBe(true)

    const redone = redoChangeSet(undone.value)
    expect(redone.ok).toBe(true)
    if (!redone.ok) return
    expect(activeTrackOutputs(redone.value).A1).toBe(false)
  })

  it('keeps the five tracks independent, so muting music leaves the voice alone', () => {
    const project = accept(testMultiAssetProject(), 'changeset_output002', [setOutput('A2', false)])
    expect(activeTrackOutputs(project)).toEqual({ V2: true, V1: true, C1: true, A1: true, A2: false })
  })
})
