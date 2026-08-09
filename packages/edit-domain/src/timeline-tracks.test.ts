import { describe, expect, it } from 'vitest'
import { acceptChangeSet, activeTimelineTrackState, activeTrackOutputs } from './project.ts'
import { TIMELINE_TRACKS_PRIMITIVE_ID, TRACK_OUTPUT_PRIMITIVE_ID } from './capabilities.ts'
import { OPERATION_SCHEMA_VERSION } from './timeline-operations.ts'
import { TRACK_OUTPUT_OPERATION_KIND, type SetTrackOutputOperation } from './track-output.ts'
import { TEST_TRACK_ID, testProject } from './test-fixtures.ts'
import type { ChangeSet } from './change-set.ts'
import type { Track } from './composition.ts'
import {
  DEFAULT_AUDIO_TRACK_STATE,
  LEGACY_CAPTION_TRACK_ID,
  LEGACY_DIALOGUE_TRACK_ID,
  LEGACY_MUSIC_TRACK_ID,
  LEGACY_OVERLAY_TRACK_ID,
  MAX_AUDIO_TRACKS,
  MAX_CAPTION_TRACKS,
  MAX_TRACK_NAME_CODE_POINTS,
  MAX_VIDEO_TRACKS,
  TIMELINE_TRACK_MODEL_SCHEMA_VERSION,
  applyTimelineTrackOperation,
  canTrackAcceptTimelineItem,
  createLegacyTimelineTrackState,
  legacyDisplayTrackId,
  normalizeTrackName,
  resolvedTrackForTimelineItem,
  trackById,
  trackDisplayLabel,
  tracksOfKind,
  validateTimelineTrackOperation,
  validateTimelineTrackV2,
  type AddTimelineTrackOperation,
  type AssignTimelineItemTrackOperation,
  type ReorderTimelineTrackOperation,
  type SetTrackAudioStateOperation,
  type SetTrackSyncLockOperation,
  type TimelineTrackOperation,
  type TimelineTrackV2,
} from './timeline-tracks.ts'

let idCounter = 0
const opId = (): string => `operation_t5${String(++idCounter).padStart(8, '0')}`
const csId = (): string => `changeset_t5${String(++idCounter).padStart(8, '0')}`

const baseTrack = (overrides: Partial<TimelineTrackV2> = {}): TimelineTrackV2 => Object.freeze({
  trackId: 'track_genericv001',
  kind: 'video' as const,
  role: 'generic-video' as const,
  name: null,
  syncLockEnabled: true,
  outputEnabled: true,
  audioState: null,
  ...overrides,
})

const addTrack = (track: TimelineTrackV2, insertIndex: number): AddTimelineTrackOperation => Object.freeze({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: opId(),
  kind: 'add-timeline-track' as const,
  capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
  track,
  insertIndex,
  extensions: {},
})

const changeSet = (revision: number, operations: readonly (TimelineTrackOperation | SetTrackOutputOperation)[]): ChangeSet => Object.freeze({
  schemaVersion: 'sanverse.change-set/v1',
  changeSetId: csId(),
  baseRevision: revision,
  operations,
  provenance: Object.freeze({ source: 'direct' as const, requestId: null }),
  extensions: {},
})

const accept = (project = testProject(), operations: readonly (TimelineTrackOperation | SetTrackOutputOperation)[]) => {
  const result = acceptChangeSet(project, changeSet(project.revision, operations))
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

const state = () => {
  const result = createLegacyTimelineTrackState(testProject().composition)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

describe('T5 Track Model V2 legacy projection', () => {
  it('creates the familiar five roles with stable ids and the real primary track identity', () => {
    const projected = state()
    expect(projected.schemaVersion).toBe(TIMELINE_TRACK_MODEL_SCHEMA_VERSION)
    expect(projected.tracks.map((track) => [track.trackId, track.kind, track.role])).toEqual([
      [TEST_TRACK_ID, 'video', 'primary-video'],
      [LEGACY_OVERLAY_TRACK_ID, 'video', 'overlay-video'],
      [LEGACY_CAPTION_TRACK_ID, 'caption', 'captions'],
      [LEGACY_DIALOGUE_TRACK_ID, 'audio', 'dialogue'],
      [LEGACY_MUSIC_TRACK_ID, 'audio', 'music'],
    ])
    expect(projected.assignments).toEqual([])
  })

  it('preserves the pre-T5 Sync Lock behavior in the deterministic defaults', () => {
    const projected = state()
    expect(projected.tracks.map((track) => [track.role, track.syncLockEnabled])).toEqual([
      ['primary-video', true],
      ['overlay-video', true],
      ['captions', true],
      ['dialogue', true],
      ['music', false],
    ])
  })

  it('maps legacy display aliases by role instead of treating display text as canonical identity', () => {
    const projected = state()
    expect(legacyDisplayTrackId(projected, 'V1')).toBe(TEST_TRACK_ID)
    expect(legacyDisplayTrackId(projected, 'V2')).toBe(LEGACY_OVERLAY_TRACK_ID)
    expect(legacyDisplayTrackId(projected, 'C1')).toBe(LEGACY_CAPTION_TRACK_ID)
    expect(legacyDisplayTrackId(projected, 'A1')).toBe(LEGACY_DIALOGUE_TRACK_ID)
    expect(legacyDisplayTrackId(projected, 'A2')).toBe(LEGACY_MUSIC_TRACK_ID)
  })

  it('projects extra pre-existing composition video tracks deterministically without inventing replacement ids', () => {
    const project = testProject()
    const extra: Track = Object.freeze({ trackId: 'track_legacybbb1', kind: 'video', order: 1, clips: Object.freeze([]) })
    const composition = Object.freeze({ ...project.composition, tracks: Object.freeze([...project.composition.tracks, extra]) })
    const projected = createLegacyTimelineTrackState(composition)
    expect(projected.ok).toBe(true)
    if (!projected.ok) return
    expect(projected.value.tracks.slice(0, 3).map((track) => [track.trackId, track.role])).toEqual([
      [TEST_TRACK_ID, 'primary-video'],
      ['track_legacybbb1', 'generic-video'],
      [LEGACY_OVERLAY_TRACK_ID, 'overlay-video'],
    ])
  })

  it('makes migration itself revision-free and leaves every default output enabled', () => {
    const project = testProject()
    const projected = activeTimelineTrackState(project)
    expect(project.revision).toBe(0)
    expect(project.changeSets).toEqual([])
    expect(projected.tracks.every((track) => track.outputEnabled)).toBe(true)
    expect(activeTrackOutputs(project)).toMatchObject({ V2: true, V1: true, C1: true, A1: true, A2: true })
  })
})

describe('T5 Track Model V2 validation and closed semantics', () => {
  it('accepts only closed kind/role pairings', () => {
    expect(validateTimelineTrackV2(baseTrack()).ok).toBe(true)
    expect(validateTimelineTrackV2(baseTrack({ role: 'music' })).ok).toBe(false)
    expect(validateTimelineTrackV2({ ...baseTrack(), kind: 'anything' }).ok).toBe(false)
    expect(validateTimelineTrackV2({ ...baseTrack(), role: 'anything' }).ok).toBe(false)
  })

  it('requires stable track ids rather than display labels', () => {
    expect(validateTimelineTrackV2(baseTrack({ trackId: 'V3' })).ok).toBe(false)
    expect(validateTimelineTrackV2(baseTrack({ trackId: 'track_valid0001' })).ok).toBe(true)
  })

  it('normalizes ordinary Unicode names and refuses controls or names beyond the one bound', () => {
    expect(normalizeTrackName('  B-roll 日本語  ')).toEqual({ ok: true, value: 'B-roll 日本語' })
    expect(normalizeTrackName('line\nbreak').ok).toBe(false)
    expect(normalizeTrackName('🙂'.repeat(MAX_TRACK_NAME_CODE_POINTS)).ok).toBe(true)
    expect(normalizeTrackName('🙂'.repeat(MAX_TRACK_NAME_CODE_POINTS + 1)).ok).toBe(false)
  })

  it('requires normalized stored names so serialized accepted state has one representation', () => {
    expect(validateTimelineTrackV2(baseTrack({ name: 'B-roll' })).ok).toBe(true)
    expect(validateTimelineTrackV2(baseTrack({ name: ' B-roll ' })).ok).toBe(false)
  })

  it('uses one named authority for the track ceilings', () => {
    expect(MAX_VIDEO_TRACKS).toBe(32)
    expect(MAX_AUDIO_TRACKS).toBe(32)
    expect(MAX_CAPTION_TRACKS).toBe(8)
  })

  it('validates the closed operation family through the registered capability', () => {
    const operation = addTrack(baseTrack(), 2)
    expect(validateTimelineTrackOperation(operation)).toEqual({ ok: true, value: operation })
    expect(validateTimelineTrackOperation({ ...operation, kind: 'set-track' }).ok).toBe(false)
    expect(validateTimelineTrackOperation({ ...operation, capabilityId: 'sanverse.fake/v1' }).ok).toBe(false)
  })
})

describe('T5 stable track operations', () => {
  it('adds a generic video above the creator default without changing stable default ids', () => {
    const initial = state()
    const operation = addTrack(baseTrack(), 2)
    const next = applyTimelineTrackOperation(initial, operation)
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(tracksOfKind(next.value, 'video').map((track) => track.trackId)).toEqual([
      TEST_TRACK_ID,
      LEGACY_OVERLAY_TRACK_ID,
      'track_genericv001',
    ])
    expect(trackDisplayLabel(next.value, TEST_TRACK_ID)).toBe('V1')
    expect(trackDisplayLabel(next.value, 'track_genericv001')).toBe('V3')
  })

  it('adds generic audio after Dialogue and keeps Dialogue A1', () => {
    const initial = state()
    const operation = addTrack(baseTrack({
      trackId: 'track_generica001', kind: 'audio', role: 'generic-audio', audioState: DEFAULT_AUDIO_TRACK_STATE,
    }), 2)
    const next = applyTimelineTrackOperation(initial, operation)
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(trackDisplayLabel(next.value, LEGACY_DIALOGUE_TRACK_ID)).toBe('A1')
    expect(trackDisplayLabel(next.value, 'track_generica001')).toBe('A3')
  })

  it('refuses inserting video below the primary or audio before Dialogue', () => {
    const initial = state()
    expect(applyTimelineTrackOperation(initial, addTrack(baseTrack(), 0))).toMatchObject({ ok: false, error: { code: 'PRIMARY_TRACK_PINNED' } })
    expect(applyTimelineTrackOperation(initial, addTrack(baseTrack({
      trackId: 'track_generica001', kind: 'audio', role: 'generic-audio', audioState: DEFAULT_AUDIO_TRACK_STATE,
    }), 0))).toMatchObject({ ok: false, error: { code: 'DIALOGUE_TRACK_PINNED' } })
  })

  it('refuses duplicate required roles and stable ids', () => {
    const initial = state()
    expect(applyTimelineTrackOperation(initial, addTrack(baseTrack({ trackId: TEST_TRACK_ID }), 2))).toMatchObject({ ok: false, error: { code: 'DUPLICATE_TRACK_ID' } })
    expect(applyTimelineTrackOperation(initial, addTrack(baseTrack({ trackId: 'track_primary002', role: 'primary-video' }), 2))).toMatchObject({ ok: false, error: { code: 'TRACK_ROLE_INVALID' } })
  })

  it('renames metadata without changing the id or display number', () => {
    const initial = state()
    const operation: TimelineTrackOperation = Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: opId(),
      kind: 'rename-timeline-track',
      capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      trackId: LEGACY_OVERLAY_TRACK_ID,
      name: 'B-roll 日本語',
      extensions: {},
    })
    const next = applyTimelineTrackOperation(initial, operation)
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(trackById(next.value, LEGACY_OVERLAY_TRACK_ID)?.name).toBe('B-roll 日本語')
    expect(trackDisplayLabel(next.value, LEGACY_OVERLAY_TRACK_ID)).toBe('V2')
  })

  it('reorders generic video layers while stable ids survive and display numbers derive again', () => {
    const withV3 = applyTimelineTrackOperation(state(), addTrack(baseTrack(), 2))
    expect(withV3.ok).toBe(true)
    if (!withV3.ok) return
    const reorder: ReorderTimelineTrackOperation = Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: opId(),
      kind: 'reorder-timeline-track',
      capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      trackId: 'track_genericv001',
      toIndex: 1,
      extensions: {},
    })
    const next = applyTimelineTrackOperation(withV3.value, reorder)
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(tracksOfKind(next.value, 'video').map((track) => track.trackId)).toEqual([
      TEST_TRACK_ID,
      'track_genericv001',
      LEGACY_OVERLAY_TRACK_ID,
    ])
    expect(trackDisplayLabel(next.value, 'track_genericv001')).toBe('V2')
    expect(trackDisplayLabel(next.value, LEGACY_OVERLAY_TRACK_ID)).toBe('V3')
  })

  it('never reorders required primary/dialogue tracks', () => {
    const primary: ReorderTimelineTrackOperation = Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION, operationId: opId(), kind: 'reorder-timeline-track', capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      trackId: TEST_TRACK_ID, toIndex: 1, extensions: {},
    })
    const dialogue: ReorderTimelineTrackOperation = Object.freeze({ ...primary, operationId: opId(), trackId: LEGACY_DIALOGUE_TRACK_ID, toIndex: 1 })
    expect(applyTimelineTrackOperation(state(), primary)).toMatchObject({ ok: false, error: { code: 'PRIMARY_TRACK_PINNED' } })
    expect(applyTimelineTrackOperation(state(), dialogue)).toMatchObject({ ok: false, error: { code: 'DIALOGUE_TRACK_PINNED' } })
  })

  it('stores Sync Lock as one accepted track value and audio mix only on audio tracks', () => {
    const sync: SetTrackSyncLockOperation = Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION, operationId: opId(), kind: 'set-track-sync-lock', capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      trackId: LEGACY_MUSIC_TRACK_ID, enabled: true, extensions: {},
    })
    const synced = applyTimelineTrackOperation(state(), sync)
    expect(synced.ok).toBe(true)
    if (!synced.ok) return
    expect(trackById(synced.value, LEGACY_MUSIC_TRACK_ID)?.syncLockEnabled).toBe(true)

    const mix: SetTrackAudioStateOperation = Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION, operationId: opId(), kind: 'set-track-audio-state', capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      trackId: LEGACY_MUSIC_TRACK_ID, audioState: Object.freeze({ muted: true, solo: false, gainDb: -6, pan: 2500 }), extensions: {},
    })
    const mixed = applyTimelineTrackOperation(synced.value, mix)
    expect(mixed.ok).toBe(true)
    if (!mixed.ok) return
    expect(trackById(mixed.value, LEGACY_MUSIC_TRACK_ID)?.audioState).toEqual({ muted: true, solo: false, gainDb: -6, pan: 2500 })
    expect(applyTimelineTrackOperation(state(), { ...mix, operationId: opId(), trackId: LEGACY_OVERLAY_TRACK_ID })).toMatchObject({ ok: false, error: { code: 'TRACK_KIND_UNSUPPORTED' } })
  })
})

describe('T5 item assignment and compatibility', () => {
  it('uses deterministic legacy defaults until a current assignment exists', () => {
    const initial = state()
    expect(resolvedTrackForTimelineItem(initial, 'overlay:item1', 'visual')?.trackId).toBe(LEGACY_OVERLAY_TRACK_ID)
    expect(resolvedTrackForTimelineItem(initial, 'music:item1', 'audio')?.trackId).toBe(LEGACY_MUSIC_TRACK_ID)
    expect(resolvedTrackForTimelineItem(initial, 'caption:item1', 'caption')?.trackId).toBe(LEGACY_CAPTION_TRACK_ID)
  })

  it('assigns an operation-backed item once to a stable destination', () => {
    const withV3 = applyTimelineTrackOperation(state(), addTrack(baseTrack(), 2))
    expect(withV3.ok).toBe(true)
    if (!withV3.ok) return
    const assignment: AssignTimelineItemTrackOperation = Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION, operationId: opId(), kind: 'assign-timeline-item-track', capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      itemId: 'overlay:item1', trackId: 'track_genericv001', extensions: {},
    })
    const assigned = applyTimelineTrackOperation(withV3.value, assignment)
    expect(assigned.ok).toBe(true)
    if (!assigned.ok) return
    expect(resolvedTrackForTimelineItem(assigned.value, 'overlay:item1', 'visual')?.trackId).toBe('track_genericv001')
  })

  it('uses one closed compatibility resolver', () => {
    const projected = state()
    const primary = trackById(projected, TEST_TRACK_ID)!
    const overlay = trackById(projected, LEGACY_OVERLAY_TRACK_ID)!
    const dialogue = trackById(projected, LEGACY_DIALOGUE_TRACK_ID)!
    const music = trackById(projected, LEGACY_MUSIC_TRACK_ID)!
    expect(canTrackAcceptTimelineItem(primary, 'primary')).toEqual({ ok: true, value: true })
    expect(canTrackAcceptTimelineItem(overlay, 'visual')).toEqual({ ok: true, value: true })
    expect(canTrackAcceptTimelineItem(dialogue, 'dialogue')).toEqual({ ok: true, value: true })
    expect(canTrackAcceptTimelineItem(music, 'audio')).toEqual({ ok: true, value: true })
    expect(canTrackAcceptTimelineItem(music, 'visual')).toMatchObject({ ok: false, error: { code: 'TRACK_ITEM_INCOMPATIBLE' } })
    expect(canTrackAcceptTimelineItem(overlay, 'audio')).toMatchObject({ ok: false, error: { code: 'TRACK_ITEM_INCOMPATIBLE' } })
  })
})

describe('T5 accepted-history replay and legacy output compatibility', () => {
  it('replays a track creation as one accepted project revision', () => {
    const project = accept(testProject(), [addTrack(baseTrack(), 2)])
    expect(project.revision).toBe(1)
    expect(activeTimelineTrackState(project).tracks.some((track) => track.trackId === 'track_genericv001')).toBe(true)
  })

  it('maps an old V2 output operation to the stable legacy-overlay identity', () => {
    const output: SetTrackOutputOperation = Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: opId(),
      kind: TRACK_OUTPUT_OPERATION_KIND,
      capabilityId: TRACK_OUTPUT_PRIMITIVE_ID,
      trackId: 'V2',
      outputEnabled: false,
      extensions: {},
    })
    const project = accept(testProject(), [output])
    const projected = activeTimelineTrackState(project)
    expect(trackById(projected, LEGACY_OVERLAY_TRACK_ID)?.outputEnabled).toBe(false)
    expect(activeTrackOutputs(project).V2).toBe(false)
  })

  it('accepts output addressed directly by a stable T5 id after creation', () => {
    const created = accept(testProject(), [addTrack(baseTrack(), 2)])
    const output: SetTrackOutputOperation = Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: opId(),
      kind: TRACK_OUTPUT_OPERATION_KIND,
      capabilityId: TRACK_OUTPUT_PRIMITIVE_ID,
      trackId: 'track_genericv001',
      outputEnabled: false,
      extensions: {},
    })
    const next = accept(created, [output])
    expect(trackById(activeTimelineTrackState(next), 'track_genericv001')?.outputEnabled).toBe(false)
    expect(activeTrackOutputs(next)).toMatchObject({ V2: true, V1: true, C1: true, A1: true, A2: true })
  })

  it('blocks an invalid compound track change set atomically', () => {
    const invalid = addTrack(baseTrack({ trackId: TEST_TRACK_ID }), 2)
    const result = acceptChangeSet(testProject(), changeSet(0, [invalid]))
    expect(result.ok).toBe(false)
  })
})
