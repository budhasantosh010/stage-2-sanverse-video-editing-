import {
  MEDIA_OVERLAY_PRIMITIVE_ID,
  MUSIC_PRIMITIVE_ID,
  OPERATION_SCHEMA_VERSION,
  OVERLAY_REMOVE_PRIMITIVE_ID,
  PROJECT_TIMESCALE,
  activeOverlayOperations,
  compositionDuration,
  effectiveComposition,
  findAsset,
  validateOperation,
  type EditOperation,
  type EditProject,
  type NormalizedRect,
} from '@sanverse/edit-domain'

import {
  MIN_ITEM_TICKS,
  applyLaneEdits,
  laneSpans,
  parseTimelineItemId,
  sourceMomentAtTicks,
  spansOverlap,
  type LaneEdit,
  type TimelineItemPlanInput,
  type TimelineItemRefusal,
  type TimelineItemRefusalCode,
} from './timeline-item-operations'

/**
 * Copy, cut, paste and duplicate.
 *
 * ## What is actually copied, and what is deliberately NOT
 *
 * The clipboard holds a RECIPE, not the media and not a piece of the project:
 *
 * ```
 *      COPIED                          NEVER COPIED
 *      ──────                          ────────────
 *      which file (its id)             the file's path on disk
 *      how far in it starts            any URL, local or otherwise
 *      how long it runs                any object from the project
 *      where it sat, relative to       the project itself
 *        the earliest copied item      anything the user typed elsewhere
 *      loudness, fades, opacity
 *      the box it is drawn in
 * ```
 *
 * The right-hand column is a security rule, not tidiness. A clipboard can be
 * read by other parts of the app and, on some systems, by other programs. A file
 * path tells an outsider a person's name and where they keep their work. An id
 * that only means something inside this project tells them nothing.
 *
 * ## Relative time, so paste lands where the user is looking
 *
 * Each entry stores how far it sits from the EARLIEST thing copied, not where it
 * was in the video. Paste then puts the earliest thing at the playhead and keeps
 * everybody else at the same distance from it. Copy three clips a second apart,
 * paste at 30 seconds, and they are still a second apart.
 *
 * ```
 *      copied at 10s, 11s, 12s   ──►  offsets 0, 1s, 2s
 *      paste with playhead at 30s ──►  30s, 31s, 32s
 * ```
 *
 * ## Deterministic identities
 *
 * Every pasted thing is named from the change-set id, through the same id
 * factory every other edit uses. Pasting the same clipboard into the same
 * project twice produces different names, which is right — they are different
 * clips. Replaying one saved history produces the same names every time, which
 * is what makes an export repeatable.
 */

export const TIMELINE_CLIPBOARD_SCHEMA_VERSION = 'sanverse.timeline-clipboard/v1'

const time = (ticks: number) => Object.freeze({ ticks, timescale: PROJECT_TIMESCALE })

export type ClipboardEntryV1 =
  | Readonly<{
    kind: 'media-overlay'
    /** How far after the earliest copied item this one sits. Never absolute. */
    offsetTicks: number
    durationTicks: number
    overlayAssetId: string
    overlaySourceStartTicks: number
    region: NormalizedRect
    opacity: number
    useOverlayAudio: boolean
  }>
  | Readonly<{
    kind: 'music'
    offsetTicks: number
    durationTicks: number
    assetId: string
    sourceStartTicks: number
    gainDb: number
    fadeInTicks: number
    fadeOutTicks: number
  }>

/**
 * The same entry, without the field that says where it sits.
 *
 * Written this way rather than as a plain `Omit` because `Omit` over a union
 * collapses it to the fields the two halves share — which would quietly throw
 * away everything that makes a piece of music different from a piece of B-roll.
 */
type WithoutOffset<T> = T extends unknown ? Omit<T, 'offsetTicks'> : never
export type ClipboardEntryDraft = WithoutOffset<ClipboardEntryV1>

export type TimelineClipboardV1 = Readonly<{
  schemaVersion: typeof TIMELINE_CLIPBOARD_SCHEMA_VERSION
  /** Which project this came from. Used only to explain a refusal, never to reach into it. */
  projectId: string
  entries: readonly ClipboardEntryV1[]
}>

export const EMPTY_CLIPBOARD: TimelineClipboardV1 = Object.freeze({
  schemaVersion: TIMELINE_CLIPBOARD_SCHEMA_VERSION,
  projectId: '',
  entries: Object.freeze([]),
})

export const clipboardIsEmpty = (clipboard: TimelineClipboardV1): boolean =>
  clipboard.entries.length === 0

export const clipboardSpanTicks = (clipboard: TimelineClipboardV1): number =>
  clipboard.entries.reduce(
    (longest, entry) => Math.max(longest, entry.offsetTicks + entry.durationTicks),
    0,
  )

export type ClipboardResult =
  | Readonly<{ ok: true; clipboard: TimelineClipboardV1 }>
  | Readonly<{ ok: false; refusal: TimelineItemRefusal }>

const refuseClipboard = (code: TimelineItemRefusalCode, message: string): ClipboardResult =>
  Object.freeze({ ok: false, refusal: Object.freeze({ code, message }) })

/**
 * Take a copy of what is picked.
 *
 * Reads only. It cannot change the project — there is no route by which it
 * could, which is the structural reason a mis-click on Copy can never cost the
 * user anything.
 */
export const copySelectionToClipboard = (input: Readonly<{
  project: EditProject
  itemIds: readonly string[]
}>): ClipboardResult => {
  if (input.itemIds.length === 0) {
    return refuseClipboard('ITEM_UNKNOWN', 'Choose something on the timeline first.')
  }

  const overlays = activeOverlayOperations(input.project)
  const v2 = laneSpans(input.project, 'V2')
  const a2 = laneSpans(input.project, 'A2')

  const gathered: { startTicks: number; entry: ClipboardEntryDraft }[] = []
  const seen = new Set<string>()

  for (const itemId of input.itemIds) {
    const parsed = parseTimelineItemId(itemId)
    if (!parsed) continue
    if (parsed.family === 'clip') {
      // The main recording is the video itself, not something laid on it.
      // Copying a piece of it would mean duplicating footage into the sequence,
      // which is a different feature with different rules about what happens to
      // everything after it.
      return refuseClipboard(
        'OPERATION_UNSUPPORTED',
        'Pieces of the main video cannot be copied yet. B-roll, pictures and music can.',
      )
    }
    if (seen.has(parsed.targetId)) continue
    seen.add(parsed.targetId)

    if (parsed.family === 'music') {
      const operation = overlays.find((each) => each.kind === 'add-music' && each.musicId === parsed.targetId)
      const span = a2.find((each) => each.targetId === parsed.targetId)
      if (!operation || operation.kind !== 'add-music' || !span) continue
      gathered.push({
        startTicks: span.startTicks,
        entry: {
          kind: 'music',
          durationTicks: span.durationTicks,
          assetId: operation.assetId,
          sourceStartTicks: operation.sourceStart.ticks,
          gainDb: operation.gainDb,
          fadeInTicks: operation.fadeIn.ticks,
          fadeOutTicks: operation.fadeOut.ticks,
        },
      })
      continue
    }

    const operation = overlays.find(
      (each) => each.kind === 'add-media-overlay' && each.overlayId === parsed.targetId,
    )
    const span = v2.find((each) => each.targetId === parsed.targetId)
    if (!operation || operation.kind !== 'add-media-overlay' || !span) {
      return refuseClipboard(
        'OPERATION_UNSUPPORTED',
        'Titles and callouts cannot be copied from the timeline yet. B-roll, pictures and music can.',
      )
    }
    gathered.push({
      startTicks: span.startTicks,
      entry: {
        kind: 'media-overlay',
        durationTicks: span.durationTicks,
        overlayAssetId: operation.overlayAssetId,
        overlaySourceStartTicks: operation.overlaySourceStart.ticks,
        region: operation.region,
        opacity: operation.opacity,
        useOverlayAudio: operation.useOverlayAudio,
      },
    })
  }

  if (gathered.length === 0) {
    return refuseClipboard('ITEM_UNKNOWN', 'Nothing that can be copied was picked.')
  }

  const earliest = gathered.reduce((lowest, each) => Math.min(lowest, each.startTicks), Number.MAX_SAFE_INTEGER)
  return Object.freeze({
    ok: true,
    clipboard: Object.freeze({
      schemaVersion: TIMELINE_CLIPBOARD_SCHEMA_VERSION,
      projectId: input.project.projectId,
      entries: Object.freeze(
        gathered
          .map((each) => Object.freeze({ ...each.entry, offsetTicks: each.startTicks - earliest }) as ClipboardEntryV1)
          .sort((left, right) => left.offsetTicks - right.offsetTicks),
      ),
    }),
  })
}

export type PasteMode =
  /** Land it where the playhead is, and refuse if something is already there. */
  | 'at-playhead'
  /** Land it where the playhead is and push everything later on that row along. */
  | 'insert'

export type ClipboardPlan =
  | Readonly<{ ok: true; operations: readonly EditOperation[]; description: string }>
  | Readonly<{ ok: false; refusal: TimelineItemRefusal }>

const refusePlan = (code: TimelineItemRefusalCode, message: string): ClipboardPlan =>
  Object.freeze({ ok: false, refusal: Object.freeze({ code, message }) })

export type PasteInput = Readonly<{
  project: EditProject
  clipboard: TimelineClipboardV1
  atTicks: number
  mode: PasteMode
  lockedTrackIds: readonly string[]
  pendingProposalExists: boolean
  exportInProgress: boolean
  expectedRevision: number
  ids: TimelineItemPlanInput['ids']
}>

/**
 * Put the clipboard down, as ONE change set.
 *
 * Everything pasted arrives together or nothing does. A paste that half-happened
 * would leave the user with some of a group of clips and no way to tell which
 * ones are missing.
 */
export const planPaste = (input: PasteInput): ClipboardPlan => {
  if (input.project.revision !== input.expectedRevision) {
    return refusePlan('PROJECT_STALE', 'The project changed a moment ago. Try pasting again.')
  }
  if (input.pendingProposalExists) {
    return refusePlan('PROPOSAL_PENDING', 'Finish the suggestion on screen before changing the timeline.')
  }
  if (input.exportInProgress) {
    return refusePlan('EXPORT_IN_PROGRESS', 'Wait for the export to finish before changing the timeline.')
  }
  if (clipboardIsEmpty(input.clipboard)) {
    return refusePlan('ITEM_UNKNOWN', 'There is nothing to paste yet. Copy something first.')
  }
  if (input.clipboard.projectId !== input.project.projectId) {
    // The names inside a clipboard entry only mean something in the project they
    // came from. Pasting them elsewhere would point at files that are not there.
    return refusePlan(
      'ITEM_UNKNOWN',
      'That was copied from a different project, so it cannot be pasted here.',
    )
  }

  const needsV2 = input.clipboard.entries.some((entry) => entry.kind === 'media-overlay')
  const needsA2 = input.clipboard.entries.some((entry) => entry.kind === 'music')
  if (needsV2 && input.lockedTrackIds.includes('V2')) {
    return refusePlan('TRACK_LOCKED', 'Track V2 is locked. Unlock it to paste onto it.')
  }
  if (needsA2 && input.lockedTrackIds.includes('A2')) {
    return refusePlan('TRACK_LOCKED', 'Track A2 is locked. Unlock it to paste onto it.')
  }

  const at = Math.max(0, Math.round(input.atTicks))
  const videoTicks = compositionDuration(effectiveComposition(input.project)).ticks
  const totalTicks = clipboardSpanTicks(input.clipboard)
  if (at + totalTicks > videoTicks) {
    return refusePlan(
      'OUT_OF_RANGE',
      'There is not enough video left at that point to paste this. Move the playhead earlier.',
    )
  }

  const operations: EditOperation[] = []
  let slot = 0

  /*
   * INSERT first, if that is the mode.
   *
   * Everything on the affected rows that starts at or after the paste point is
   * pushed along by the whole length of what is being pasted — worked out by
   * `applyLaneEdits`, the same file Insert and Overwrite already use, so the
   * push obeys the same pinning rules as everything else.
   *
   * Pushed FIRST so that the collision check below sees the room that has just
   * been made, rather than the row as it was a moment ago.
   */
  let projectForChecks = input.project
  if (input.mode === 'insert') {
    for (const trackId of ['V2', 'A2'] as const) {
      const relevant = trackId === 'V2' ? needsV2 : needsA2
      if (!relevant) continue
      const spans = laneSpans(input.project, trackId)
      const pushed: LaneEdit[] = spans
        .filter((span) => span.startTicks >= at)
        .map((span) => Object.freeze({
          kind: 'move' as const,
          targetId: span.targetId,
          toStartTicks: span.startTicks + totalTicks,
        }))
      if (pushed.length === 0) continue
      const applied = applyLaneEdits({
        project: input.project,
        trackId,
        edits: pushed,
        ids: input.ids,
        slotOffset: slot,
      })
      if (!applied.ok) {
        return refusePlan(
          applied.refusal.code,
          'There is not enough room to push the later clips along, so nothing was pasted.',
        )
      }
      operations.push(...applied.operations)
      slot += applied.operations.length
    }
    // The room made by the push cannot be seen in `input.project`, which has not
    // been changed. Rather than pretend, the collision check below is skipped
    // for insert: the push is what guarantees the space, and it either worked
    // for every clip or the whole paste was refused a moment ago.
    projectForChecks = input.project
  }

  const v2Spans = input.mode === 'insert' ? [] : laneSpans(projectForChecks, 'V2')
  const a2Spans = input.mode === 'insert' ? [] : laneSpans(projectForChecks, 'A2')
  const placed: { trackId: 'V2' | 'A2'; startTicks: number; durationTicks: number }[] = []

  for (const entry of input.clipboard.entries) {
    const start = at + entry.offsetTicks
    if (entry.durationTicks < MIN_ITEM_TICKS) continue
    const trackId: 'V2' | 'A2' = entry.kind === 'music' ? 'A2' : 'V2'
    const candidate = { startTicks: start, durationTicks: entry.durationTicks }

    const existing = trackId === 'V2' ? v2Spans : a2Spans
    if (existing.some((span) => spansOverlap(span, candidate))) {
      return refusePlan(
        'COLLISION',
        'There is already something there. Move the playhead, or use Paste and push along.',
      )
    }
    if (placed.some((each) => each.trackId === trackId && spansOverlap(each, candidate))) {
      return refusePlan('COLLISION', 'Two of the copied items would land on top of each other.')
    }
    placed.push({ trackId, ...candidate })

    if (entry.kind === 'music') {
      const asset = findAsset(input.project.assets, entry.assetId)
      if (!asset || asset.mediaKind !== 'audio') {
        return refusePlan('ITEM_UNKNOWN', 'The music that was copied is no longer in this project.')
      }
      operations.push(Object.freeze({
        schemaVersion: OPERATION_SCHEMA_VERSION,
        operationId: input.ids.operation(slot),
        kind: 'add-music',
        capabilityId: MUSIC_PRIMITIVE_ID,
        musicId: input.ids.entity('music', slot),
        assetId: entry.assetId,
        compositionStart: time(start),
        sourceStart: time(entry.sourceStartTicks),
        durationTicks: time(entry.durationTicks),
        gainDb: entry.gainDb,
        fadeIn: time(entry.fadeInTicks),
        fadeOut: time(entry.fadeOutTicks),
        extensions: Object.freeze({}),
      }) as unknown as EditOperation)
      slot += 1
      continue
    }

    const asset = findAsset(input.project.assets, entry.overlayAssetId)
    if (!asset) {
      return refusePlan('ITEM_UNKNOWN', 'The clip that was copied is no longer in this project.')
    }
    /*
     * B-roll is pinned to a moment of the FOOTAGE, so a paste has to work out
     * which moment of which recording is under the playhead. If the paste point
     * has a hole in it, or the footage changes partway through, there is no
     * single moment to pin to and the paste is refused with the reason said out
     * loud — rather than pinning to one half and quietly landing somewhere else.
     */
    const moment = sourceMomentAtTicks(input.project, start)
    if (!moment || entry.durationTicks > moment.remainingTicks) {
      return refusePlan(
        'NO_FOOTAGE_THERE',
        'The main video does not run without a break there, so there is nothing to pin this to. Move the playhead somewhere it does.',
      )
    }
    operations.push(Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: input.ids.operation(slot),
      kind: 'add-media-overlay',
      capabilityId: MEDIA_OVERLAY_PRIMITIVE_ID,
      overlayId: input.ids.entity('broll', slot),
      overlayAssetId: entry.overlayAssetId,
      assetId: moment.assetId,
      sourceInterval: Object.freeze({ start: time(moment.sourceTicks), duration: time(entry.durationTicks) }),
      overlaySourceStart: time(asset.mediaKind === 'image' ? 0 : entry.overlaySourceStartTicks),
      region: entry.region,
      opacity: entry.opacity,
      useOverlayAudio: entry.useOverlayAudio,
      extensions: Object.freeze({}),
    }) as unknown as EditOperation)
    slot += 1
  }

  if (operations.length === 0) {
    return refusePlan('ITEM_UNKNOWN', 'There was nothing in the clipboard that could be pasted here.')
  }

  for (const operation of operations) {
    if (!validateOperation(operation).ok) {
      return refusePlan('OPERATION_UNSUPPORTED', 'Sanverse cannot paste that. Nothing was altered.')
    }
  }

  const count = input.clipboard.entries.length
  return Object.freeze({
    ok: true,
    operations: Object.freeze(operations),
    description: count === 1 ? 'Paste' : `Paste ${count} items`,
  })
}

/**
 * Cut — copy it, then take it away, as ONE change set.
 *
 * The copy is returned separately because the clipboard is not part of the
 * project. If the removal is refused, the clipboard is left alone too: a cut
 * that failed must not quietly replace what the user had copied earlier.
 */
export type CutResult =
  | Readonly<{ ok: true; clipboard: TimelineClipboardV1; operations: readonly EditOperation[]; description: string }>
  | Readonly<{ ok: false; refusal: TimelineItemRefusal }>

export const planCut = (input: Readonly<{
  project: EditProject
  itemIds: readonly string[]
  lockedTrackIds: readonly string[]
  pendingProposalExists: boolean
  exportInProgress: boolean
  expectedRevision: number
  ids: TimelineItemPlanInput['ids']
}>): CutResult => {
  const copied = copySelectionToClipboard({ project: input.project, itemIds: input.itemIds })
  if (!copied.ok) return Object.freeze({ ok: false, refusal: copied.refusal })

  if (input.project.revision !== input.expectedRevision) {
    return Object.freeze({
      ok: false,
      refusal: Object.freeze({ code: 'PROJECT_STALE' as const, message: 'The project changed a moment ago. Try that again.' }),
    })
  }
  if (input.pendingProposalExists || input.exportInProgress) {
    return Object.freeze({
      ok: false,
      refusal: Object.freeze({
        code: (input.pendingProposalExists ? 'PROPOSAL_PENDING' : 'EXPORT_IN_PROGRESS') as TimelineItemRefusalCode,
        message: input.pendingProposalExists
          ? 'Finish the suggestion on screen before changing the timeline.'
          : 'Wait for the export to finish before changing the timeline.',
      }),
    })
  }

  const operations: EditOperation[] = []
  let slot = 0
  const seen = new Set<string>()
  for (const itemId of input.itemIds) {
    const parsed = parseTimelineItemId(itemId)
    if (!parsed || parsed.family === 'clip' || seen.has(parsed.targetId)) continue
    const trackId = parsed.family === 'music' ? 'A2' : 'V2'
    if (input.lockedTrackIds.includes(trackId)) {
      return Object.freeze({
        ok: false,
        refusal: Object.freeze({
          code: 'TRACK_LOCKED' as const,
          message: `Track ${trackId} is locked. Unlock it to change anything on it.`,
        }),
      })
    }
    seen.add(parsed.targetId)
    operations.push(Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: input.ids.operation(slot),
      kind: 'remove-overlay',
      capabilityId: OVERLAY_REMOVE_PRIMITIVE_ID,
      overlayId: parsed.targetId,
      extensions: Object.freeze({}),
    }) as EditOperation)
    slot += 1
  }

  if (operations.length === 0) {
    return Object.freeze({
      ok: false,
      refusal: Object.freeze({ code: 'ITEM_UNKNOWN' as const, message: 'Nothing that can be cut was picked.' }),
    })
  }

  return Object.freeze({
    ok: true,
    clipboard: copied.clipboard,
    operations: Object.freeze(operations),
    description: operations.length === 1 ? 'Cut' : `Cut ${operations.length} items`,
  })
}

/**
 * Duplicate — a copy landing immediately after the originals.
 *
 * Deliberately built out of Copy and Paste rather than being its own thing, so
 * there is one set of rules about what can be duplicated, where it can land and
 * what happens when it will not fit. A separate implementation would be a second
 * set of rules that drifts.
 *
 * It does NOT touch the clipboard. Somebody who copied something earlier, then
 * duplicated a clip, must still have their earlier copy when they press Paste.
 */
export const planDuplicate = (input: Readonly<{
  project: EditProject
  itemIds: readonly string[]
  lockedTrackIds: readonly string[]
  pendingProposalExists: boolean
  exportInProgress: boolean
  expectedRevision: number
  ids: TimelineItemPlanInput['ids']
}>): ClipboardPlan => {
  const copied = copySelectionToClipboard({ project: input.project, itemIds: input.itemIds })
  if (!copied.ok) return Object.freeze({ ok: false, refusal: copied.refusal })

  // Where the LAST of the picked items ends. The duplicate begins there, which
  // is what "duplicate" means to somebody laying clips end to end.
  const v2 = laneSpans(input.project, 'V2')
  const a2 = laneSpans(input.project, 'A2')
  let landsAt = 0
  for (const itemId of input.itemIds) {
    const parsed = parseTimelineItemId(itemId)
    if (!parsed || parsed.family === 'clip') continue
    const span = (parsed.family === 'music' ? a2 : v2).find((each) => each.targetId === parsed.targetId)
    if (span) landsAt = Math.max(landsAt, span.startTicks + span.durationTicks)
  }

  const plan = planPaste({
    project: input.project,
    clipboard: copied.clipboard,
    atTicks: landsAt,
    mode: 'at-playhead',
    lockedTrackIds: input.lockedTrackIds,
    pendingProposalExists: input.pendingProposalExists,
    exportInProgress: input.exportInProgress,
    expectedRevision: input.expectedRevision,
    ids: input.ids,
  })
  if (!plan.ok) return plan
  return Object.freeze({
    ok: true,
    operations: plan.operations,
    description: copied.clipboard.entries.length === 1
      ? 'Duplicate'
      : `Duplicate ${copied.clipboard.entries.length} items`,
  })
}
