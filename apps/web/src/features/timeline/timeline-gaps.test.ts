import { describe, expect, it } from 'vitest'

import { acceptChangeSet, createIdFactory, effectiveComposition, type EditProject } from '@sanverse/edit-domain'

import {
  gapDescription,
  gapDurationLabel,
  gapSnapTicks,
  isGapItem,
  parseGapItemId,
  planCloseGap,
} from './timeline-gaps'
import { buildTimelineViewModel } from './timeline-view-model'
import { allTimelineItems } from './timeline-selection-v2'
import { removedProject, ticks } from './timeline-test-fixtures'

const CHANGE_SET_ID = 'changeset_gap000001'

/** A project with a genuine hole in it: a clip removed without closing the gap. */
const withAHole = (): EditProject => removedProject(false)

const gapItem = (project: EditProject) => {
  const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
  return allTimelineItems(model).find(isGapItem) ?? null
}

const close = (project: EditProject, gapItemId: string, overrides = {}) => planCloseGap({
  project,
  gapItemId,
  lockedTrackIds: [],
  pendingProposalExists: false,
  exportInProgress: false,
  expectedRevision: project.revision,
  ids: createIdFactory(CHANGE_SET_ID),
  ...overrides,
})

describe('T1.13 a hole is a thing you can point at', () => {
  it('recognises a hole and takes its identity apart', () => {
    const project = withAHole()
    const gap = gapItem(project)
    expect(gap).not.toBeNull()
    if (!gap) return
    const parsed = parseGapItemId(gap.id)
    expect(parsed).not.toBeNull()
    if (!parsed) return
    expect(parsed.startTicks).toBe(gap.startTicks)
    expect(parsed.durationTicks).toBe(gap.durationTicks)
  })

  it('answers null for anything that is not a hole', () => {
    expect(parseGapItemId('clip:clip_aaaaaaaa')).toBeNull()
    expect(parseGapItemId('overlay:broll_x:0')).toBeNull()
    expect(parseGapItemId('')).toBeNull()
  })

  it('says how long it is in seconds, never in ticks', () => {
    // "0.3 seconds" is something a person can act on. "432,000 ticks" is not.
    expect(gapDurationLabel(ticks(1.5))).toBe('1.5 seconds')
    expect(gapDurationLabel(10)).toMatch(/less than a tenth/)
  })

  it('never describes itself as media', () => {
    /*
     * The rule this file exists to keep. A user who sees something that looks
     * like a clip and finds silence in their export has been lied to, and from
     * then on they cannot trust any of it.
     */
    const project = withAHole()
    const gap = gapItem(project)
    if (!gap) throw new Error('fixture has no hole')
    const said = gapDescription(gap)
    expect(said).toMatch(/Nothing plays here/)
    expect(said).toMatch(/Empty space/)
    expect(gap.assetId).toBeNull()
    expect(gap.clipId).toBeNull()
    expect(gap.enabled).toBe(false)
  })

  it('offers both of its edges to snap to', () => {
    const project = withAHole()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const gap = gapItem(project)
    if (!gap) throw new Error('fixture has no hole')
    const snaps = gapSnapTicks(allTimelineItems(model))
    expect(snaps).toContain(gap.startTicks)
    expect(snaps).toContain(gap.startTicks + gap.durationTicks)
  })
})

describe('T1.13 closing a hole', () => {
  it('pulls EVERY later clip back, not just the next one', () => {
    /*
     * Moving only the next clip would close this hole and open an identical one
     * immediately after it. The user would watch the hole appear to jump one
     * clip to the right and conclude the button was broken.
     */
    const project = withAHole()
    const gap = gapItem(project)
    if (!gap) throw new Error('fixture has no hole')
    const result = close(project, gap.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const before = effectiveComposition(project).tracks.flatMap((track) => track.clips)
    const later = before.filter((clip) => clip.compositionStart.ticks >= gap.startTicks + gap.durationTicks)
    expect(result.operations.length).toBe(later.length)
  })

  it('leaves no hole behind, and is ONE Undo', () => {
    const project = withAHole()
    const gap = gapItem(project)
    if (!gap) throw new Error('fixture has no hole')
    const result = close(project, gap.id)
    if (!result.ok) throw new Error(`refused: ${result.refusal.message}`)

    const accepted = acceptChangeSet(project, {
      schemaVersion: 'sanverse.change-set/v1',
      changeSetId: CHANGE_SET_ID,
      baseRevision: project.revision,
      operations: result.operations,
      provenance: { source: 'direct', requestId: null },
      extensions: {},
    } as never)
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    // One revision for the whole thing, however many clips had to move.
    expect(accepted.value.revision).toBe(project.revision + 1)
    expect(gapItem(accepted.value)).toBeNull()
  })

  it('refuses a hole at the very end, because that is where the video stopped', () => {
    const project = withAHole()
    const composition = effectiveComposition(project)
    const end = composition.tracks
      .flatMap((track) => track.clips)
      .reduce((last, clip) => Math.max(last, clip.compositionStart.ticks + clip.sourceRange.duration.ticks), 0)
    const result = close(project, `gap:lane:video:${end}:${ticks(2)}`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toMatch(/nothing after that empty space/i)
  })

  it('refuses a locked video track and names the padlock', () => {
    const project = withAHole()
    const gap = gapItem(project)
    if (!gap) throw new Error('fixture has no hole')
    const result = close(project, gap.id, { lockedTrackIds: ['V1'] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toContain('V1')
  })

  it('refuses while a suggestion is on screen, or an export is running, or the project moved', () => {
    const project = withAHole()
    const gap = gapItem(project)
    if (!gap) throw new Error('fixture has no hole')
    expect(close(project, gap.id, { pendingProposalExists: true }).ok).toBe(false)
    expect(close(project, gap.id, { exportInProgress: true }).ok).toBe(false)
    expect(close(project, gap.id, { expectedRevision: project.revision - 1 }).ok).toBe(false)
  })

  it('refuses an id that is not a hole at all', () => {
    const project = withAHole()
    expect(close(project, 'clip:clip_aaaaaaaa').ok).toBe(false)
  })

  it('never says a reason code out loud', () => {
    const project = withAHole()
    const result = close(project, 'clip:clip_aaaaaaaa')
    if (result.ok) return
    expect(result.refusal.message).not.toMatch(/[A-Z]{2,}_[A-Z]/)
  })
})
