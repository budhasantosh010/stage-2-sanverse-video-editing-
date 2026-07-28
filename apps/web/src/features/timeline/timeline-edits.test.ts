import { describe, expect, it } from 'vitest'

import {
  applyTimelineOperation,
  effectiveComposition,
  type Composition,
  type TimelineOperation,
} from '@sanverse/edit-domain'

import { testAsset, testProject } from '../../test-fixtures'
import {
  buildRemoveAtPlayhead,
  buildSetEnabledAtPlayhead,
  buildSplitAtPlayhead,
  timelineBlocks,
} from './timeline-edits'

const S = 1_440_000
const asset = testAsset()
const base = effectiveComposition(testProject())

let counter = 0
const operationId = () => `operation_test${String(counter += 1).padStart(4, '0')}`
const clipId = () => `clip_test${String(counter += 1).padStart(4, '0')}`

const applied = (composition: Composition, operation: TimelineOperation): Composition => {
  const result = applyTimelineOperation(composition, operation, [asset])
  if (!result.ok) throw new Error(`apply failed: ${JSON.stringify(result.error)}`)
  return result.value
}

describe('cutting at the playhead', () => {
  it('cuts the section the playhead is inside, at the playhead', () => {
    const result = buildSplitAtPlayhead(base, 12 * S, operationId, clipId)
    expect(result.ok).toBe(true)
    if (!result.ok || result.operation.kind !== 'split-clip') return
    expect(result.operation.atClipTime.ticks).toBe(12 * S)

    // And it really applies: the strip now has two sections meeting at 12 s.
    const next = applied(base, result.operation)
    const blocks = timelineBlocks(next, 30 * S)
    expect(blocks).toHaveLength(2)
    expect(blocks[1].startTicks).toBe(12 * S)
  })

  it('measures the cut from the start of that section, not from the start of the video', () => {
    const first = buildSplitAtPlayhead(base, 10 * S, operationId, clipId)
    if (!first.ok) throw new Error('setup failed')
    const twoSections = applied(base, first.operation)

    const second = buildSplitAtPlayhead(twoSections, 25 * S, operationId, clipId)
    expect(second.ok).toBe(true)
    if (!second.ok || second.operation.kind !== 'split-clip') return
    // 25 s of the finished video is 15 s into the second section.
    expect(second.operation.atClipTime.ticks).toBe(15 * S)
  })

  it('says plainly that the edge of a section is not a cut', () => {
    const result = buildSplitAtPlayhead(base, 0, operationId, clipId)
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.refusal.reason).toMatch(/edge of a section/i)
  })

  it('gives every cut its own identifiers, so two cuts cannot collide', () => {
    const first = buildSplitAtPlayhead(base, 10 * S, operationId, clipId)
    const second = buildSplitAtPlayhead(base, 20 * S, operationId, clipId)
    if (!first.ok || !second.ok) throw new Error('setup failed')
    expect(first.operation.operationId).not.toBe(second.operation.operationId)
    if (first.operation.kind !== 'split-clip' || second.operation.kind !== 'split-clip') return
    expect(first.operation.newClipId).not.toBe(second.operation.newClipId)
  })
})

describe('removing at the playhead', () => {
  it('removes the section under the playhead and closes the gap', () => {
    const split = buildSplitAtPlayhead(base, 10 * S, operationId, clipId)
    if (!split.ok) throw new Error('setup failed')
    const twoSections = applied(base, split.operation)

    const remove = buildRemoveAtPlayhead(twoSections, 2 * S, operationId)
    expect(remove.ok).toBe(true)
    if (!remove.ok || remove.operation.kind !== 'remove-clip') return
    expect(remove.operation.ripple).toBe(true)

    const next = applied(twoSections, remove.operation)
    const blocks = timelineBlocks(next, 20 * S)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].startTicks).toBe(0)
  })

  it('refuses to remove the last section, and says why', () => {
    const result = buildRemoveAtPlayhead(base, 5 * S, operationId)
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.refusal.reason).toMatch(/only section/i)
  })
})

describe('hiding at the playhead', () => {
  it('refuses to hide the only section that is showing', () => {
    const result = buildSetEnabledAtPlayhead(base, 5 * S, false, operationId)
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.refusal.reason).toMatch(/only section showing/i)
  })

  it('hides a section once there is more than one', () => {
    const split = buildSplitAtPlayhead(base, 10 * S, operationId, clipId)
    if (!split.ok) throw new Error('setup failed')
    const twoSections = applied(base, split.operation)

    const hide = buildSetEnabledAtPlayhead(twoSections, 2 * S, false, operationId)
    expect(hide.ok).toBe(true)
    if (!hide.ok) return
    const next = applied(twoSections, hide.operation)
    expect(timelineBlocks(next, 30 * S)[0].enabled).toBe(false)
  })
})

describe('drawing the strip', () => {
  it('gives each section its share of the width, summing to the whole', () => {
    const split = buildSplitAtPlayhead(base, 10 * S, operationId, clipId)
    if (!split.ok) throw new Error('setup failed')
    const blocks = timelineBlocks(applied(base, split.operation), 30 * S)
    expect(blocks[0].widthPercent).toBeCloseTo(100 / 3, 6)
    expect(blocks[1].leftPercent).toBeCloseTo(100 / 3, 6)
    expect(blocks[0].widthPercent + blocks[1].widthPercent).toBeCloseTo(100, 6)
  })

  it('returns nothing rather than dividing by zero for an empty video', () => {
    expect(timelineBlocks(base, 0)).toEqual([])
  })
})
