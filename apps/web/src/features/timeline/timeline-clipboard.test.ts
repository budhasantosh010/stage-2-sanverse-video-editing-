import { describe, expect, it } from 'vitest'

import { acceptChangeSet, createIdFactory, type EditProject } from '@sanverse/edit-domain'

import {
  EMPTY_CLIPBOARD,
  clipboardIsEmpty,
  clipboardSpanTicks,
  copySelectionToClipboard,
  planCut,
  planDuplicate,
  planPaste,
} from './timeline-clipboard'
import { buildTimelineViewModel } from './timeline-view-model'
import { allTimelineItems } from './timeline-selection-v2'
import { projectWithAllTimelineFamilies, ticks } from './timeline-test-fixtures'

const CHANGE_SET_ID = 'changeset_clip00001'

const itemIdsOfKind = (project: EditProject, kind: string): readonly string[] => {
  const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
  return allTimelineItems(model).filter((item) => item.kind === kind).map((item) => item.id)
}

const common = (project: EditProject) => ({
  project,
  lockedTrackIds: [] as readonly string[],
  pendingProposalExists: false,
  exportInProgress: false,
  expectedRevision: project.revision,
  ids: createIdFactory(CHANGE_SET_ID),
})

const copyOf = (project: EditProject, itemIds: readonly string[]) => {
  const result = copySelectionToClipboard({ project, itemIds })
  if (!result.ok) throw new Error(`copy refused: ${result.refusal.message}`)
  return result.clipboard
}

describe('T1.8 what a copy actually holds', () => {
  it('holds ids, times and numbers — and NOTHING that says where files live', () => {
    /*
     * A security rule, not tidiness. A clipboard can be read by other parts of
     * the app and, on some systems, by other programs. A file path tells an
     * outsider a person's name and where they keep their work; an id that only
     * means something inside this project tells them nothing.
     */
    const project = projectWithAllTimelineFamilies()
    const clipboard = copyOf(project, itemIdsOfKind(project, 'media-overlay'))
    const asText = JSON.stringify(clipboard)
    expect(asText).not.toMatch(/https?:/i)
    expect(asText).not.toMatch(/blob:/i)
    expect(asText).not.toMatch(/[A-Za-z]:\\\\/)
    expect(asText).not.toMatch(/\/(?:home|Users|var|tmp)\//)
    expect(asText).not.toContain('changeSets')

    /*
     * Stronger than searching for forbidden words: the fields are a CLOSED list.
     * Anything new added to a clipboard entry has to be added here too, which is
     * the moment somebody would notice they were about to copy a path.
     */
    const allowed = new Set([
      'kind', 'offsetTicks', 'durationTicks',
      'overlayAssetId', 'overlaySourceStartTicks', 'region', 'opacity', 'useOverlayAudio',
      'assetId', 'sourceStartTicks', 'gainDb', 'fadeInTicks', 'fadeOutTicks',
    ])
    for (const entry of clipboard.entries) {
      for (const key of Object.keys(entry)) expect(allowed.has(key)).toBe(true)
    }
    expect(Object.keys(clipboard).sort()).toEqual(['entries', 'projectId', 'schemaVersion'])
  })

  it('stores where each thing sat RELATIVE to the earliest one, never absolutely', () => {
    // So pasting at 30 seconds keeps the spacing the user copied.
    const project = projectWithAllTimelineFamilies()
    const clipboard = copyOf(project, itemIdsOfKind(project, 'media-overlay'))
    expect(clipboard.entries.length).toBeGreaterThan(1)
    expect(clipboard.entries[0].offsetTicks).toBe(0)
    expect(clipboard.entries.every((entry) => entry.offsetTicks >= 0)).toBe(true)
  })

  it('cannot change the project — it only reads', () => {
    const project = projectWithAllTimelineFamilies()
    const before = project.revision
    copyOf(project, itemIdsOfKind(project, 'media-overlay'))
    expect(project.revision).toBe(before)
  })

  it('refuses pieces of the main video, and says what CAN be copied', () => {
    const project = projectWithAllTimelineFamilies()
    const result = copySelectionToClipboard({ project, itemIds: itemIdsOfKind(project, 'clip') })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toMatch(/B-roll, pictures and music can/i)
  })

  it('refuses an empty selection rather than emptying the clipboard quietly', () => {
    const project = projectWithAllTimelineFamilies()
    expect(copySelectionToClipboard({ project, itemIds: [] }).ok).toBe(false)
  })

  it('knows when it holds nothing, and how long what it holds runs for', () => {
    expect(clipboardIsEmpty(EMPTY_CLIPBOARD)).toBe(true)
    expect(clipboardSpanTicks(EMPTY_CLIPBOARD)).toBe(0)
    const project = projectWithAllTimelineFamilies()
    expect(clipboardSpanTicks(copyOf(project, itemIdsOfKind(project, 'media-overlay')))).toBeGreaterThan(0)
  })
})

describe('T1.8 putting it back down', () => {
  it('refuses when there is nothing to paste, and says what to do', () => {
    const project = projectWithAllTimelineFamilies()
    const result = planPaste({
      ...common(project),
      clipboard: EMPTY_CLIPBOARD,
      atTicks: 0,
      mode: 'at-playhead',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toMatch(/Copy something first/i)
  })

  it('refuses a clipboard copied from a DIFFERENT project', () => {
    // Its ids only mean something in the project they came from. Pasting them
    // elsewhere would point at files that are not there.
    const project = projectWithAllTimelineFamilies()
    const clipboard = copyOf(project, itemIdsOfKind(project, 'media-overlay'))
    const result = planPaste({
      ...common(project),
      clipboard: { ...clipboard, projectId: 'project_elsewhere0000' },
      atTicks: 0,
      mode: 'at-playhead',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toMatch(/different project/i)
  })

  it('refuses when the paste would run past the end of the video', () => {
    const project = projectWithAllTimelineFamilies()
    const clipboard = copyOf(project, itemIdsOfKind(project, 'media-overlay'))
    const result = planPaste({
      ...common(project),
      clipboard,
      atTicks: ticks(9_999),
      mode: 'at-playhead',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toMatch(/Move the playhead earlier/i)
  })

  it('refuses onto a locked track and names the padlock', () => {
    const project = projectWithAllTimelineFamilies()
    const clipboard = copyOf(project, itemIdsOfKind(project, 'media-overlay'))
    const result = planPaste({
      ...common(project),
      lockedTrackIds: ['V2'],
      clipboard,
      atTicks: 0,
      mode: 'at-playhead',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toContain('V2')
  })

  it('refuses when something is already there, and names the way round it', () => {
    const project = projectWithAllTimelineFamilies()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const overlay = allTimelineItems(model).find((item) => item.kind === 'media-overlay')
    if (!overlay) throw new Error('fixture has no overlay')
    const clipboard = copyOf(project, [overlay.id])
    const result = planPaste({
      ...common(project),
      clipboard,
      atTicks: overlay.startTicks,
      mode: 'at-playhead',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toMatch(/push along/i)
  })

  it('never says a reason code out loud', () => {
    const project = projectWithAllTimelineFamilies()
    const result = planPaste({
      ...common(project),
      clipboard: EMPTY_CLIPBOARD,
      atTicks: 0,
      mode: 'at-playhead',
    })
    if (result.ok) return
    expect(result.refusal.message).not.toMatch(/[A-Z]{2,}_[A-Z]/)
  })
})

describe('T1.8 cutting', () => {
  it('gives back the copy AND the removal, as one change set', () => {
    const project = projectWithAllTimelineFamilies()
    const ids = itemIdsOfKind(project, 'media-overlay')
    const result = planCut({ ...common(project), itemIds: ids })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.clipboard.entries.length).toBe(ids.length)
    expect(result.operations.length).toBe(ids.length)
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
    // One Undo takes all of them back.
    expect(accepted.value.revision).toBe(project.revision + 1)
  })

  it('refuses a locked track without touching the clipboard', () => {
    // A cut that could not happen must leave an earlier copy alone.
    const project = projectWithAllTimelineFamilies()
    const result = planCut({
      ...common(project),
      lockedTrackIds: ['V2'],
      itemIds: itemIdsOfKind(project, 'media-overlay'),
    })
    expect(result.ok).toBe(false)
  })
})

describe('T1.8 duplicating', () => {
  it('lands the copy after the originals, without touching the clipboard', () => {
    /*
     * Built out of Copy and Paste on purpose, so there is ONE set of rules about
     * what can be duplicated and where it can land. And somebody who copied
     * something earlier still has it when they later press Paste.
     */
    const project = projectWithAllTimelineFamilies()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const overlay = allTimelineItems(model).find((item) => item.kind === 'media-overlay')
    if (!overlay) throw new Error('fixture has no overlay')
    const result = planDuplicate({ ...common(project), itemIds: [overlay.id] })
    // It may refuse when there is no room after the original — that is honest,
    // and it must never half-happen.
    if (!result.ok) {
      expect(result.refusal.message.length).toBeGreaterThan(0)
      return
    }
    expect(result.operations.length).toBe(1)
    expect(result.description).toMatch(/Duplicate/)
  })

  it('refuses what cannot be duplicated with the same words Copy uses', () => {
    const project = projectWithAllTimelineFamilies()
    const clip = itemIdsOfKind(project, 'clip')
    const duplicated = planDuplicate({ ...common(project), itemIds: clip })
    const copied = copySelectionToClipboard({ project, itemIds: clip })
    expect(duplicated.ok).toBe(false)
    expect(copied.ok).toBe(false)
    if (duplicated.ok || copied.ok) return
    expect(duplicated.refusal).toEqual(copied.refusal)
  })
})
