import {
  OPERATION_SCHEMA_VERSION,
  PRECISION_TIMING_PRIMITIVE_ID,
  activeOperations,
  activeTimelineGroups,
  applyTimelineOperation,
  effectiveComposition,
  findAsset,
  findClip,
  mediaTime,
  validateOperation,
  type Clip,
  type Composition,
  type EditOperation,
  type EditProject,
  type PrimaryClipTimingChangeV1,
  type SetPrimaryClipTimingsOperation,
  type TimelineGroupV1,
} from '@sanverse/edit-domain'
import { compositionTicksForSourceOffset, sourceTicksForCompositionOffset } from '@sanverse/edit-domain/clip-time'
import {
  clipCompositionDurationTicks,
  clipCompositionEndTicks,
  isFreezeClip,
  linkedAudioCompositionDurationTicks,
} from '@sanverse/edit-domain/composition'

export type PrecisionTrimModeV1 = 'standard-trim' | 'ripple-trim' | 'roll' | 'slip' | 'slide'
/** Rate Stretch is a T2 tool surfaced in the same Trim flyout, never reimplemented. */
export type TimelinePrecisionToolV1 = PrecisionTrimModeV1 | 'rate-stretch'
export type PrecisionTrimEdgeV1 = 'start' | 'end'

export type TimelineEditPointRefV1 = Readonly<{
  trackId: string
  leftItemId: string | null
  rightItemId: string | null
  compositionTicks: number
}>

export type PrecisionTrimRefusalCode =
  | 'TRACK_LOCKED'
  | 'SOURCE_HANDLE_INSUFFICIENT'
  | 'SOURCE_OUT_OF_RANGE'
  | 'TIMELINE_OUT_OF_RANGE'
  | 'COLLISION'
  | 'ITEM_MISSING'
  | 'ITEM_DISABLED'
  | 'ITEM_TYPE_UNSUPPORTED'
  | 'EDIT_POINT_NOT_ADJACENT'
  | 'TRANSITION_CONFLICT'
  | 'GROUP_CONFLICT'
  | 'LINKED_AUDIO_CONFLICT'
  | 'SPEED_MAPPING_INVALID'
  | 'REVERSE_MAPPING_INVALID'
  | 'FREEZE_OPERATION_UNSUPPORTED'
  | 'STALE_PROJECT'
  | 'INVALID_EDIT_POINT'
  | 'INVALID_MULTI_SELECTION'

export type PrecisionTrimRefusal = Readonly<{
  code: PrecisionTrimRefusalCode
  message: string
  blockingItemId: string | null
  requestedTicks: number | null
  availableTicks: number | null
}>

export type PrecisionTimingFeedback = Readonly<{
  mode: PrecisionTrimModeV1
  requestedDeltaTicks: number
  appliedDeltaTicks: number
  changes: readonly PrimaryClipTimingChangeV1[]
  affectedClipIds: readonly string[]
  /** Composition interval shown by the selected/anchor clip after the edit. */
  selectedStartTicks: number
  selectedDurationTicks: number
  selectedSourceInTicks: number
  selectedSourceOutTicks: number
}>

export type PrecisionTrimPlan =
  | Readonly<{
      ok: true
      operation: SetPrimaryClipTimingsOperation
      operations: readonly EditOperation[]
      feedback: PrecisionTimingFeedback
      description: string
    }>
  | Readonly<{ ok: false; refusal: PrecisionTrimRefusal }>

export type PrecisionTrimSessionV1 = Readonly<{
  sessionId: string
  mode: PrecisionTrimModeV1
  selectedItemIds: readonly string[]
  selectedEditPoints: readonly TimelineEditPointRefV1[]
  originalPointerTicks: number
  rawDeltaTicks: number
  snappedDeltaTicks: number
  previewPlan: PrecisionTrimPlan | null
  state: 'active' | 'valid' | 'refused'
  refusal: PrecisionTrimRefusal | null
}>

export type PrecisionPlannerCommon = Readonly<{
  project: EditProject
  operationId: string
  lockedTrackIds?: readonly string[]
  /** Current presentation ids; lets group validation ignore stale group members. */
  existingItemIds?: readonly string[]
}>

const refusal = (
  code: PrecisionTrimRefusalCode,
  message: string,
  detail: Partial<Pick<PrecisionTrimRefusal, 'blockingItemId' | 'requestedTicks' | 'availableTicks'>> = {},
): PrecisionTrimPlan => Object.freeze({
  ok: false as const,
  refusal: Object.freeze({
    code,
    message,
    blockingItemId: detail.blockingItemId ?? null,
    requestedTicks: detail.requestedTicks ?? null,
    availableTicks: detail.availableTicks ?? null,
  }),
})

const primaryTrackOf = (composition: Composition, clipId: string) =>
  composition.tracks.find((track) => track.kind === 'video' && track.clips.some((clip) => clip.clipId === clipId)) ?? null

const ordered = (composition: Composition, clipId: string): readonly Clip[] => {
  const track = primaryTrackOf(composition, clipId)
  return Object.freeze(track ? [...track.clips].sort((a, b) => a.compositionStart.ticks - b.compositionStart.ticks || a.clipId.localeCompare(b.clipId)) : [])
}

const timingOf = (clip: Clip): PrimaryClipTimingChangeV1 => Object.freeze({
  clipId: clip.clipId,
  sourceRange: clip.sourceRange,
  compositionStart: clip.compositionStart,
  linkedAudio: clip.linkedAudio ?? null,
})

const assetDuration = (project: EditProject, clip: Clip): number | null => {
  const asset = findAsset(project.assets, clip.assetId)
  return asset?.duration?.ticks ?? null
}

/**
 * Keep the user's J/L lead and tail lengths around a newly-trimmed picture.
 * Copying the old absolute window would silently change the J/L amount whenever
 * the picture edge moved. Rebuilding from the authored composition-time lead
 * and tail preserves intent and still uses the one rational time mapper.
 */
const preserveLinkedAudio = (
  project: EditProject,
  original: Clip,
  nextPicture: Clip,
): Readonly<{ ok: true; linkedAudio: Clip['linkedAudio'] }> | Readonly<{ ok: false; plan: PrecisionTrimPlan }> => {
  const linked = original.linkedAudio ?? null
  if (linked === null) return Object.freeze({ ok: true as const, linkedAudio: null })
  if (original.timeTransform.direction === 'reverse' || nextPicture.timeTransform.direction === 'reverse') {
    return Object.freeze({ ok: false as const, plan: refusal('REVERSE_MAPPING_INVALID', 'A custom J/L window cannot be remapped on backwards footage with the current bounded reverse preview.') })
  }
  const totalSourceTicks = assetDuration(project, nextPicture)
  if (totalSourceTicks === null) return Object.freeze({ ok: false as const, plan: refusal('ITEM_MISSING', 'The source file for that linked sound is not available.') })
  const leadTicks = Math.max(0, -linked.compositionOffsetTicks)
  const oldAudioDuration = linkedAudioCompositionDurationTicks(original)
  const oldPictureDuration = clipCompositionDurationTicks(original)
  const tailTicks = Math.max(0, linked.compositionOffsetTicks + oldAudioDuration - oldPictureDuration)
  const earlySourceTicks = sourceTicksForCompositionOffset(leadTicks, nextPicture.timeTransform.playbackRate)
  const lateSourceTicks = sourceTicksForCompositionOffset(tailTicks, nextPicture.timeTransform.playbackRate)
  const pictureStart = nextPicture.sourceRange.start.ticks
  const pictureEnd = pictureStart + nextPicture.sourceRange.duration.ticks
  const sourceStart = pictureStart - earlySourceTicks
  const sourceEnd = pictureEnd + lateSourceTicks
  if (sourceStart < 0 || sourceEnd > totalSourceTicks || sourceEnd <= sourceStart) {
    return Object.freeze({ ok: false as const, plan: refusal('LINKED_AUDIO_CONFLICT', 'There is not enough recorded sound to preserve this J/L cut after the precision edit.') })
  }
  return Object.freeze({
    ok: true as const,
    linkedAudio: Object.freeze({
      sourceRange: Object.freeze({ start: mediaTime(sourceStart), duration: mediaTime(sourceEnd - sourceStart) }),
      compositionOffsetTicks: -leadTicks,
    }),
  })
}

const withPreservedLinkedAudio = (
  project: EditProject,
  original: Clip,
  nextPicture: Clip,
): Readonly<{ ok: true; clip: Clip }> | Readonly<{ ok: false; plan: PrecisionTrimPlan }> => {
  const preserved = preserveLinkedAudio(project, original, nextPicture)
  return preserved.ok
    ? Object.freeze({ ok: true as const, clip: Object.freeze({ ...nextPicture, linkedAudio: preserved.linkedAudio }) })
    : preserved
}

const isValidIntegerDelta = (value: number): boolean => Number.isSafeInteger(value) && value !== 0

const shiftLinkedAudioSource = (clip: Clip, sourceDeltaTicks: number) => {
  const linked = clip.linkedAudio ?? null
  if (linked === null) return null
  return Object.freeze({
    sourceRange: Object.freeze({
      start: mediaTime(linked.sourceRange.start.ticks + sourceDeltaTicks),
      duration: linked.sourceRange.duration,
    }),
    compositionOffsetTicks: linked.compositionOffsetTicks,
  })
}

/** Convert an on-screen magnitude into source ticks using the clip's one rational mapper. */
const sourceMagnitude = (clip: Clip, compositionTicks: number): number =>
  sourceTicksForCompositionOffset(Math.abs(compositionTicks), clip.timeTransform.playbackRate)

/**
 * Change the source boundary that appears at the LEFT side of a clip.
 * Positive delta trims the start inward; negative extends it outward.
 * `keepCompositionStart` is the Ripple rule: remove/restore source while the
 * cut before the clip remains fixed.
 */
const changeViewerStart = (
  project: EditProject,
  clip: Clip,
  deltaTicks: number,
  keepCompositionStart: boolean,
): Readonly<{ ok: true; clip: Clip; appliedDeltaTicks: number }> | Readonly<{ ok: false; plan: PrecisionTrimPlan }> => {
  const totalSourceTicks = assetDuration(project, clip)
  if (totalSourceTicks === null) return Object.freeze({ ok: false as const, plan: refusal('ITEM_MISSING', 'The source file for that piece is not available in this project.') })
  if (isFreezeClip(clip)) return Object.freeze({ ok: false as const, plan: refusal('FREEZE_OPERATION_UNSUPPORTED', 'A held frame has one source instant, so its source edge cannot be trimmed.') })
  const sourceDelta = sourceMagnitude(clip, deltaTicks)
  if (sourceDelta <= 0) return Object.freeze({ ok: false as const, plan: refusal('SPEED_MAPPING_INVALID', 'That move is smaller than this clip can represent at its current speed.') })
  const start = clip.sourceRange.start.ticks
  const end = start + clip.sourceRange.duration.ticks
  let nextStart = start
  let nextEnd = end
  if (clip.timeTransform.direction === 'forward') {
    nextStart += deltaTicks > 0 ? sourceDelta : -sourceDelta
  } else {
    nextEnd += deltaTicks > 0 ? -sourceDelta : sourceDelta
  }
  if (nextStart < 0 || nextEnd > totalSourceTicks) {
    const availableSource = clip.timeTransform.direction === 'forward' ? start : totalSourceTicks - end
    const available = compositionTicksForSourceOffset(availableSource, clip.timeTransform.playbackRate)
    return Object.freeze({ ok: false as const, plan: refusal('SOURCE_HANDLE_INSUFFICIENT', 'There is not enough recorded footage beyond that edge.', { requestedTicks: Math.abs(deltaTicks), availableTicks: available }) })
  }
  if (nextEnd <= nextStart) return Object.freeze({ ok: false as const, plan: refusal('SOURCE_OUT_OF_RANGE', 'That trim would remove the whole piece.') })
  const nextRange = Object.freeze({ start: mediaTime(nextStart), duration: mediaTime(nextEnd - nextStart) })
  const candidate: Clip = { ...clip, sourceRange: nextRange }
  const oldDuration = clipCompositionDurationTicks(clip)
  const newDuration = clipCompositionDurationTicks(candidate)
  if (newDuration <= 0) return Object.freeze({ ok: false as const, plan: refusal('SPEED_MAPPING_INVALID', 'That source window is too short to appear at this speed.') })
  const actual = deltaTicks > 0 ? oldDuration - newDuration : -(newDuration - oldDuration)
  const nextCompositionStart = keepCompositionStart
    ? clip.compositionStart.ticks
    : clipCompositionEndTicks(clip) - newDuration
  if (nextCompositionStart < 0) return Object.freeze({ ok: false as const, plan: refusal('TIMELINE_OUT_OF_RANGE', 'That extension would begin before the start of the video.') })
  return Object.freeze({
    ok: true as const,
    clip: Object.freeze({ ...candidate, compositionStart: mediaTime(nextCompositionStart) }),
    appliedDeltaTicks: actual,
  })
}

/** Change the source boundary that appears at the RIGHT side of a clip. Positive extends, negative trims. */
const changeViewerEnd = (
  project: EditProject,
  clip: Clip,
  deltaTicks: number,
): Readonly<{ ok: true; clip: Clip; appliedDeltaTicks: number }> | Readonly<{ ok: false; plan: PrecisionTrimPlan }> => {
  const totalSourceTicks = assetDuration(project, clip)
  if (totalSourceTicks === null) return Object.freeze({ ok: false as const, plan: refusal('ITEM_MISSING', 'The source file for that piece is not available in this project.') })
  if (isFreezeClip(clip)) return Object.freeze({ ok: false as const, plan: refusal('FREEZE_OPERATION_UNSUPPORTED', 'A held frame has one source instant, so its source edge cannot be trimmed.') })
  const sourceDelta = sourceMagnitude(clip, deltaTicks)
  if (sourceDelta <= 0) return Object.freeze({ ok: false as const, plan: refusal('SPEED_MAPPING_INVALID', 'That move is smaller than this clip can represent at its current speed.') })
  const start = clip.sourceRange.start.ticks
  const end = start + clip.sourceRange.duration.ticks
  let nextStart = start
  let nextEnd = end
  if (clip.timeTransform.direction === 'forward') {
    nextEnd += deltaTicks > 0 ? sourceDelta : -sourceDelta
  } else {
    nextStart += deltaTicks > 0 ? -sourceDelta : sourceDelta
  }
  if (nextStart < 0 || nextEnd > totalSourceTicks) {
    const availableSource = clip.timeTransform.direction === 'forward' ? totalSourceTicks - end : start
    const available = compositionTicksForSourceOffset(availableSource, clip.timeTransform.playbackRate)
    return Object.freeze({ ok: false as const, plan: refusal('SOURCE_HANDLE_INSUFFICIENT', 'There is not enough recorded footage beyond that edge.', { requestedTicks: Math.abs(deltaTicks), availableTicks: available }) })
  }
  if (nextEnd <= nextStart) return Object.freeze({ ok: false as const, plan: refusal('SOURCE_OUT_OF_RANGE', 'That trim would remove the whole piece.') })
  const candidate: Clip = Object.freeze({
    ...clip,
    sourceRange: Object.freeze({ start: mediaTime(nextStart), duration: mediaTime(nextEnd - nextStart) }),
  })
  const actual = clipCompositionDurationTicks(candidate) - clipCompositionDurationTicks(clip)
  if (clipCompositionDurationTicks(candidate) <= 0) return Object.freeze({ ok: false as const, plan: refusal('SPEED_MAPPING_INVALID', 'That source window is too short to appear at this speed.') })
  return Object.freeze({ ok: true as const, clip: candidate, appliedDeltaTicks: actual })
}

const liveGroupMembers = (
  group: TimelineGroupV1,
  existingItemIds: readonly string[] | undefined,
): readonly string[] => existingItemIds ? group.memberItemIds.filter((id) => existingItemIds.includes(id)) : group.memberItemIds

const groupConflict = (
  project: EditProject,
  affectedClipIds: readonly string[],
  existingItemIds: readonly string[] | undefined,
): PrecisionTrimPlan | null => {
  const affected = new Set(affectedClipIds.flatMap((id) => [`clip:${id}`, `dialogue:${id}`]))
  for (const group of activeTimelineGroups(project)) {
    const live = liveGroupMembers(group, existingItemIds)
    if (!live.some((id) => affected.has(id))) continue
    const unrelated = live.find((id) => !affected.has(id))
    if (unrelated) {
      return refusal('GROUP_CONFLICT', 'That precision edit would change only part of a group. Ungroup it, or select a compatible edit that includes the whole group.', { blockingItemId: unrelated })
    }
  }
  return null
}

const transitionStates = (project: EditProject) => {
  const map = new Map<string, Readonly<{ clipId: string; nextClipId: string; style: string; durationTicks: number }>>()
  for (const operation of activeOperations(project)) {
    if (operation.kind !== 'set-clip-transition') continue
    map.set(`${operation.clipId}\0${operation.nextClipId}`, Object.freeze({
      clipId: operation.clipId,
      nextClipId: operation.nextClipId,
      style: operation.style,
      durationTicks: operation.duration.ticks,
    }))
  }
  return [...map.values()]
}

const validateTransitions = (project: EditProject, composition: Composition): PrecisionTrimPlan | null => {
  for (const transition of transitionStates(project)) {
    if (transition.style === 'none') continue
    const left = findClip(composition, transition.clipId)
    const right = findClip(composition, transition.nextClipId)
    if (!left || !right || clipCompositionEndTicks(left) !== right.compositionStart.ticks) {
      return refusal('TRANSITION_CONFLICT', 'That precision edit would break a transition at this cut.', { blockingItemId: `clip:${transition.clipId}` })
    }
    const available = Math.min(clipCompositionDurationTicks(left), clipCompositionDurationTicks(right))
    if (transition.durationTicks > available) {
      return refusal('TRANSITION_CONFLICT', `That transition needs more handle than the trimmed clips would have. It was not shortened automatically.`, {
        blockingItemId: `clip:${transition.clipId}`,
        requestedTicks: transition.durationTicks,
        availableTicks: available,
      })
    }
  }
  return null
}

const lockConflict = (composition: Composition, clipId: string, lockedTrackIds: readonly string[] = []): PrecisionTrimPlan | null => {
  const track = primaryTrackOf(composition, clipId)
  if (!track) return refusal('ITEM_MISSING', 'That main-video piece is no longer on the timeline.')
  return lockedTrackIds.includes(track.trackId)
    ? refusal('TRACK_LOCKED', 'That row is locked. Unlock it and try again.')
    : null
}

const finalize = (
  input: PrecisionPlannerCommon,
  mode: PrecisionTrimModeV1,
  selectedClipId: string,
  requestedDeltaTicks: number,
  appliedDeltaTicks: number,
  changes: readonly PrimaryClipTimingChangeV1[],
  description: string,
): PrecisionTrimPlan => {
  const group = groupConflict(input.project, changes.map((change) => change.clipId), input.existingItemIds)
  if (group) return group
  const operationInput = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId,
    capabilityId: PRECISION_TIMING_PRIMITIVE_ID,
    kind: 'set-primary-clip-timings' as const,
    clipId: selectedClipId,
    changes: Object.freeze(changes),
    extensions: Object.freeze({}),
  })
  const checked = validateOperation(operationInput)
  if (!checked.ok || checked.value.kind !== 'set-primary-clip-timings') {
    return refusal('STALE_PROJECT', 'The precision edit could not be recorded against the current project. Nothing was changed.')
  }
  const dryRun = applyTimelineOperation(effectiveComposition(input.project), checked.value, input.project.assets)
  if (!dryRun.ok) {
    const code: PrecisionTrimRefusalCode = dryRun.error.reason === 'FREEZE_OPERATION_UNSUPPORTED'
      ? 'FREEZE_OPERATION_UNSUPPORTED'
      : dryRun.error.reason === 'CLIP_UNKNOWN'
        ? 'ITEM_MISSING'
        : 'COLLISION'
    return refusal(code, code === 'COLLISION'
      ? 'That precision edit would make clips overlap or leave an invalid Timeline state.'
      : 'That precision edit is no longer valid for the current project.')
  }
  const transition = validateTransitions(input.project, dryRun.value)
  if (transition) return transition
  const selected = findClip(dryRun.value, selectedClipId)
  if (!selected) return refusal('STALE_PROJECT', 'The selected piece changed before this edit could be planned.')
  return Object.freeze({
    ok: true as const,
    operation: checked.value,
    operations: Object.freeze([checked.value]),
    description,
    feedback: Object.freeze({
      mode,
      requestedDeltaTicks,
      appliedDeltaTicks,
      changes: checked.value.changes,
      affectedClipIds: Object.freeze(checked.value.changes.map((change) => change.clipId)),
      selectedStartTicks: selected.compositionStart.ticks,
      selectedDurationTicks: clipCompositionDurationTicks(selected),
      selectedSourceInTicks: selected.sourceRange.start.ticks,
      selectedSourceOutTicks: selected.sourceRange.start.ticks + selected.sourceRange.duration.ticks,
    }),
  })
}

export const planStandardTrim = (input: PrecisionPlannerCommon & Readonly<{
  clipId: string
  edge: PrecisionTrimEdgeV1
  /** Edge movement in composition ticks: start + means later; end + means later. */
  deltaTicks: number
}>): PrecisionTrimPlan => {
  if (!isValidIntegerDelta(input.deltaTicks)) return refusal('INVALID_EDIT_POINT', 'Move the trim edge by at least one whole tick.')
  const composition = effectiveComposition(input.project)
  const locked = lockConflict(composition, input.clipId, input.lockedTrackIds)
  if (locked) return locked
  const clip = findClip(composition, input.clipId)
  if (!clip) return refusal('ITEM_MISSING', 'That piece is no longer on the timeline.')
  if (!clip.enabled) return refusal('ITEM_DISABLED', 'Show this piece before trimming it.')
  const changed = input.edge === 'start'
    ? changeViewerStart(input.project, clip, input.deltaTicks, false)
    : changeViewerEnd(input.project, clip, input.deltaTicks)
  if (!changed.ok) return changed.plan
  const preserved = withPreservedLinkedAudio(input.project, clip, changed.clip)
  if (!preserved.ok) return preserved.plan
  // Standard trim never moves unrelated clips. Extension into a neighbor is a
  // real collision and the dry-run below refuses it.
  return finalize(input, 'standard-trim', clip.clipId, input.deltaTicks, changed.appliedDeltaTicks, [timingOf(preserved.clip)], `Trimmed the ${input.edge} of a piece`)
}

export const planRippleTrim = (input: PrecisionPlannerCommon & Readonly<{
  clipId: string
  edge: PrecisionTrimEdgeV1
  /** Start: + trims inward, - extends. End: + extends, - trims inward. */
  deltaTicks: number
}>): PrecisionTrimPlan => {
  if (!isValidIntegerDelta(input.deltaTicks)) return refusal('INVALID_EDIT_POINT', 'Move the ripple edge by at least one whole tick.')
  const composition = effectiveComposition(input.project)
  const locked = lockConflict(composition, input.clipId, input.lockedTrackIds)
  if (locked) return locked
  const clip = findClip(composition, input.clipId)
  if (!clip) return refusal('ITEM_MISSING', 'That piece is no longer on the timeline.')
  if (!clip.enabled) return refusal('ITEM_DISABLED', 'Show this piece before trimming it.')
  const changed = input.edge === 'start'
    ? changeViewerStart(input.project, clip, input.deltaTicks, true)
    : changeViewerEnd(input.project, clip, input.deltaTicks)
  if (!changed.ok) return changed.plan
  const preserved = withPreservedLinkedAudio(input.project, clip, changed.clip)
  if (!preserved.ok) return preserved.plan
  const oldDuration = clipCompositionDurationTicks(clip)
  const newDuration = clipCompositionDurationTicks(preserved.clip)
  const durationShift = newDuration - oldDuration
  const oldEnd = clipCompositionEndTicks(clip)
  const trackClips = ordered(composition, clip.clipId)
  const changes: PrimaryClipTimingChangeV1[] = [timingOf(preserved.clip)]
  for (const candidate of trackClips) {
    if (candidate.clipId === clip.clipId || candidate.compositionStart.ticks < oldEnd) continue
    changes.push(Object.freeze({
      ...timingOf(candidate),
      compositionStart: mediaTime(candidate.compositionStart.ticks + durationShift),
    }))
  }
  return finalize(input, 'ripple-trim', clip.clipId, input.deltaTicks, changed.appliedDeltaTicks, changes, 'Ripple trimmed a piece')
}

const adjacentCut = (composition: Composition, leftClipId: string, rightClipId: string) => {
  const running = ordered(composition, leftClipId)
  const leftIndex = running.findIndex((clip) => clip.clipId === leftClipId)
  if (leftIndex < 0 || running[leftIndex + 1]?.clipId !== rightClipId) return null
  const left = running[leftIndex]
  const right = running[leftIndex + 1]
  if (clipCompositionEndTicks(left) !== right.compositionStart.ticks) return null
  return Object.freeze({ left, right })
}

/** Find the nearest signed delta both sides of a cut can represent exactly. */
const matchedCutDelta = (
  project: EditProject,
  left: Clip,
  right: Clip,
  requested: number,
  mode: 'roll' | 'slide',
): Readonly<{ ok: true; delta: number; left: Clip; right: Clip }> | Readonly<{ ok: false; plan: PrecisionTrimPlan }> => {
  for (let distance = 0; distance <= 64; distance += 1) {
    const candidates = distance === 0 ? [requested] : [requested - distance, requested + distance]
    for (const candidateDelta of candidates) {
      if (candidateDelta === 0) continue
      const leftChanged = changeViewerEnd(project, left, candidateDelta)
      if (!leftChanged.ok) continue
      const rightChanged = changeViewerStart(project, right, candidateDelta, false)
      if (!rightChanged.ok) continue
      const leftAudio = withPreservedLinkedAudio(project, left, leftChanged.clip)
      if (!leftAudio.ok) continue
      const rightAudio = withPreservedLinkedAudio(project, right, rightChanged.clip)
      if (!rightAudio.ok) continue
      const leftEdge = clipCompositionEndTicks(leftAudio.clip)
      const rightEdge = rightAudio.clip.compositionStart.ticks
      const leftActual = leftEdge - clipCompositionEndTicks(left)
      const rightActual = rightEdge - right.compositionStart.ticks
      if (leftEdge !== rightEdge || leftActual !== rightActual) continue
      if (mode === 'roll') return Object.freeze({ ok: true as const, delta: leftActual, left: leftAudio.clip, right: rightAudio.clip })
      return Object.freeze({ ok: true as const, delta: leftActual, left: leftAudio.clip, right: rightAudio.clip })
    }
  }
  const leftAttempt = changeViewerEnd(project, left, requested)
  if (!leftAttempt.ok) return Object.freeze({ ok: false as const, plan: leftAttempt.plan })
  const rightAttempt = changeViewerStart(project, right, requested, false)
  if (!rightAttempt.ok) return Object.freeze({ ok: false as const, plan: rightAttempt.plan })
  return Object.freeze({ ok: false as const, plan: refusal('SPEED_MAPPING_INVALID', 'Those two clip speeds cannot represent the same edit-point movement exactly.') })
}

const matchedSlideDelta = (
  project: EditProject,
  left: Clip,
  right: Clip,
  requested: number,
): Readonly<{ ok: true; delta: number; left: Clip; right: Clip }> | Readonly<{ ok: false; plan: PrecisionTrimPlan }> => {
  // A Slide moves the middle clip without changing its source. Only the OUT of
  // the left neighbor and the IN of the right neighbor need source handles.
  // Searching the middle clip too would make a valid slide fail merely because
  // the selected clip happened to start at the beginning of its recording.
  for (let distance = 0; distance <= 64; distance += 1) {
    const candidates = distance === 0 ? [requested] : [requested - distance, requested + distance]
    for (const candidateDelta of candidates) {
      if (candidateDelta === 0) continue
      const leftChanged = changeViewerEnd(project, left, candidateDelta)
      if (!leftChanged.ok) continue
      const rightChanged = changeViewerStart(project, right, candidateDelta, false)
      if (!rightChanged.ok) continue
      const leftAudio = withPreservedLinkedAudio(project, left, leftChanged.clip)
      if (!leftAudio.ok) continue
      const rightAudio = withPreservedLinkedAudio(project, right, rightChanged.clip)
      if (!rightAudio.ok) continue
      const leftActual = clipCompositionEndTicks(leftAudio.clip) - clipCompositionEndTicks(left)
      const rightActual = rightAudio.clip.compositionStart.ticks - right.compositionStart.ticks
      if (leftActual !== rightActual) continue
      return Object.freeze({ ok: true as const, delta: leftActual, left: leftAudio.clip, right: rightAudio.clip })
    }
  }
  const leftAttempt = changeViewerEnd(project, left, requested)
  if (!leftAttempt.ok) return Object.freeze({ ok: false as const, plan: leftAttempt.plan })
  const rightAttempt = changeViewerStart(project, right, requested, false)
  if (!rightAttempt.ok) return Object.freeze({ ok: false as const, plan: rightAttempt.plan })
  return Object.freeze({
    ok: false as const,
    plan: refusal('SPEED_MAPPING_INVALID', 'The two neighboring clip speeds cannot represent the same exact slide distance.'),
  })
}

export const planRollTrim = (input: PrecisionPlannerCommon & Readonly<{
  leftClipId: string
  rightClipId: string
  deltaTicks: number
}>): PrecisionTrimPlan => {
  if (!isValidIntegerDelta(input.deltaTicks)) return refusal('INVALID_EDIT_POINT', 'Move the roll point by at least one whole tick.')
  const composition = effectiveComposition(input.project)
  for (const clipId of [input.leftClipId, input.rightClipId]) {
    const locked = lockConflict(composition, clipId, input.lockedTrackIds)
    if (locked) return locked
  }
  const cut = adjacentCut(composition, input.leftClipId, input.rightClipId)
  if (!cut) return refusal('EDIT_POINT_NOT_ADJACENT', 'Roll needs one real cut between two directly adjacent pieces.')
  if (!cut.left.enabled || !cut.right.enabled) return refusal('ITEM_DISABLED', 'Enable both pieces at this cut before rolling it.')
  if (isFreezeClip(cut.left) || isFreezeClip(cut.right)) {
    return refusal('FREEZE_OPERATION_UNSUPPORTED', 'This roll would have to change a held frame source edge, which has no source handle.')
  }
  const matched = matchedCutDelta(input.project, cut.left, cut.right, input.deltaTicks, 'roll')
  if (!matched.ok) return matched.plan
  const beforeDuration = clipCompositionEndTicks(cut.right)
  const afterDuration = clipCompositionEndTicks(matched.right)
  if (beforeDuration !== afterDuration) return refusal('TIMELINE_OUT_OF_RANGE', 'A roll must keep the total sequence length unchanged.')
  return finalize(input, 'roll', cut.left.clipId, input.deltaTicks, matched.delta, [timingOf(matched.left), timingOf(matched.right)], 'Rolled an edit point')
}

export const planSlipEdit = (input: PrecisionPlannerCommon & Readonly<{
  clipId: string
  deltaTicks: number
}>): PrecisionTrimPlan => {
  if (!isValidIntegerDelta(input.deltaTicks)) return refusal('INVALID_EDIT_POINT', 'Move the source by at least one whole tick.')
  const composition = effectiveComposition(input.project)
  const locked = lockConflict(composition, input.clipId, input.lockedTrackIds)
  if (locked) return locked
  const clip = findClip(composition, input.clipId)
  if (!clip) return refusal('ITEM_MISSING', 'That piece is no longer on the timeline.')
  if (!clip.enabled) return refusal('ITEM_DISABLED', 'Enable this piece before slipping its source.')
  if (isFreezeClip(clip)) return refusal('FREEZE_OPERATION_UNSUPPORTED', 'A held frame has one source instant, so there is no source interval to slip.')
  const sourceDelta = sourceTicksForCompositionOffset(Math.abs(input.deltaTicks), clip.timeTransform.playbackRate) * Math.sign(input.deltaTicks)
  if (sourceDelta === 0) return refusal('SPEED_MAPPING_INVALID', 'That slip is smaller than this clip can represent at its current speed.')
  const duration = assetDuration(input.project, clip)
  if (duration === null) return refusal('ITEM_MISSING', 'The source file for that piece is not available in this project.')
  const nextStart = clip.sourceRange.start.ticks + sourceDelta
  const nextEnd = nextStart + clip.sourceRange.duration.ticks
  if (nextStart < 0 || nextEnd > duration) {
    return refusal('SOURCE_HANDLE_INSUFFICIENT', 'There is not enough source footage to slip that far.')
  }
  const nextPicture: Clip = Object.freeze({
    ...clip,
    sourceRange: Object.freeze({ start: mediaTime(nextStart), duration: clip.sourceRange.duration }),
  })
  const preserved = withPreservedLinkedAudio(input.project, clip, nextPicture)
  if (!preserved.ok) return preserved.plan
  return finalize(input, 'slip', clip.clipId, input.deltaTicks, input.deltaTicks, [timingOf(preserved.clip)], 'Slipped the source inside a piece')
}

export const planSlideEdit = (input: PrecisionPlannerCommon & Readonly<{
  clipId: string
  deltaTicks: number
}>): PrecisionTrimPlan => {
  if (!isValidIntegerDelta(input.deltaTicks)) return refusal('INVALID_EDIT_POINT', 'Move the piece by at least one whole tick.')
  const composition = effectiveComposition(input.project)
  const running = ordered(composition, input.clipId)
  const index = running.findIndex((clip) => clip.clipId === input.clipId)
  if (index <= 0 || index >= running.length - 1) return refusal('EDIT_POINT_NOT_ADJACENT', 'Slide needs one neighboring piece on each side.')
  const left = running[index - 1]
  const selected = running[index]
  const right = running[index + 1]
  for (const clip of [left, selected, right]) {
    const locked = lockConflict(composition, clip.clipId, input.lockedTrackIds)
    if (locked) return locked
    if (!clip.enabled) return refusal('ITEM_DISABLED', 'Enable all three pieces before sliding the middle one.')
    if (isFreezeClip(clip)) return refusal('FREEZE_OPERATION_UNSUPPORTED', 'Slide cannot change a boundary owned by a held frame.')
  }
  if (clipCompositionEndTicks(left) !== selected.compositionStart.ticks || clipCompositionEndTicks(selected) !== right.compositionStart.ticks) {
    return refusal('EDIT_POINT_NOT_ADJACENT', 'Slide needs three pieces with no gaps between them.')
  }
  const matched = matchedSlideDelta(input.project, left, right, input.deltaTicks)
  if (!matched.ok) return matched.plan
  // The selected SOURCE stays byte-for-byte the same. Only its composition
  // start moves; the two neighbors exchange exactly that amount of Timeline
  // time around it.
  const delta = matched.delta
  const selectedMoved: Clip = Object.freeze({ ...selected, compositionStart: mediaTime(selected.compositionStart.ticks + delta) })
  if (clipCompositionEndTicks(matched.left) !== selectedMoved.compositionStart.ticks || clipCompositionEndTicks(selectedMoved) !== matched.right.compositionStart.ticks) {
    return refusal('COLLISION', 'That slide would not leave the three pieces exactly touching.')
  }
  const beforeEnd = clipCompositionEndTicks(right)
  const afterEnd = clipCompositionEndTicks(matched.right)
  if (beforeEnd !== afterEnd) return refusal('TIMELINE_OUT_OF_RANGE', 'A slide must keep the total sequence length unchanged.')
  return finalize(input, 'slide', selected.clipId, input.deltaTicks, delta, [timingOf(matched.left), timingOf(selectedMoved), timingOf(matched.right)], 'Slid a piece between its neighbors')
}

export type MultiEditPointPlanInput = PrecisionPlannerCommon & Readonly<{
  editPoints: readonly Readonly<{ leftClipId: string; rightClipId: string }>[]
  deltaTicks: number
}>

/** Compatible cuts roll together. One refusal blocks all of them. */
export const planMultiEditPointTrim = (input: MultiEditPointPlanInput): PrecisionTrimPlan => {
  if (input.editPoints.length === 0) return refusal('INVALID_MULTI_SELECTION', 'Select at least one edit point first.')
  const unique = new Set(input.editPoints.flatMap((point) => [point.leftClipId, point.rightClipId]))
  if (unique.size !== input.editPoints.length * 2) {
    return refusal('INVALID_MULTI_SELECTION', 'Selected edit points may not share the same clip in one multi-trim.')
  }
  const composition = effectiveComposition(input.project)
  const changes: PrimaryClipTimingChangeV1[] = []
  let applied: number | null = null
  for (const point of input.editPoints) {
    for (const clipId of [point.leftClipId, point.rightClipId]) {
      const locked = lockConflict(composition, clipId, input.lockedTrackIds)
      if (locked) return locked
    }
    const cut = adjacentCut(composition, point.leftClipId, point.rightClipId)
    if (!cut) return refusal('EDIT_POINT_NOT_ADJACENT', 'One selected edit point is no longer a direct cut.', { blockingItemId: `clip:${point.leftClipId}` })
    if (!cut.left.enabled || !cut.right.enabled) return refusal('ITEM_DISABLED', 'Enable every piece touching the selected edit points before trimming them together.', { blockingItemId: `clip:${point.leftClipId}` })
    if (isFreezeClip(cut.left) || isFreezeClip(cut.right)) return refusal('FREEZE_OPERATION_UNSUPPORTED', 'A selected edit point touches a held frame and cannot roll with the others.', { blockingItemId: `clip:${point.leftClipId}` })
    const matched = matchedCutDelta(input.project, cut.left, cut.right, input.deltaTicks, 'roll')
    if (!matched.ok) return matched.plan
    if (applied === null) applied = matched.delta
    if (matched.delta !== applied) return refusal('SPEED_MAPPING_INVALID', 'The selected edit points cannot all represent the same exact movement.')
    changes.push(timingOf(matched.left), timingOf(matched.right))
  }
  const anchor = input.editPoints[0].leftClipId
  return finalize(input, 'roll', anchor, input.deltaTicks, applied ?? input.deltaTicks, changes, `Trimmed ${input.editPoints.length} edit points together`)
}

export type PrecisionTrimRequestV1 =
  | Readonly<{ mode: 'standard-trim' | 'ripple-trim'; clipId: string; edge: PrecisionTrimEdgeV1; deltaTicks: number }>
  | Readonly<{ mode: 'roll'; leftClipId: string; rightClipId: string; deltaTicks: number }>
  | Readonly<{ mode: 'multi-roll'; editPoints: readonly Readonly<{ leftClipId: string; rightClipId: string }>[]; deltaTicks: number }>
  | Readonly<{ mode: 'slip' | 'slide'; clipId: string; deltaTicks: number }>

export const planPrecisionTrimRequest = (
  common: PrecisionPlannerCommon,
  request: PrecisionTrimRequestV1,
): PrecisionTrimPlan => {
  switch (request.mode) {
    case 'standard-trim':
      return planStandardTrim({ ...common, clipId: request.clipId, edge: request.edge, deltaTicks: request.deltaTicks })
    case 'ripple-trim':
      return planRippleTrim({ ...common, clipId: request.clipId, edge: request.edge, deltaTicks: request.deltaTicks })
    case 'roll':
      return planRollTrim({ ...common, leftClipId: request.leftClipId, rightClipId: request.rightClipId, deltaTicks: request.deltaTicks })
    case 'multi-roll':
      return planMultiEditPointTrim({ ...common, editPoints: request.editPoints, deltaTicks: request.deltaTicks })
    case 'slip':
      return planSlipEdit({ ...common, clipId: request.clipId, deltaTicks: request.deltaTicks })
    case 'slide':
      return planSlideEdit({ ...common, clipId: request.clipId, deltaTicks: request.deltaTicks })
  }
}

export const precisionPreview = <T extends PrecisionTrimPlan>(plan: T): T => plan

export const newPrecisionTrimSession = (input: Readonly<{
  sessionId: string
  mode: PrecisionTrimModeV1
  selectedItemIds: readonly string[]
  selectedEditPoints?: readonly TimelineEditPointRefV1[]
  originalPointerTicks: number
}>): PrecisionTrimSessionV1 => Object.freeze({
  sessionId: input.sessionId,
  mode: input.mode,
  selectedItemIds: Object.freeze([...input.selectedItemIds]),
  selectedEditPoints: Object.freeze([...(input.selectedEditPoints ?? [])]),
  originalPointerTicks: input.originalPointerTicks,
  rawDeltaTicks: 0,
  snappedDeltaTicks: 0,
  previewPlan: null,
  state: 'active',
  refusal: null,
})

export const updatePrecisionTrimSession = (
  session: PrecisionTrimSessionV1,
  rawDeltaTicks: number,
  snappedDeltaTicks: number,
  previewPlan: PrecisionTrimPlan,
): PrecisionTrimSessionV1 => Object.freeze({
  ...session,
  rawDeltaTicks,
  snappedDeltaTicks,
  previewPlan,
  state: previewPlan.ok ? 'valid' : 'refused',
  refusal: previewPlan.ok ? null : previewPlan.refusal,
})
