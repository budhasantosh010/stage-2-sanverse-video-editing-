import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VISUAL_PROPERTIES,
  OPERATION_SCHEMA_VERSION,
  VISUAL_PROPERTIES_PRIMITIVE_ID,
  acceptChangeSet,
  setChangeSetActive,
  type EditOperation,
  type EditProject,
} from '@sanverse/edit-domain'

import { TEST_CLIP_ID, testProject } from '../../test-fixtures'
import {
  acceptOperation,
  callout,
  captions,
  createIds,
  imageAsset,
  mediaOverlay,
  music,
  musicAsset,
  nameplate,
  projectWithAllTimelineFamilies,
  range,
  removedProject,
  splitProject,
  title,
} from '../../features/timeline/timeline-test-fixtures'
import { buildTimelineViewModel, type PendingTimelineInput, type TimelineViewModel } from '../../features/timeline'
import { resolveInspectorSelection } from './inspector-selection-resolver'

const ASSET_LABELS = Object.freeze({
  asset_aaaaaaaa: 'owner.mp4',
  asset_image0001: 'product.png',
  asset_broll0001: 'demo.mp4',
  asset_music0001: 'theme.wav',
})

const modelFor = (
  project: EditProject,
  selectedItemId: string | null,
  pending: PendingTimelineInput | null = null,
): TimelineViewModel => buildTimelineViewModel({
  project,
  selectedItemId,
  pending,
  assetLabels: ASSET_LABELS,
})

const resolve = (
  project: EditProject,
  selectedItemId: string | null,
  pending: PendingTimelineInput | null = null,
  timeline: TimelineViewModel = modelFor(project, selectedItemId, pending),
) => resolveInspectorSelection({
  project,
  timeline,
  selectedTimelineItemId: selectedItemId,
  pending,
  assetLabels: ASSET_LABELS,
})

const itemId = (
  project: EditProject,
  predicate: (item: TimelineViewModel['lanes'][number]['items'][number], laneId: string) => boolean,
): string => {
  const model = modelFor(project, null)
  for (const lane of model.lanes) {
    const item = lane.items.find((candidate) => predicate(candidate, lane.id))
    if (item) return item.id
  }
  throw new Error('fixture timeline item was not found')
}

const accept = (project: EditProject, operation: EditOperation): EditProject => {
  const accepted = acceptChangeSet(project, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: `changeset_${operation.operationId.replace(/^operation_/, '')}`,
    baseRevision: project.revision,
    operations: [operation],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!accepted.ok) throw new Error(JSON.stringify(accepted.error))
  return accepted.value
}

describe('resolveInspectorSelection', () => {
  it('returns the explicit empty state when nothing is selected', () => {
    const project = testProject()
    expect(resolve(project, null)).toMatchObject({
      kind: 'nothing',
      state: 'read-only',
      projectRevision: project.revision,
    })
  })

  it('resolves a real derived gap without inventing clip controls', () => {
    const project = removedProject(false)
    const selected = itemId(project, (item) => item.kind === 'gap')
    expect(resolve(project, selected)).toMatchObject({
      kind: 'gap',
      state: 'read-only',
      label: 'Gap',
      durationTicks: expect.any(Number),
    })
  })

  it('resolves a V1 clip from the current effective composition', () => {
    const project = testProject()
    const selected = `clip:${TEST_CLIP_ID}`
    expect(resolve(project, selected)).toMatchObject({
      kind: 'video',
      state: 'committed',
      label: 'owner.mp4',
      assetLabel: 'owner.mp4',
      clip: { clipId: TEST_CLIP_ID, gainDb: 0, enabled: true },
      nextClipId: null,
      transition: null,
    })
  })

  it('resolves A1 dialogue to the same authoritative linked clip', () => {
    const project = testProject()
    const selected = itemId(project, (_item, laneId) => laneId === 'lane:dialogue')
    const selection = resolve(project, selected)
    expect(selection).toMatchObject({
      kind: 'dialogue',
      label: 'Dialogue · owner.mp4',
      clip: { clipId: TEST_CLIP_ID, gainDb: 0 },
    })
  })

  it('distinguishes one caption cue from its caption set', () => {
    const ids = createIds()
    let project = testProject()
    project = acceptOperation(project, captions(ids.operation()))
    const selected = itemId(project, (item) => item.kind === 'caption')
    expect(resolve(project, selected)).toMatchObject({
      kind: 'caption',
      label: 'Hello world',
      captionSet: { styleId: 'sanverse.caption.boxed/v1' },
      cue: { cueId: 'cue_0001', lines: ['Hello world'] },
      visualId: expect.stringMatching(/^captions_/),
      visualProperties: DEFAULT_VISUAL_PROPERTIES,
    })
  })

  it('resolves accepted nameplates and keeps accepted text read-only context', () => {
    const ids = createIds()
    const operation = nameplate(ids.operation(), 1, 2, 'Santosh')
    const project = acceptOperation(testProject(), operation)
    const selected = itemId(project, (item) => item.kind === 'nameplate')
    expect(resolve(project, selected)).toMatchObject({
      kind: 'nameplate',
      label: 'Santosh',
      operation: { operationId: operation.operationId, primaryText: 'Santosh' },
      visualId: operation.operationId,
      textEditable: false,
    })
  })

  it('resolves title, callout, media-overlay, and music current folded state', () => {
    const project = projectWithAllTimelineFamilies()

    expect(resolve(project, itemId(project, (item) => item.kind === 'title'))).toMatchObject({
      kind: 'title',
      operation: { kind: 'add-title', headline: 'Main point' },
      visualId: expect.stringMatching(/^title_/),
    })
    expect(resolve(project, itemId(project, (item) => item.kind === 'callout'))).toMatchObject({
      kind: 'callout',
      operation: { kind: 'add-callout', label: 'Look here' },
      visualId: expect.stringMatching(/^callout_/),
    })
    expect(resolve(project, itemId(project, (item) => item.kind === 'media-overlay'))).toMatchObject({
      kind: 'media-overlay',
      assetLabel: expect.stringMatching(/product\.png|demo\.mp4/),
      operation: { kind: 'add-media-overlay' },
      visualId: expect.stringMatching(/^broll_/),
    })
    expect(resolve(project, itemId(project, (item) => item.kind === 'music'))).toMatchObject({
      kind: 'music',
      label: 'theme.wav',
      assetLabel: 'theme.wav',
      operation: { kind: 'add-music', gainDb: -18 },
    })
  })

  it('resolves a detached proposal without treating it as committed', () => {
    const project = testProject()
    const operation = nameplate('operation_proposal1', 2, 3, 'Preview only')
    const pending: PendingTimelineInput = Object.freeze({
      proposalId: 'proposal_0001',
      baseRevision: project.revision,
      operations: Object.freeze([operation]),
    })
    const model = modelFor(project, null, pending)
    const selected = model.lanes.flatMap((lane) => lane.items).find((item) => item.state === 'proposed')?.id
    if (!selected) throw new Error('proposal item missing')

    expect(resolve(project, selected, pending, modelFor(project, selected, pending))).toMatchObject({
      kind: 'proposal',
      state: 'proposed',
      proposalId: 'proposal_0001',
      operation: { operationId: 'operation_proposal1', primaryText: 'Preview only' },
    })
  })

  it('returns a truthful blocked selection when the presentation item is blocked', () => {
    const project = testProject()
    const model = modelFor(project, `clip:${TEST_CLIP_ID}`)
    const blocked: TimelineViewModel = Object.freeze({
      ...model,
      lanes: Object.freeze(model.lanes.map((lane) => Object.freeze({
        ...lane,
        items: Object.freeze(lane.items.map((item) => item.id === `clip:${TEST_CLIP_ID}`
          ? Object.freeze({ ...item, state: 'blocked' as const, blockedReason: 'CLIP_UNKNOWN' })
          : item)),
      }))),
    })
    expect(resolve(project, `clip:${TEST_CLIP_ID}`, null, blocked)).toMatchObject({
      kind: 'blocked',
      state: 'blocked',
      reason: 'CLIP_UNKNOWN',
      originalKind: 'clip',
    })
  })

  it('fails closed for unknown IDs and timeline/project revision mismatch', () => {
    const project = testProject()
    expect(resolve(project, 'clip_missing')).toMatchObject({ kind: 'nothing', reason: 'SELECTION_UNKNOWN' })

    const model = modelFor(project, `clip:${TEST_CLIP_ID}`)
    const stale = Object.freeze({ ...model, projectRevision: project.revision + 1 })
    expect(resolve(project, `clip:${TEST_CLIP_ID}`, null, stale)).toMatchObject({
      kind: 'nothing',
      reason: 'SELECTION_STALE',
    })
  })

  it('ignores inactive operations', () => {
    const ids = createIds()
    const operation = title(ids.operation())
    let project = acceptOperation(testProject(), operation)
    const inactive = setChangeSetActive(project, project.changeSets[0].changeSet.changeSetId, false)
    if (!inactive.ok) throw new Error(JSON.stringify(inactive.error))
    project = inactive.value
    expect(resolve(project, `overlay:${operation.titleId}:0`)).toMatchObject({
      kind: 'nothing',
      reason: 'SELECTION_UNKNOWN',
    })
  })

  it('ignores blocked visual-property operations instead of showing them as effective', () => {
    const ids = createIds()
    const added = title(ids.operation())
    let project = acceptOperation(testProject(), added)
    const blockedOperation: EditOperation = Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: 'operation_blocked1',
      kind: 'set-visual-properties',
      capabilityId: VISUAL_PROPERTIES_PRIMITIVE_ID,
      visualId: 'title_missing1',
      ...DEFAULT_VISUAL_PROPERTIES,
      extensions: {},
    })
    const blockedChangeSet = Object.freeze({
      schemaVersion: 'sanverse.change-set/v1' as const,
      changeSetId: 'changeset_blocked1',
      baseRevision: project.revision,
      operations: Object.freeze([blockedOperation]),
      provenance: Object.freeze({ source: 'direct' as const, requestId: null }),
      extensions: Object.freeze({}),
    })
    project = Object.freeze({
      ...project,
      revision: project.revision + 1,
      changeSets: Object.freeze([...project.changeSets, Object.freeze({
        changeSet: blockedChangeSet,
        active: true,
        blockedReason: 'VISUAL_TARGET_UNKNOWN',
      })]),
      issuedChangeSetIds: Object.freeze([...project.issuedChangeSetIds, blockedChangeSet.changeSetId]),
    })

    const selected = itemId(project, (item) => item.kind === 'title')
    expect(resolve(project, selected)).toMatchObject({
      kind: 'title',
      visualId: added.titleId,
      visualProperties: DEFAULT_VISUAL_PROPERTIES,
    })
  })

  it('uses the latest effective visual-property state', () => {
    const ids = createIds()
    const added = title(ids.operation())
    let project = acceptOperation(testProject(), added)
    project = accept(project, {
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: ids.operation(),
      kind: 'set-visual-properties',
      capabilityId: VISUAL_PROPERTIES_PRIMITIVE_ID,
      visualId: added.titleId,
      ...DEFAULT_VISUAL_PROPERTIES,
      transform: { ...DEFAULT_VISUAL_PROPERTIES.transform, scale: 1.25 },
      extensions: {},
    })
    project = accept(project, {
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: ids.operation(),
      kind: 'set-visual-properties',
      capabilityId: VISUAL_PROPERTIES_PRIMITIVE_ID,
      visualId: added.titleId,
      ...DEFAULT_VISUAL_PROPERTIES,
      transform: { ...DEFAULT_VISUAL_PROPERTIES.transform, scale: 1.5 },
      extensions: {},
    })

    const selected = itemId(project, (item) => item.kind === 'title')
    expect(resolve(project, selected)).toMatchObject({
      kind: 'title',
      visualProperties: { transform: { scale: 1.5 } },
    })
  })

  it('keeps human-readable labels stable without exposing clip suffixes', () => {
    const project = splitProject(testProject(), 10, createIds())
    const model = modelFor(project, null)
    const labels = model.lanes.flatMap((lane) => lane.items.map((item) => item.label))
    expect(labels).toContain('owner.mp4')
    expect(labels).toContain('Dialogue · owner.mp4')
    expect(labels.some((label) => /^Clip [a-z0-9]+$/i.test(label))).toBe(false)
    expect(labels.some((label) => /^Dialogue [a-z0-9]+$/i.test(label))).toBe(false)
  })

  it('does not mutate the project, timeline, pending proposal, or asset labels', () => {
    const project = projectWithAllTimelineFamilies()
    const pending: PendingTimelineInput = Object.freeze({
      proposalId: 'proposal_immutable',
      baseRevision: project.revision,
      operations: Object.freeze([nameplate('operation_pending1')]),
    })
    const model = modelFor(project, null, pending)
    const selected = model.lanes.flatMap((lane) => lane.items).find((item) => item.kind === 'title')?.id ?? null
    const before = [JSON.stringify(project), JSON.stringify(model), JSON.stringify(pending), JSON.stringify(ASSET_LABELS)]

    resolve(project, selected, pending, modelFor(project, selected, pending))

    expect([JSON.stringify(project), JSON.stringify(model), JSON.stringify(pending), JSON.stringify(ASSET_LABELS)]).toEqual(before)
  })
})
