import { describe, expect, it } from 'vitest'

import { effectiveComposition, validateOperation } from '@sanverse/edit-domain'

import { TEST_CLIP_ID, testProject } from '../../test-fixtures'
import { adaptTimelineGesture } from './timeline-gesture-adapter'
import { S, createIds, splitProject, ticks } from './timeline-test-fixtures'

const fixedFactories = () => ({
  createOperationId: () => 'operation_fixed001',
  createClipId: () => 'clip_fixed001',
})

const adapt = (
  project: ReturnType<typeof testProject>,
  gesture: Parameters<typeof adaptTimelineGesture>[0]['gesture'],
  overrides: Partial<Parameters<typeof adaptTimelineGesture>[0]> = {},
) => adaptTimelineGesture({
  project,
  gesture,
  ...fixedFactories(),
  pendingProposalExists: false,
  exportInProgress: false,
  ...overrides,
})

describe('timeline gesture adapter', () => {
  it('emits the existing split operation for a valid split', () => {
    const result = adapt(testProject(), { type: 'split', atTicks: ticks(10) })
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.kind !== 'split-clip') return
    expect(result.value.clipId).toBe(TEST_CLIP_ID)
    expect(result.value.atClipTime.ticks).toBe(ticks(10))
    expect(result.value.newClipId).toBe('clip_fixed001')
  })

  it('refuses a split outside the composition', () => {
    const result = adapt(testProject(), { type: 'split', atTicks: ticks(31) })
    expect(result).toMatchObject({ ok: false, error: { code: 'NO_TARGET' } })
  })

  it('refuses a split on a half-open clip boundary', () => {
    const result = adapt(testProject(), { type: 'split', atTicks: 0 })
    expect(result).toMatchObject({ ok: false, error: { code: 'GESTURE_OUT_OF_RANGE' } })
  })

  it('emits ripple and gap-preserving remove operations', () => {
    const project = splitProject(testProject(), 10, createIds())
    const ripple = adapt(project, { type: 'remove-ripple', atTicks: ticks(2) })
    const gap = adapt(project, { type: 'remove-gap', atTicks: ticks(2) })
    expect(ripple.ok && ripple.value.kind === 'remove-clip' ? ripple.value.ripple : null).toBe(true)
    expect(gap.ok && gap.value.kind === 'remove-clip' ? gap.value.ripple : null).toBe(false)
  })

  it('refuses removing the only clip through the current domain policy', () => {
    const result = adapt(testProject(), { type: 'remove-ripple', atTicks: ticks(2) })
    expect(result).toMatchObject({ ok: false, error: { code: 'DOMAIN_REFUSAL' } })
  })

  it('emits trim-start and trim-end operations for a named clip', () => {
    const start = adapt(testProject(), { type: 'trim-start', clipId: TEST_CLIP_ID, deltaTicks: ticks(2) })
    const end = adapt(testProject(), { type: 'trim-end', clipId: TEST_CLIP_ID, deltaTicks: ticks(3) })
    expect(start.ok && start.value.kind === 'trim-clip' ? start.value.trimStart.ticks : null).toBe(ticks(2))
    expect(start.ok && start.value.kind === 'trim-clip' ? start.value.trimEnd.ticks : null).toBe(0)
    expect(end.ok && end.value.kind === 'trim-clip' ? end.value.trimEnd.ticks : null).toBe(ticks(3))
  })

  it('refuses an excessive trim', () => {
    const result = adapt(testProject(), { type: 'trim-start', clipId: TEST_CLIP_ID, deltaTicks: 30 * S })
    expect(result).toMatchObject({ ok: false, error: { code: 'DOMAIN_REFUSAL' } })
  })

  it('refuses an unknown clip', () => {
    const result = adapt(testProject(), { type: 'trim-start', clipId: 'clip_missing00', deltaTicks: S })
    expect(result).toMatchObject({ ok: false, error: { code: 'CLIP_UNKNOWN' } })
  })

  it('emits set-enabled for a valid section', () => {
    const project = splitProject(testProject(), 10, createIds())
    const clipId = effectiveComposition(project).tracks[0].clips[0].clipId
    const result = adapt(project, { type: 'set-enabled', clipId, enabled: false })
    expect(result.ok && result.value.kind === 'set-clip-enabled' ? result.value.enabled : null).toBe(false)
  })

  it('emits move-earlier and move-later through the existing reorder builder', () => {
    const project = splitProject(testProject(), 10, createIds())
    const clips = effectiveComposition(project).tracks[0].clips
      .slice()
      .sort((left, right) => left.compositionStart.ticks - right.compositionStart.ticks)
    const earlier = adapt(project, { type: 'move-earlier', clipId: clips[1].clipId })
    const later = adapt(project, { type: 'move-later', clipId: clips[0].clipId })
    expect(earlier.ok && earlier.value.kind === 'reorder-clip' ? earlier.value.toIndex : null).toBe(0)
    expect(later.ok && later.value.kind === 'reorder-clip' ? later.value.toIndex : null).toBe(1)
  })

  it('refuses moving the first earlier or the last later', () => {
    const project = splitProject(testProject(), 10, createIds())
    const clips = effectiveComposition(project).tracks[0].clips
      .slice()
      .sort((left, right) => left.compositionStart.ticks - right.compositionStart.ticks)
    expect(adapt(project, { type: 'move-earlier', clipId: clips[0].clipId })).toMatchObject({
      ok: false,
      error: { code: 'DOMAIN_REFUSAL' },
    })
    expect(adapt(project, { type: 'move-later', clipId: clips[1].clipId })).toMatchObject({
      ok: false,
      error: { code: 'DOMAIN_REFUSAL' },
    })
  })

  it('emits existing clip gain and fade values', () => {
    const result = adapt(testProject(), {
      type: 'set-audio',
      clipId: TEST_CLIP_ID,
      gainDb: -6,
      fadeInTicks: ticks(2),
      fadeOutTicks: ticks(3),
    })
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.kind !== 'set-clip-audio') return
    expect(result.value.gainDb).toBe(-6)
    expect(result.value.fadeIn.ticks).toBe(ticks(2))
    expect(result.value.fadeOut.ticks).toBe(ticks(3))
  })

  it('refuses out-of-range gain and excessive fades', () => {
    expect(adapt(testProject(), {
      type: 'set-audio',
      clipId: TEST_CLIP_ID,
      gainDb: 99,
      fadeInTicks: 0,
      fadeOutTicks: 0,
    })).toMatchObject({ ok: false, error: { code: 'DOMAIN_REFUSAL' } })

    expect(adapt(testProject(), {
      type: 'set-audio',
      clipId: TEST_CLIP_ID,
      gainDb: 0,
      fadeInTicks: ticks(20),
      fadeOutTicks: ticks(20),
    })).toMatchObject({ ok: false, error: { code: 'DOMAIN_REFUSAL' } })
  })

  it('refuses direct edits while a proposal is pending', () => {
    const result = adapt(testProject(), { type: 'split', atTicks: ticks(10) }, { pendingProposalExists: true })
    expect(result).toMatchObject({ ok: false, error: { code: 'PROPOSAL_PENDING' } })
  })

  it('refuses direct edits while export is in progress', () => {
    const result = adapt(testProject(), { type: 'split', atTicks: ticks(10) }, { exportInProgress: true })
    expect(result).toMatchObject({ ok: false, error: { code: 'EXPORT_IN_PROGRESS' } })
  })

  it('uses supplied factories exactly once and preserves their identifiers', () => {
    let operationCalls = 0
    let clipCalls = 0
    const result = adaptTimelineGesture({
      project: testProject(),
      gesture: { type: 'split', atTicks: ticks(10) },
      createOperationId: () => {
        operationCalls += 1
        return 'operation_exact001'
      },
      createClipId: () => {
        clipCalls += 1
        return 'clip_exact001'
      },
      pendingProposalExists: false,
      exportInProgress: false,
    })
    expect(result.ok).toBe(true)
    expect(operationCalls).toBe(1)
    expect(clipCalls).toBe(1)
    if (!result.ok || result.value.kind !== 'split-clip') return
    expect(result.value.operationId).toBe('operation_exact001')
    expect(result.value.newClipId).toBe('clip_exact001')
  })

  it('does not mutate revision, accepted history, or redo state', () => {
    const project = testProject()
    const before = JSON.stringify(project)
    const result = adapt(project, { type: 'split', atTicks: ticks(10) })
    expect(result.ok).toBe(true)
    expect(JSON.stringify(project)).toBe(before)
    expect(project.revision).toBe(0)
    expect(project.changeSets).toEqual([])
    expect(project.redoStack).toEqual([])
  })

  it('returns operations that pass the current domain validator', () => {
    const result = adapt(testProject(), { type: 'split', atTicks: ticks(10) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(validateOperation(result.value).ok).toBe(true)
  })
})
