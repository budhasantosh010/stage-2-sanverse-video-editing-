import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VISUAL_PROPERTIES,
  OPERATION_SCHEMA_VERSION,
  VISUAL_PROPERTIES_PRIMITIVE_ID,
  effectiveComposition,
} from '@sanverse/edit-domain'

import { TEST_CLIP_ID, testProject } from '../../test-fixtures'
import { buildRemoveAtPlayhead } from './timeline-edits'
import {
  S,
  acceptOperation,
  addFixtureAsset,
  audioAdjustedProject,
  blockedPlacementProject,
  createIds,
  disabledProject,
  imageAsset,
  largeTimelineProject,
  musicAsset,
  nameplate,
  projectWithAllTimelineFamilies,
  removedProject,
  reorderedProject,
  splitPlacementProject,
  splitProject,
  ticks,
  title,
} from './timeline-test-fixtures'
import { buildTimelineViewModel, validateTimelineViewModel } from './timeline-view-model'
import type { PendingTimelineInput, TimelineLaneView, TimelineViewModel as PresentationModel } from './timeline-contract'

const build = (
  project = testProject(),
  pending: PendingTimelineInput | null = null,
  selectedItemId: string | null = null,
) => buildTimelineViewModel({ project, pending, selectedItemId })

const lane = (model: PresentationModel, id: string): TimelineLaneView => {
  const found = model.lanes.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`lane missing: ${id}`)
  return found
}

const allItems = (model: PresentationModel) => model.lanes.flatMap((candidate) => candidate.items)

describe('timeline view-model contract', () => {
  it('projects an untouched project into five deterministic semantic lanes', () => {
    const model = build()
    expect(model.lanes.map((item) => [item.id, item.kind, item.label, item.order])).toEqual([
      ['lane:overlay', 'overlay', 'V2', 0],
      ['lane:video', 'video', 'V1', 1],
      ['lane:caption', 'caption', 'C1', 2],
      ['lane:dialogue', 'dialogue', 'A1', 3],
      ['lane:music', 'music', 'A2', 4],
    ])
    expect(lane(model, 'lane:video').items).toHaveLength(1)
    expect(lane(model, 'lane:video').items[0]).toMatchObject({
      id: `clip:${TEST_CLIP_ID}`,
      startTicks: 0,
      durationTicks: 30 * S,
      sourceStartTicks: 0,
      sourceDurationTicks: 30 * S,
      enabled: true,
    })
    expect(model.diagnostics).toEqual([])
  })

  it('uses the effective composition and gives split clips stable items', () => {
    const project = splitProject(testProject(), 10, createIds())
    const first = build(project)
    const second = build(project)
    const items = lane(first, 'lane:video').items.filter((item) => item.kind === 'clip')
    expect(items).toHaveLength(2)
    expect(items.map((item) => [item.startTicks, item.durationTicks])).toEqual([
      [0, 10 * S],
      [10 * S, 20 * S],
    ])
    expect(items.map((item) => item.id)).toEqual(
      lane(second, 'lane:video').items.filter((item) => item.kind === 'clip').map((item) => item.id),
    )
  })

  it('mirrors video clips into dialogue without creating new project facts', () => {
    const project = splitProject(testProject(), 10, createIds())
    const model = build(project)
    const video = lane(model, 'lane:video').items.filter((item) => item.kind === 'clip')
    const dialogue = lane(model, 'lane:dialogue').items
    expect(dialogue).toHaveLength(video.length)
    expect(dialogue.map((item) => [item.linkedClipId, item.startTicks, item.durationTicks])).toEqual(
      video.map((item) => [item.clipId, item.startTicks, item.durationTicks]),
    )
  })

  it('derives an explicit gap when removal preserves empty space', () => {
    const model = build(removedProject(false))
    expect(lane(model, 'lane:video').items.filter((item) => item.kind === 'gap')).toEqual([
      expect.objectContaining({
        id: `gap:lane:video:0:${10 * S}`,
        startTicks: 0,
        durationTicks: 10 * S,
        enabled: false,
      }),
    ])
  })

  it('does not invent a gap for ripple removal', () => {
    const model = build(removedProject(true))
    expect(lane(model, 'lane:video').items.some((item) => item.kind === 'gap')).toBe(false)
    expect(lane(model, 'lane:video').items.find((item) => item.kind === 'clip')?.startTicks).toBe(0)
  })

  it('keeps a disabled clip represented and disabled', () => {
    const model = build(disabledProject())
    const clips = lane(model, 'lane:video').items.filter((item) => item.kind === 'clip')
    expect(clips).toHaveLength(2)
    expect(clips.some((item) => item.enabled === false)).toBe(true)
    expect(lane(model, 'lane:dialogue').items.some((item) => item.enabled === false)).toBe(true)
  })

  it('projects reordered clips in current composition order', () => {
    const project = reorderedProject()
    const expected = effectiveComposition(project).tracks[0].clips
      .slice()
      .sort((left, right) => left.compositionStart.ticks - right.compositionStart.ticks)
      .map((clip) => clip.clipId)
    const actual = lane(build(project), 'lane:video').items
      .filter((item) => item.kind === 'clip')
      .map((item) => item.clipId)
    expect(actual).toEqual(expected)
  })

  it('projects gain and fade state onto video and dialogue items', () => {
    const model = build(audioAdjustedProject())
    for (const id of ['lane:video', 'lane:dialogue']) {
      expect(lane(model, id).items[0]).toMatchObject({
        gainDb: -6,
        fadeInTicks: 2 * S,
        fadeOutTicks: 3 * S,
      })
    }
  })
})

describe('captions, overlays, and music', () => {
  it('projects every accepted current family into the correct lane', () => {
    const model = build(projectWithAllTimelineFamilies())
    expect(lane(model, 'lane:caption').items.map((item) => item.kind)).toEqual(['caption'])
    const overlayKinds = lane(model, 'lane:overlay').items.map((item) => item.kind)
    expect(overlayKinds).toContain('nameplate')
    expect(overlayKinds).toContain('title')
    expect(overlayKinds).toContain('callout')
    expect(overlayKinds.filter((kind) => kind === 'media-overlay')).toHaveLength(2)
    expect(lane(model, 'lane:music').items).toEqual([
      expect.objectContaining({
        kind: 'music',
        startTicks: 0,
        durationTicks: 30 * S,
        gainDb: -18,
        fadeInTicks: S,
        fadeOutTicks: S,
      }),
    ])
  })

  it('does not put unused media assets on the timeline', () => {
    let project = addFixtureAsset(testProject(), imageAsset())
    project = addFixtureAsset(project, musicAsset())
    const model = build(project)
    expect(lane(model, 'lane:overlay').items).toEqual([])
    expect(lane(model, 'lane:music').items).toEqual([])
  })

  it('splits a source-anchored item into deterministic placements after a cut', () => {
    const project = splitPlacementProject()
    const first = build(project)
    const second = build(project)
    const items = lane(first, 'lane:overlay').items.filter((item) => item.kind === 'nameplate')
    expect(items).toHaveLength(2)
    expect(items.map((item) => [item.startTicks, item.durationTicks])).toEqual([
      [8 * S, 2 * S],
      [10 * S, 2 * S],
    ])
    expect(items.map((item) => item.id)).toEqual(
      lane(second, 'lane:overlay').items.map((item) => item.id),
    )
  })

  it('moves a surviving source-anchored item with footage after ripple deletion', () => {
    const ids = createIds()
    let project = testProject()
    project = acceptOperation(project, nameplate(ids.operation(), 12, 2, 'Moves with footage'))
    project = splitProject(project, 10, ids)
    const remove = buildRemoveAtPlayhead(effectiveComposition(project), ticks(2), ids.operation, true)
    if (!remove.ok) throw new Error(remove.refusal.reason)
    project = acceptOperation(project, remove.operation)
    const item = lane(build(project), 'lane:overlay').items.find((candidate) => candidate.kind === 'nameplate')
    expect(item?.startTicks).toBe(2 * S)
    expect(item?.sourceStartTicks).toBe(12 * S)
  })

  it('does not show a deleted source placement as successful content', () => {
    const model = build(blockedPlacementProject())
    expect(lane(model, 'lane:overlay').items).toEqual([])
    expect(model.diagnostics).toEqual([
      expect.objectContaining({ code: 'OPERATION_BLOCKED' }),
    ])
    // The notice says what happened to their video, not what we called it.
    // It used to read "add-nameplate is blocked: SOURCE_SPAN_REMOVED." — our
    // internal name for the edit and our internal name for the reason, neither
    // of which means anything to the person reading it.
    const [notice] = model.diagnostics
    expect(notice.message).toContain('cut out')
    expect(notice.message).not.toMatch(/[A-Z]{2,}_[A-Z]/)
    expect(notice.message).not.toContain('add-nameplate')
  })
})

describe('detached proposals and diagnostics', () => {
  it('adds a current pending nameplate as proposed without changing committed items', () => {
    const project = testProject()
    const proposalOperation = nameplate('operation_proposal1', 2, 3, 'Proposed only')
    const pending: PendingTimelineInput = {
      proposalId: 'proposal_0001',
      baseRevision: project.revision,
      operations: [proposalOperation],
    }
    const without = build(project)
    const withProposal = build(project, pending)
    expect(lane(withProposal, 'lane:overlay').items).toEqual([
      expect.objectContaining({
        id: 'proposal:proposal_0001:operation_proposal1:0',
        state: 'proposed',
        proposalBaseRevision: project.revision,
      }),
    ])
    expect(lane(withProposal, 'lane:video').items).toEqual(lane(without, 'lane:video').items)
    expect(project.changeSets).toEqual([])
  })

  it('diagnoses a stale proposal and displays no current ghost', () => {
    const project = splitProject(testProject(), 10, createIds())
    const pending: PendingTimelineInput = {
      proposalId: 'proposal_stale',
      baseRevision: project.revision - 1,
      operations: [nameplate('operation_stale001')],
    }
    const model = build(project, pending)
    expect(lane(model, 'lane:overlay').items).toEqual([])
    expect(model.diagnostics).toEqual([
      expect.objectContaining({ code: 'PROPOSAL_STALE', operationId: 'operation_stale001' }),
    ])
  })

  it('says nothing at all about a visual adjustment having no lane yet', () => {
    const ids = createIds()
    const nameplateOperation = nameplate(ids.operation())
    let project = acceptOperation(testProject(), nameplateOperation)
    project = acceptOperation(project, {
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: ids.operation(),
      kind: 'set-visual-properties',
      capabilityId: VISUAL_PROPERTIES_PRIMITIVE_ID,
      visualId: nameplateOperation.operationId,
      ...DEFAULT_VISUAL_PROPERTIES,
      extensions: {},
    })
    // This used to raise one notice per adjustment reading "Visual-property
    // keyframes and effects do not have a P1-A timeline lane." Every word of it
    // was about our own unfinished work: "P1-A" is a build stage, and nothing
    // was actually wrong — the adjustment worked, the preview shows it, and the
    // export includes it. Repeating it taught the user that their project was
    // full of problems, so real problems stopped standing out.
    expect(build(project).diagnostics).toEqual([])
  })
})

describe('identity, selection, immutability, and scale', () => {
  it('keeps a repaired title under the same stable presentation ID', () => {
    const ids = createIds()
    const added = title(ids.operation())
    let project = acceptOperation(testProject(), added)
    const before = lane(build(project), 'lane:overlay').items[0]
    project = acceptOperation(project, {
      ...added,
      operationId: ids.operation(),
      kind: 'set-title',
      headline: 'Repaired title',
    })
    const after = lane(build(project), 'lane:overlay').items[0]
    expect(after.id).toBe(before.id)
    expect(after.id).toBe(`overlay:${added.titleId}:0`)
    expect(after.operationId).not.toBe(before.operationId)
    expect(after.label).toBe('Repaired title')
  })

  it('keeps all lane and item IDs unique and stable across repeated builds', () => {
    const project = projectWithAllTimelineFamilies()
    const first = build(project)
    const second = build(project)
    const laneIds = first.lanes.map((item) => item.id)
    const itemIds = allItems(first).map((item) => item.id)
    expect(new Set(laneIds).size).toBe(laneIds.length)
    expect(new Set(itemIds).size).toBe(itemIds.length)
    expect(second.lanes.map((item) => item.id)).toEqual(laneIds)
    expect(allItems(second).map((item) => item.id)).toEqual(itemIds)
  })

  it('reflects a known selection and clears an unknown one', () => {
    const selected = `clip:${TEST_CLIP_ID}`
    const known = build(testProject(), null, selected)
    expect(known.selectedItemId).toBe(selected)
    expect(allItems(known).find((item) => item.id === selected)?.selected).toBe(true)

    const unknown = build(testProject(), null, 'clip:missing')
    expect(unknown.selectedItemId).toBeNull()
    expect(allItems(unknown).some((item) => item.selected)).toBe(false)
  })

  it('does not mutate the project or pending proposal', () => {
    const project = projectWithAllTimelineFamilies()
    const pending: PendingTimelineInput = {
      proposalId: 'proposal_immutable',
      baseRevision: project.revision,
      operations: [nameplate('operation_pending1')],
    }
    const projectBefore = JSON.stringify(project)
    const pendingBefore = JSON.stringify(pending)
    build(project, pending)
    expect(JSON.stringify(project)).toBe(projectBefore)
    expect(JSON.stringify(pending)).toBe(pendingBefore)
  })

  it('contains only tick fields for canonical item time', () => {
    const serialized = JSON.stringify(build(projectWithAllTimelineFamilies()))
    expect(serialized).not.toContain('startSeconds')
    expect(serialized).not.toContain('durationSeconds')
    for (const item of allItems(build(projectWithAllTimelineFamilies()))) {
      expect(Number.isSafeInteger(item.startTicks)).toBe(true)
      expect(Number.isSafeInteger(item.durationTicks)).toBe(true)
    }
  })

  it('returns structured diagnostics for zero-duration or outside items', () => {
    const invalid = {
      compositionId: 'composition_aaaaaaaa',
      projectId: 'project_1234567890abcdef',
      projectRevision: 0,
      timescale: S,
      durationTicks: 10,
      selectedItemId: null,
      diagnostics: [],
      lanes: [{
        id: 'lane:video',
        kind: 'video',
        label: 'V1',
        order: 1,
        items: [{
          id: 'clip:bad',
          laneId: 'lane:video',
          kind: 'clip',
          state: 'committed',
          label: 'Bad',
          detail: null,
          startTicks: 11,
          durationTicks: 0,
          enabled: true,
          selected: false,
          blockedReason: null,
          clipId: null,
          linkedClipId: null,
          assetId: null,
          operationId: null,
          changeSetId: null,
          sourceStartTicks: null,
          sourceDurationTicks: null,
          gainDb: null,
          fadeInTicks: null,
          fadeOutTicks: null,
          proposalId: null,
          proposalBaseRevision: null,
        }],
      }],
    } as unknown as PresentationModel
    expect(validateTimelineViewModel(invalid).map((item) => item.code)).toEqual([
      'ITEM_DURATION_INVALID',
      'ITEM_OUTSIDE_COMPOSITION',
    ])
  })

  it('projects the representative 50/100/20/1 fixture deterministically', () => {
    const project = largeTimelineProject()
    const before = JSON.stringify(project)
    const first = build(project)
    const second = build(project)
    expect(lane(first, 'lane:video').items.filter((item) => item.kind === 'clip')).toHaveLength(50)
    expect(lane(first, 'lane:dialogue').items).toHaveLength(50)
    expect(lane(first, 'lane:caption').items).toHaveLength(100)
    expect(lane(first, 'lane:overlay').items).toHaveLength(20)
    expect(lane(first, 'lane:music').items).toHaveLength(1)
    expect(allItems(first)).toHaveLength(221)
    expect(new Set(allItems(first).map((item) => item.id)).size).toBe(221)
    expect(allItems(second).map((item) => item.id)).toEqual(allItems(first).map((item) => item.id))
    first.lanes.forEach((item) => {
      const sorted = item.items.slice().sort((left, right) =>
        left.startTicks - right.startTicks ||
        left.durationTicks - right.durationTicks ||
        left.kind.localeCompare(right.kind) ||
        left.id.localeCompare(right.id),
      )
      expect(item.items).toEqual(sorted)
    })
    expect(JSON.stringify(project)).toBe(before)
  })
})
