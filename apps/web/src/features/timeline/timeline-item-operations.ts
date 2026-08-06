import {
  MEDIA_OVERLAY_PRIMITIVE_ID,
  MUSIC_PRIMITIVE_ID,
  OPERATION_SCHEMA_VERSION,
  OVERLAY_REMOVE_PRIMITIVE_ID,
  PROJECT_TIMESCALE,
  activeOverlayOperations,
  clipAtCompositionTime,
  clipTimeToSource,
  compositionDuration,
  compositionTimeToClip,
  effectiveComposition,
  findAsset,
  placeSourceSpan,
  sourceTimeToClip,
  validateOperation,
  type AddMediaOverlayOperation,
  type AddMusicOperation,
  type EditOperation,
  type EditProject,
} from '@sanverse/edit-domain'

/**
 * Everything a user can do to something ALREADY on the timeline, as arithmetic.
 *
 * ## Why this is a plain function and not part of a React component
 *
 * A user can drag a piece of B-roll two seconds later, or they can type "move
 * the logo two seconds later". Both must produce the same edit. If the rule
 * lived in a mouse handler, the AI would need its own copy of it, and the two
 * would disagree the first time either was touched. Then the product has two
 * personalities and nobody can say which is right.
 *
 * So this file knows nothing about the screen. Same project plus same request
 * gives the same answer, every time.
 *
 * ## The one fact that makes this file harder than it looks
 *
 * A piece of B-roll is NOT stored as "starts at 12 seconds of the finished
 * video". It is stored as "sits on the moment of the original recording where
 * I held up the product" (ADR-005). That is what makes cutting safe: trim four
 * seconds off the front and the B-roll stays on the product, instead of sliding
 * onto somebody's face.
 *
 * The cost is that moving a piece of B-roll one second later is not "add one
 * second to its start". It is:
 *
 *     finished-video time  ──►  which piece of footage is showing there
 *                          ──►  which moment of the ORIGINAL RECORDING that is
 *                          ──►  store THAT
 *
 * Music is the exception and is stored in finished-video time directly, because
 * it belongs to the finished piece rather than to a filmed moment (ADR-007).
 * Moving music one second later really is "add one second". The two are
 * handled separately below, and never share arithmetic, because a shared
 * "move" that branched on kind is exactly where the two would drift.
 */

const time = (ticks: number) => Object.freeze({ ticks, timescale: PROJECT_TIMESCALE })

export const TIMELINE_ITEM_REFUSAL_CODES = Object.freeze([
  'ITEM_UNKNOWN',
  'TRACK_LOCKED',
  'OPERATION_UNSUPPORTED',
  'OUT_OF_RANGE',
  'NO_FOOTAGE_THERE',
  'TOO_SHORT',
  'COLLISION',
  'SOURCE_EXHAUSTED',
  'PROPOSAL_PENDING',
  'EXPORT_IN_PROGRESS',
  'PROJECT_STALE',
] as const)

export type TimelineItemRefusalCode = (typeof TIMELINE_ITEM_REFUSAL_CODES)[number]

export type TimelineItemRefusal = Readonly<{
  code: TimelineItemRefusalCode
  /** Plain words the user reads. Says what cannot happen AND what to do instead. */
  message: string
}>

/**
 * What a user asked to do to one item.
 *
 * Every one of these is a WHOLE gesture, decided when the mouse is released.
 * Nothing here is called while a pointer is moving: that is presentation only,
 * and a request per mouse move would be a hundred edits and a hundred Undos for
 * a single drag.
 */
export type TimelineItemAction =
  | Readonly<{ type: 'move'; toStartTicks: number }>
  | Readonly<{ type: 'trim-start'; toStartTicks: number }>
  | Readonly<{ type: 'trim-end'; toEndTicks: number }>
  | Readonly<{ type: 'split'; atTicks: number }>
  | Readonly<{ type: 'set-audio'; gainDb: number; fadeInTicks: number; fadeOutTicks: number }>
  | Readonly<{ type: 'delete'; ripple: boolean }>

/** The smallest a thing on the timeline may become. Below this it cannot be grabbed again. */
export const MIN_ITEM_TICKS = PROJECT_TIMESCALE / 4

export type TimelineItemPlanInput = Readonly<{
  project: EditProject
  /** The presentation id of the item, as the Timeline view model names it. */
  itemId: string
  action: TimelineItemAction
  /** Presentation-only padlocks. Never part of the project. */
  lockedTrackIds: readonly string[]
  pendingProposalExists: boolean
  exportInProgress: boolean
  expectedRevision: number
  /**
   * Deterministic identities for anything this gesture creates. Derived from
   * the change-set id by the caller, never invented here, so replaying the same
   * history produces the same file.
   */
  ids: Readonly<{ operation: (slot: number) => string; entity: (namespace: string, slot: number) => string }>
}>

export type TimelineItemPlan =
  | Readonly<{ ok: true; operations: readonly EditOperation[]; description: string }>
  | Readonly<{ ok: false; refusal: TimelineItemRefusal }>

const refuse = (code: TimelineItemRefusalCode, message: string): TimelineItemPlan =>
  Object.freeze({ ok: false, refusal: Object.freeze({ code, message }) })

/**
 * The presentation id of a timeline item, taken apart.
 *
 * `overlay:broll_ab12:0` — the trailing number is which piece of the item this
 * is, because one B-roll clip cut in half shows as two rectangles. Editing any
 * of them edits the one underlying thing.
 */
export const parseTimelineItemId = (
  itemId: string,
): Readonly<{ family: 'overlay' | 'music' | 'clip'; targetId: string }> | null => {
  const overlay = /^overlay:((?:broll|title|callout)_[a-z0-9]+):\d+$/.exec(itemId)
  if (overlay) return Object.freeze({ family: 'overlay' as const, targetId: overlay[1] })
  const music = /^music:(music_[a-z0-9]+):\d+$/.exec(itemId)
  if (music) return Object.freeze({ family: 'music' as const, targetId: music[1] })
  const clip = /^clip:(clip_[a-z0-9]+)$/.exec(itemId)
  if (clip) return Object.freeze({ family: 'clip' as const, targetId: clip[1] })
  return null
}

/** Which of the five tracks an item lives on, from its id alone. */
export const trackIdForItem = (itemId: string): 'V2' | 'V1' | 'A2' | null => {
  const parsed = parseTimelineItemId(itemId)
  if (!parsed) return null
  if (parsed.family === 'music') return 'A2'
  if (parsed.family === 'overlay') return 'V2'
  return 'V1'
}

/**
 * Finished-video time turned into a moment of the original recording.
 *
 * Null when that moment of the finished video has no footage under it — a hole
 * left by a cut. Nothing source-anchored can be put there, because there is
 * nothing for it to be pinned to.
 */
const sourceMomentAtTicks = (
  project: EditProject,
  ticks: number,
): Readonly<{ assetId: string; sourceTicks: number; remainingTicks: number }> | null => {
  const composition = effectiveComposition(project)
  const clip = clipAtCompositionTime(composition, time(ticks))
  if (!clip) return null
  const sourceTime = clipTimeToSource(clip, compositionTimeToClip(clip, time(ticks)))
  return Object.freeze({
    assetId: clip.assetId,
    sourceTicks: sourceTime.ticks,
    remainingTicks: clip.sourceRange.start.ticks + clip.sourceRange.duration.ticks - sourceTime.ticks,
  })
}

/** Where a source-anchored span currently lands in the finished video, if anywhere. */
const placementOf = (
  project: EditProject,
  assetId: string,
  sourceInterval: { start: { ticks: number }; duration: { ticks: number } },
): Readonly<{ startTicks: number; durationTicks: number }> | null => {
  const placements = placeSourceSpan(effectiveComposition(project), assetId, sourceInterval as never)
  if (placements.length === 0) return null
  const first = placements[0]
  const last = placements[placements.length - 1]
  return Object.freeze({
    startTicks: first.compositionRange.start.ticks,
    durationTicks:
      last.compositionRange.start.ticks + last.compositionRange.duration.ticks - first.compositionRange.start.ticks,
  })
}

/**
 * Everything on one lane, as plain spans of finished-video time.
 *
 * Used to answer "is something already there?". Computed from the same accepted
 * operations the screen draws from, so the answer the user is given and the
 * answer the check uses cannot disagree.
 */
export type LaneSpan = Readonly<{ targetId: string; startTicks: number; durationTicks: number }>

export const laneSpans = (project: EditProject, trackId: 'V2' | 'A2'): readonly LaneSpan[] => {
  const durationTicks = compositionDuration(effectiveComposition(project)).ticks
  const spans: LaneSpan[] = []
  for (const operation of activeOverlayOperations(project)) {
    if (trackId === 'A2') {
      if (operation.kind !== 'add-music') continue
      const asset = findAsset(project.assets, operation.assetId)
      if (!asset || asset.mediaKind !== 'audio') continue
      const videoLeft = durationTicks - operation.compositionStart.ticks
      const songLeft = asset.duration.ticks - operation.sourceStart.ticks
      const asked = operation.durationTicks === null ? Number.MAX_SAFE_INTEGER : operation.durationTicks.ticks
      const playable = Math.min(videoLeft, songLeft, asked)
      if (playable <= 0) continue
      spans.push(Object.freeze({
        targetId: operation.musicId,
        startTicks: operation.compositionStart.ticks,
        durationTicks: playable,
      }))
      continue
    }
    // V2 collision is judged between pieces of B-roll and pictures only. A
    // title sitting over a clip is not a clash: words on top of a picture is
    // the whole point of a title.
    if (operation.kind !== 'add-media-overlay') continue
    const placed = placementOf(project, operation.assetId, operation.sourceInterval)
    if (!placed) continue
    spans.push(Object.freeze({
      targetId: operation.overlayId,
      startTicks: placed.startTicks,
      durationTicks: placed.durationTicks,
    }))
  }
  return Object.freeze(spans.slice().sort((left, right) => left.startTicks - right.startTicks))
}

/** True when two half-open spans share any instant at all. */
export const spansOverlap = (
  a: Readonly<{ startTicks: number; durationTicks: number }>,
  b: Readonly<{ startTicks: number; durationTicks: number }>,
): boolean => a.startTicks < b.startTicks + b.durationTicks && b.startTicks < a.startTicks + a.durationTicks

const collides = (
  spans: readonly LaneSpan[],
  candidate: Readonly<{ startTicks: number; durationTicks: number }>,
  ignoreTargetId: string | null,
): boolean =>
  spans.some((span) => span.targetId !== ignoreTargetId && spansOverlap(span, candidate))

const overlayCapability = (kind: string): string =>
  kind === 'add-media-overlay' ? MEDIA_OVERLAY_PRIMITIVE_ID : MUSIC_PRIMITIVE_ID

const removeOperation = (overlayId: string, operationId: string): EditOperation =>
  Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId,
    kind: 'remove-overlay',
    capabilityId: OVERLAY_REMOVE_PRIMITIVE_ID,
    overlayId,
    extensions: Object.freeze({}),
  }) as EditOperation

/** A complete new state for one piece of B-roll. Never a patch. */
const setMediaOverlay = (
  original: AddMediaOverlayOperation,
  changes: Partial<AddMediaOverlayOperation>,
  operationId: string,
): EditOperation =>
  Object.freeze({
    ...original,
    ...changes,
    operationId,
    kind: 'set-media-overlay',
    capabilityId: overlayCapability('add-media-overlay'),
  }) as unknown as EditOperation

const setMusic = (
  original: AddMusicOperation,
  changes: Partial<AddMusicOperation>,
  operationId: string,
): EditOperation =>
  Object.freeze({
    ...original,
    ...changes,
    operationId,
    kind: 'set-music',
    capabilityId: MUSIC_PRIMITIVE_ID,
  }) as unknown as EditOperation

const validateAll = (operations: readonly EditOperation[], description: string): TimelineItemPlan => {
  for (const operation of operations) {
    const validated = validateOperation(operation)
    if (!validated.ok) {
      return refuse('OPERATION_UNSUPPORTED', 'Sanverse cannot make that change. Nothing was altered.')
    }
  }
  return Object.freeze({ ok: true, operations: Object.freeze(operations), description })
}

/**
 * Plan one gesture on one item as ONE change set.
 *
 * Everything it returns goes into a single change set, so the whole gesture is
 * one Undo and cannot half-happen. A refusal returns no operations at all: the
 * project is left exactly as the user last saw it.
 */
export const planTimelineItemAction = (input: TimelineItemPlanInput): TimelineItemPlan => {
  if (input.project.revision !== input.expectedRevision) {
    return refuse('PROJECT_STALE', 'The project changed while you were dragging. Try that again.')
  }
  if (input.pendingProposalExists) {
    return refuse('PROPOSAL_PENDING', 'Finish the suggestion on screen before changing the timeline.')
  }
  if (input.exportInProgress) {
    return refuse('EXPORT_IN_PROGRESS', 'Wait for the export to finish before changing the timeline.')
  }

  const parsed = parseTimelineItemId(input.itemId)
  if (!parsed) return refuse('ITEM_UNKNOWN', 'That item is no longer on the timeline.')

  const trackId = trackIdForItem(input.itemId)
  if (trackId !== null && input.lockedTrackIds.includes(trackId)) {
    return refuse('TRACK_LOCKED', `Track ${trackId} is locked. Unlock it to change anything on it.`)
  }

  if (parsed.family === 'clip') {
    // Pieces of the one primary recording are edited by the existing timeline
    // gestures, which already know how cutting works. A second path here would
    // be a second set of rules about the same footage.
    return refuse(
      'OPERATION_UNSUPPORTED',
      'Use the split, trim and delete controls for the main video track.',
    )
  }

  const current = activeOverlayOperations(input.project).find((operation) =>
    operation.kind === 'add-media-overlay'
      ? operation.overlayId === parsed.targetId
      : operation.kind === 'add-music'
        ? operation.musicId === parsed.targetId
        : operation.kind === 'add-title'
          ? operation.titleId === parsed.targetId
          : operation.calloutId === parsed.targetId,
  )
  if (!current) return refuse('ITEM_UNKNOWN', 'That item is no longer on the timeline.')

  const action = input.action
  if (action.type === 'delete') {
    return planDelete(input, current, action.ripple)
  }

  if (current.kind === 'add-music') return planMusicAction(input, current, action)
  if (current.kind === 'add-media-overlay') return planMediaOverlayAction(input, current, action)

  // Titles and callouts carry no media of their own, so trimming and splitting
  // them means something different and is not offered yet. Saying so is better
  // than a handle that moves and then snaps back.
  return refuse(
    'OPERATION_UNSUPPORTED',
    'Titles and callouts are edited in the panel on the right, not by dragging.',
  )
}

type EditableAction = Exclude<TimelineItemAction, Readonly<{ type: 'delete'; ripple: boolean }>>

const planDelete = (
  input: TimelineItemPlanInput,
  current: ReturnType<typeof activeOverlayOperations>[number],
  ripple: boolean,
): TimelineItemPlan => {
  const overlayId =
    current.kind === 'add-media-overlay'
      ? current.overlayId
      : current.kind === 'add-music'
        ? current.musicId
        : current.kind === 'add-title'
          ? current.titleId
          : current.calloutId

  const operations: EditOperation[] = [removeOperation(overlayId, input.ids.operation(0))]

  if (!ripple) return validateAll(operations, 'Delete')

  if (current.kind === 'add-music') {
    // Music is measured on the finished video, so closing the gap is exact
    // arithmetic: everything later on this lane starts that much earlier.
    const spans = laneSpans(input.project, 'A2')
    const removed = spans.find((span) => span.targetId === current.musicId)
    if (!removed) return validateAll(operations, 'Delete')
    const shift = removed.durationTicks
    let slot = 1
    for (const operation of activeOverlayOperations(input.project)) {
      if (operation.kind !== 'add-music' || operation.musicId === current.musicId) continue
      if (operation.compositionStart.ticks < removed.startTicks + removed.durationTicks) continue
      operations.push(setMusic(
        operation,
        { compositionStart: time(Math.max(0, operation.compositionStart.ticks - shift)) },
        input.ids.operation(slot),
      ))
      slot += 1
    }
    return validateAll(operations, 'Ripple delete')
  }

  // B-roll is pinned to a moment of the FOOTAGE, not to a moment of the
  // finished video. Closing the gap after it would have to re-pin everything
  // later to earlier footage — which moves those clips onto different moments
  // of the recording. That is never what "close the gap" is meant to do, so it
  // is refused with the alternative said out loud.
  return refuse(
    'OPERATION_UNSUPPORTED',
    'B-roll is pinned to a moment of your footage, so closing the gap would move the later clips onto different footage. Use Delete instead.',
  )
}

const planMusicAction = (
  input: TimelineItemPlanInput,
  current: AddMusicOperation,
  action: EditableAction,
): TimelineItemPlan => {
  const project = input.project
  const asset = findAsset(project.assets, current.assetId)
  if (!asset || asset.mediaKind !== 'audio') {
    return refuse('ITEM_UNKNOWN', 'That music is no longer in this project.')
  }
  const videoTicks = compositionDuration(effectiveComposition(project)).ticks
  const spans = laneSpans(project, 'A2')
  const mine = spans.find((span) => span.targetId === current.musicId)
  if (!mine) return refuse('ITEM_UNKNOWN', 'That music is no longer on the timeline.')

  if (action.type === 'move') {
    const start = Math.round(action.toStartTicks)
    if (start < 0 || start >= videoTicks) {
      return refuse('OUT_OF_RANGE', 'Music has to start somewhere inside the video.')
    }
    const songLeft = asset.duration.ticks - current.sourceStart.ticks
    const asked = current.durationTicks === null ? Number.MAX_SAFE_INTEGER : current.durationTicks.ticks
    const length = Math.min(videoTicks - start, songLeft, asked)
    if (length < MIN_ITEM_TICKS) {
      return refuse('TOO_SHORT', 'There is not enough video left there for this music to be heard.')
    }
    if (collides(spans, { startTicks: start, durationTicks: length }, current.musicId)) {
      return refuse('COLLISION', 'There is already something on the music track at that moment.')
    }
    return validateAll(
      [setMusic(current, { compositionStart: time(start) }, input.ids.operation(0))],
      'Move music',
    )
  }

  if (action.type === 'trim-start') {
    const start = Math.round(action.toStartTicks)
    const end = mine.startTicks + mine.durationTicks
    if (start < 0 || end - start < MIN_ITEM_TICKS) {
      return refuse('TOO_SHORT', 'Music cannot be made shorter than a quarter of a second.')
    }
    // Trimming the head of music means starting later in the SONG as well as
    // later in the video, so the beat that was under a moment stays under it.
    const movedBy = start - mine.startTicks
    const sourceStart = current.sourceStart.ticks + movedBy
    if (sourceStart < 0) {
      return refuse('SOURCE_EXHAUSTED', 'That is the very beginning of this piece of music.')
    }
    if (collides(spans, { startTicks: start, durationTicks: end - start }, current.musicId)) {
      return refuse('COLLISION', 'There is already something on the music track at that moment.')
    }
    return validateAll([
      setMusic(current, {
        compositionStart: time(start),
        sourceStart: time(sourceStart),
        durationTicks: time(end - start),
      }, input.ids.operation(0)),
    ], 'Trim music')
  }

  if (action.type === 'set-audio') {
    const gainDb = Number(action.gainDb)
    const fadeInTicks = Math.max(0, Math.round(action.fadeInTicks))
    const fadeOutTicks = Math.max(0, Math.round(action.fadeOutTicks))
    if (!Number.isFinite(gainDb) || gainDb < -60 || gainDb > 12) {
      return refuse('OUT_OF_RANGE', 'Choose a loudness between -60 and 12 dB.')
    }
    if (fadeInTicks + fadeOutTicks > mine.durationTicks) {
      return refuse('OUT_OF_RANGE', 'The fades cannot be longer than this music clip.')
    }
    return validateAll([
      setMusic(current, {
        gainDb,
        fadeIn: time(fadeInTicks),
        fadeOut: time(fadeOutTicks),
      }, input.ids.operation(0)),
    ], 'Adjust music audio')
  }

  if (action.type === 'trim-end') {
    const end = Math.round(action.toEndTicks)
    const length = end - mine.startTicks
    if (length < MIN_ITEM_TICKS) {
      return refuse('TOO_SHORT', 'Music cannot be made shorter than a quarter of a second.')
    }
    if (collides(spans, { startTicks: mine.startTicks, durationTicks: length }, current.musicId)) {
      return refuse('COLLISION', 'There is already something on the music track at that moment.')
    }
    return validateAll(
      [setMusic(current, { durationTicks: time(length) }, input.ids.operation(0))],
      'Trim music',
    )
  }

  // split
  const at = Math.round(action.atTicks)
  if (at <= mine.startTicks || at >= mine.startTicks + mine.durationTicks) {
    return refuse('OUT_OF_RANGE', 'Put the playhead inside the music before splitting it.')
  }
  const leftLength = at - mine.startTicks
  const rightLength = mine.startTicks + mine.durationTicks - at
  if (leftLength < MIN_ITEM_TICKS || rightLength < MIN_ITEM_TICKS) {
    return refuse('TOO_SHORT', 'Both halves would be too short to see. Split somewhere nearer the middle.')
  }
  const rightId = input.ids.entity('music', 1)
  const right: AddMusicOperation = Object.freeze({
    ...current,
    operationId: input.ids.operation(1),
    kind: 'add-music',
    musicId: rightId,
    compositionStart: time(at),
    sourceStart: time(current.sourceStart.ticks + leftLength),
    durationTicks: time(rightLength),
    // The ramps belong to the ends of the original, not to the new cut.
    fadeIn: time(0),
  })
  return validateAll([
    setMusic(current, { durationTicks: time(leftLength), fadeOut: time(0) }, input.ids.operation(0)),
    right as unknown as EditOperation,
  ], 'Split music')
}

const planMediaOverlayAction = (
  input: TimelineItemPlanInput,
  current: AddMediaOverlayOperation,
  action: EditableAction,
): TimelineItemPlan => {
  const project = input.project
  const overlayAsset = findAsset(project.assets, current.overlayAssetId)
  if (!overlayAsset) return refuse('ITEM_UNKNOWN', 'That media is no longer in this project.')
  const isStill = overlayAsset.mediaKind === 'image'
  const spans = laneSpans(project, 'V2')
  const mine = spans.find((span) => span.targetId === current.overlayId)
  if (!mine) return refuse('ITEM_UNKNOWN', 'That clip is no longer on the timeline.')

  const composition = effectiveComposition(project)

  if (action.type === 'set-audio') {
    return refuse('OPERATION_UNSUPPORTED', 'This overlay has no editable audio on the current V2 lane.')
  }

  /**
   * Turn a wanted finished-video span into the source span that produces it.
   *
   * Refuses rather than approximating when the wanted span crosses a hole or a
   * join between two different pieces of footage: a B-roll clip cannot be
   * pinned to two unrelated moments at once, and quietly pinning it to one of
   * them would move it somewhere the user did not put it.
   */
  const sourceSpanFor = (
    startTicks: number,
    durationTicks: number,
  ): Readonly<{ assetId: string; sourceStart: number; sourceDuration: number }> | null => {
    const head = sourceMomentAtTicks(project, startTicks)
    if (!head) return null
    if (head.assetId !== current.assetId) return null
    if (durationTicks > head.remainingTicks) return null
    return Object.freeze({
      assetId: head.assetId,
      sourceStart: head.sourceTicks,
      sourceDuration: durationTicks,
    })
  }

  if (action.type === 'move') {
    const start = Math.round(action.toStartTicks)
    const length = mine.durationTicks
    if (start < 0 || start + length > compositionDuration(composition).ticks) {
      return refuse('OUT_OF_RANGE', 'That would put the clip outside the video. Drag it back inside.')
    }
    if (collides(spans, { startTicks: start, durationTicks: length }, current.overlayId)) {
      return refuse('COLLISION', 'There is already something on this track at that moment.')
    }
    const span = sourceSpanFor(start, length)
    if (!span) {
      return refuse(
        'NO_FOOTAGE_THERE',
        'There is no single stretch of footage there to pin this clip to. Move it somewhere the main video runs without a break.',
      )
    }
    return validateAll([
      setMediaOverlay(current, {
        assetId: span.assetId,
        sourceInterval: Object.freeze({ start: time(span.sourceStart), duration: time(span.sourceDuration) }),
      }, input.ids.operation(0)),
    ], 'Move clip')
  }

  if (action.type === 'trim-start') {
    const start = Math.round(action.toStartTicks)
    const end = mine.startTicks + mine.durationTicks
    const length = end - start
    if (length < MIN_ITEM_TICKS) {
      return refuse('TOO_SHORT', 'A clip cannot be made shorter than a quarter of a second.')
    }
    if (collides(spans, { startTicks: start, durationTicks: length }, current.overlayId)) {
      return refuse('COLLISION', 'There is already something on this track at that moment.')
    }
    const span = sourceSpanFor(start, length)
    if (!span) {
      return refuse('NO_FOOTAGE_THERE', 'There is no footage there to pin this clip to.')
    }
    // Trimming the head of a B-roll VIDEO also starts it later in its own file,
    // so the frame that was showing at a moment keeps showing at that moment.
    // A still picture has nowhere to start later, so it never moves.
    const movedBy = start - mine.startTicks
    const overlaySourceStart = isStill ? 0 : current.overlaySourceStart.ticks + movedBy
    if (overlaySourceStart < 0) {
      return refuse('SOURCE_EXHAUSTED', 'That is the very first frame of this clip.')
    }
    if (!isStill && overlaySourceStart + length > overlayAsset.duration.ticks) {
      return refuse('SOURCE_EXHAUSTED', 'There is not that much of this clip left to show.')
    }
    return validateAll([
      setMediaOverlay(current, {
        assetId: span.assetId,
        sourceInterval: Object.freeze({ start: time(span.sourceStart), duration: time(span.sourceDuration) }),
        overlaySourceStart: time(overlaySourceStart),
      }, input.ids.operation(0)),
    ], 'Trim clip')
  }

  if (action.type === 'trim-end') {
    const end = Math.round(action.toEndTicks)
    const length = end - mine.startTicks
    if (length < MIN_ITEM_TICKS) {
      return refuse('TOO_SHORT', 'A clip cannot be made shorter than a quarter of a second.')
    }
    if (collides(spans, { startTicks: mine.startTicks, durationTicks: length }, current.overlayId)) {
      return refuse('COLLISION', 'There is already something on this track at that moment.')
    }
    if (!isStill && current.overlaySourceStart.ticks + length > overlayAsset.duration.ticks) {
      return refuse('SOURCE_EXHAUSTED', 'There is not that much of this clip left to show.')
    }
    const span = sourceSpanFor(mine.startTicks, length)
    if (!span) {
      return refuse('NO_FOOTAGE_THERE', 'The main video does not run that far without a break.')
    }
    return validateAll([
      setMediaOverlay(current, {
        sourceInterval: Object.freeze({ start: time(span.sourceStart), duration: time(span.sourceDuration) }),
      }, input.ids.operation(0)),
    ], 'Trim clip')
  }

  // split
  const at = Math.round(action.atTicks)
  if (at <= mine.startTicks || at >= mine.startTicks + mine.durationTicks) {
    return refuse('OUT_OF_RANGE', 'Put the playhead inside the clip before splitting it.')
  }
  const leftLength = at - mine.startTicks
  const rightLength = mine.startTicks + mine.durationTicks - at
  if (leftLength < MIN_ITEM_TICKS || rightLength < MIN_ITEM_TICKS) {
    return refuse('TOO_SHORT', 'Both halves would be too short to see. Split somewhere nearer the middle.')
  }
  const leftSpan = sourceSpanFor(mine.startTicks, leftLength)
  const rightSpan = sourceSpanFor(at, rightLength)
  if (!leftSpan || !rightSpan) {
    return refuse('NO_FOOTAGE_THERE', 'The main video does not run without a break across that point.')
  }
  const rightId = input.ids.entity('broll', 1)
  const right: AddMediaOverlayOperation = Object.freeze({
    ...current,
    operationId: input.ids.operation(1),
    kind: 'add-media-overlay',
    overlayId: rightId,
    assetId: rightSpan.assetId,
    sourceInterval: Object.freeze({ start: time(rightSpan.sourceStart), duration: time(rightSpan.sourceDuration) }),
    // The right half resumes where the left half stopped, so a split does not
    // make the clip start over.
    overlaySourceStart: time(isStill ? 0 : current.overlaySourceStart.ticks + leftLength),
  })
  return validateAll([
    setMediaOverlay(current, {
      assetId: leftSpan.assetId,
      sourceInterval: Object.freeze({ start: time(leftSpan.sourceStart), duration: time(leftSpan.sourceDuration) }),
    }, input.ids.operation(0)),
    right as unknown as EditOperation,
  ], 'Split clip')
}

/**
 * ONE change made to something already on a lane, as an intention rather than
 * as an operation.
 *
 * Insert and Overwrite both have to rearrange several existing items in the
 * same breath as placing a new one. Expressing those rearrangements here — in
 * the file that already knows how a B-roll clip is pinned to footage and how
 * music is measured on the finished video — is what stops a second copy of that
 * arithmetic appearing in the placement planner and drifting away from this one.
 */
export type LaneEdit =
  | Readonly<{ kind: 'remove'; targetId: string }>
  /** The whole item slides. It shows the same frames, at a different moment. */
  | Readonly<{ kind: 'move'; targetId: string; toStartTicks: number }>
  /** An edge is pulled in. The frames on show change with it. */
  | Readonly<{ kind: 'trim'; targetId: string; toStartTicks: number; toEndTicks: number }>
  /**
   * Something is being laid across the middle of this item, so it becomes two:
   * everything up to `keepLeftEndTicks`, and everything from `keepRightStartTicks`.
   */
  | Readonly<{ kind: 'fragment'; targetId: string; keepLeftEndTicks: number; keepRightStartTicks: number }>

export type LaneEditResult =
  | Readonly<{ ok: true; operations: readonly EditOperation[] }>
  | Readonly<{ ok: false; refusal: TimelineItemRefusal }>

/**
 * Turn a list of lane edits into operations, all for one change set.
 *
 * `slotOffset` keeps the deterministic identities of these operations clear of
 * whatever the caller already produced, so a placement that also rearranges
 * three clips still names every operation without a collision, and names them
 * the same way every time the same history is replayed.
 */
export const applyLaneEdits = (input: Readonly<{
  project: EditProject
  trackId: 'V2' | 'A2'
  edits: readonly LaneEdit[]
  ids: TimelineItemPlanInput['ids']
  slotOffset: number
}>): LaneEditResult => {
  const { project, trackId, edits, ids } = input
  const operations: EditOperation[] = []
  const overlays = activeOverlayOperations(project)
  const spans = laneSpans(project, trackId)
  const videoTicks = compositionDuration(effectiveComposition(project)).ticks
  let slot = input.slotOffset

  const fail = (code: TimelineItemRefusalCode, message: string): LaneEditResult =>
    Object.freeze({ ok: false, refusal: Object.freeze({ code, message }) })

  for (const edit of edits) {
    const span = spans.find((candidate) => candidate.targetId === edit.targetId)
    if (!span) return fail('ITEM_UNKNOWN', 'One of the clips that had to move is no longer there.')

    if (edit.kind === 'remove') {
      operations.push(removeOperation(edit.targetId, ids.operation(slot)))
      slot += 1
      continue
    }

    if (trackId === 'A2') {
      const music = overlays.find(
        (operation) => operation.kind === 'add-music' && operation.musicId === edit.targetId,
      )
      if (!music || music.kind !== 'add-music') {
        return fail('ITEM_UNKNOWN', 'One of the pieces of music that had to move is no longer there.')
      }
      const asset = findAsset(project.assets, music.assetId)
      if (!asset || asset.mediaKind !== 'audio') {
        return fail('ITEM_UNKNOWN', 'One of the pieces of music is no longer in this project.')
      }

      if (edit.kind === 'move') {
        const start = Math.round(edit.toStartTicks)
        if (start < 0 || start + span.durationTicks > videoTicks) {
          return fail('OUT_OF_RANGE', 'There is not enough room left in the video to push the music along.')
        }
        operations.push(setMusic(music, {
          compositionStart: time(start),
          // Pushing music along must not also make it longer or shorter, so the
          // length it was already playing for is written down explicitly.
          durationTicks: time(span.durationTicks),
        }, ids.operation(slot)))
        slot += 1
        continue
      }

      if (edit.kind === 'trim') {
        const start = Math.round(edit.toStartTicks)
        const end = Math.round(edit.toEndTicks)
        if (end - start < MIN_ITEM_TICKS) {
          return fail('TOO_SHORT', 'That would leave a piece of music too short to hear.')
        }
        const movedBy = start - span.startTicks
        operations.push(setMusic(music, {
          compositionStart: time(start),
          sourceStart: time(music.sourceStart.ticks + movedBy),
          durationTicks: time(end - start),
        }, ids.operation(slot)))
        slot += 1
        continue
      }

      // fragment
      const leftEnd = Math.round(edit.keepLeftEndTicks)
      const rightStart = Math.round(edit.keepRightStartTicks)
      const leftLength = leftEnd - span.startTicks
      const rightLength = span.startTicks + span.durationTicks - rightStart
      if (leftLength < MIN_ITEM_TICKS || rightLength < MIN_ITEM_TICKS) {
        return fail('TOO_SHORT', 'That would leave a piece of music too short to hear.')
      }
      operations.push(setMusic(music, {
        durationTicks: time(leftLength),
        fadeOut: time(0),
      }, ids.operation(slot)))
      slot += 1
      operations.push(Object.freeze({
        ...music,
        operationId: ids.operation(slot),
        kind: 'add-music',
        musicId: ids.entity('music', slot),
        compositionStart: time(rightStart),
        sourceStart: time(music.sourceStart.ticks + (rightStart - span.startTicks)),
        durationTicks: time(rightLength),
        fadeIn: time(0),
      }) as unknown as EditOperation)
      slot += 1
      continue
    }

    // V2: B-roll and pictures, pinned to a moment of the footage.
    const overlay = overlays.find(
      (operation) => operation.kind === 'add-media-overlay' && operation.overlayId === edit.targetId,
    )
    if (!overlay || overlay.kind !== 'add-media-overlay') {
      return fail('ITEM_UNKNOWN', 'One of the clips that had to move is no longer there.')
    }
    const overlayAsset = findAsset(project.assets, overlay.overlayAssetId)
    if (!overlayAsset) return fail('ITEM_UNKNOWN', 'One of the clips is no longer in this project.')
    const isStill = overlayAsset.mediaKind === 'image'

    /** The source span that puts this item at [start, start + length). */
    const pinAt = (
      start: number,
      length: number,
    ): Readonly<{ assetId: string; sourceStart: number }> | null => {
      const head = sourceMomentAtTicks(project, start)
      if (!head || head.assetId !== overlay.assetId || length > head.remainingTicks) return null
      return Object.freeze({ assetId: head.assetId, sourceStart: head.sourceTicks })
    }

    if (edit.kind === 'move') {
      const start = Math.round(edit.toStartTicks)
      const pinned = pinAt(start, span.durationTicks)
      if (!pinned) {
        return fail(
          'NO_FOOTAGE_THERE',
          'There is not one unbroken stretch of footage to push these clips onto. Make room and place it again.',
        )
      }
      operations.push(setMediaOverlay(overlay, {
        assetId: pinned.assetId,
        sourceInterval: Object.freeze({ start: time(pinned.sourceStart), duration: time(span.durationTicks) }),
      }, ids.operation(slot)))
      slot += 1
      continue
    }

    if (edit.kind === 'trim') {
      const start = Math.round(edit.toStartTicks)
      const end = Math.round(edit.toEndTicks)
      const length = end - start
      if (length < MIN_ITEM_TICKS) {
        return fail('TOO_SHORT', 'That would leave a clip too short to see.')
      }
      const pinned = pinAt(start, length)
      if (!pinned) return fail('NO_FOOTAGE_THERE', 'There is no unbroken footage there to pin that clip to.')
      const movedBy = start - span.startTicks
      const overlaySourceStart = isStill ? 0 : overlay.overlaySourceStart.ticks + movedBy
      if (overlaySourceStart < 0 || (!isStill && overlaySourceStart + length > overlayAsset.duration.ticks)) {
        return fail('SOURCE_EXHAUSTED', 'There is not that much of that clip left to show.')
      }
      operations.push(setMediaOverlay(overlay, {
        assetId: pinned.assetId,
        sourceInterval: Object.freeze({ start: time(pinned.sourceStart), duration: time(length) }),
        overlaySourceStart: time(overlaySourceStart),
      }, ids.operation(slot)))
      slot += 1
      continue
    }

    // fragment: the new thing lands across the middle of this one.
    const leftEnd = Math.round(edit.keepLeftEndTicks)
    const rightStart = Math.round(edit.keepRightStartTicks)
    const leftLength = leftEnd - span.startTicks
    const rightLength = span.startTicks + span.durationTicks - rightStart
    if (leftLength < MIN_ITEM_TICKS || rightLength < MIN_ITEM_TICKS) {
      return fail('TOO_SHORT', 'That would leave a piece of the clip too short to see.')
    }
    const leftPin = pinAt(span.startTicks, leftLength)
    const rightPin = pinAt(rightStart, rightLength)
    if (!leftPin || !rightPin) {
      return fail('NO_FOOTAGE_THERE', 'The footage under that clip has a break in it, so it cannot be cut around.')
    }
    const rightOverlaySourceStart = isStill
      ? 0
      : overlay.overlaySourceStart.ticks + (rightStart - span.startTicks)
    if (!isStill && rightOverlaySourceStart + rightLength > overlayAsset.duration.ticks) {
      return fail('SOURCE_EXHAUSTED', 'There is not that much of that clip left to show.')
    }
    operations.push(setMediaOverlay(overlay, {
      assetId: leftPin.assetId,
      sourceInterval: Object.freeze({ start: time(leftPin.sourceStart), duration: time(leftLength) }),
    }, ids.operation(slot)))
    slot += 1
    operations.push(Object.freeze({
      ...overlay,
      operationId: ids.operation(slot),
      kind: 'add-media-overlay',
      overlayId: ids.entity('broll', slot),
      assetId: rightPin.assetId,
      sourceInterval: Object.freeze({ start: time(rightPin.sourceStart), duration: time(rightLength) }),
      // The far side resumes where the covered part left off, so the clip does
      // not restart when something is laid across its middle.
      overlaySourceStart: time(rightOverlaySourceStart),
    }) as unknown as EditOperation)
    slot += 1
  }

  for (const operation of operations) {
    if (!validateOperation(operation).ok) {
      return fail('OPERATION_UNSUPPORTED', 'Sanverse cannot make that change. Nothing was altered.')
    }
  }
  return Object.freeze({ ok: true, operations: Object.freeze(operations) })
}

export { sourceMomentAtTicks, sourceTimeToClip }
