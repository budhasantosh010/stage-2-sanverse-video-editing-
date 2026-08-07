import {
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  applyTimelineOperation,
  effectiveComposition,
  findAsset,
  findClip,
  isVideoAsset,
  mediaTime,
  validateOperation,
  type EditOperation,
  type EditProject,
  type IdFactory,
} from '@sanverse/edit-domain'
import {
  MOVE_PRIMARY_CLIP_PRIMITIVE_ID,
  PLACE_PRIMARY_CLIP_PRIMITIVE_ID,
  REMOVE_PRIMITIVE_ID,
  REORDER_PRIMITIVE_ID,
} from '@sanverse/edit-domain/capabilities'
import { clipCompositionDurationTicks, type Clip, type Composition, type Track } from '@sanverse/edit-domain/composition'

import { planRateStretch } from './timeline-speed-plan'
import { laneSpans } from './timeline-item-operations'
import { planTimelinePlacement, type PlacementResult } from './timeline-placement-planner'

/**
 * T2.9 contains six CREATOR INTENTS, not six new operation families.
 *
 * Every planner below composes operations the editor already knows how to
 * validate, replay, undo, preview and export. The planner is the policy; React
 * is only allowed to ask it a question and display the answer.
 */
export type AdvancedPlacementPlan =
  | Readonly<{ ok: true; operations: readonly EditOperation[]; summary: string }>
  | Readonly<{ ok: false; message: string }>

const refuse = (message: string): AdvancedPlacementPlan => Object.freeze({ ok: false, message })
const okay = (operations: readonly EditOperation[], summary: string): AdvancedPlacementPlan =>
  Object.freeze({ ok: true, operations: Object.freeze([...operations]), summary })

const videoTrackForClip = (composition: Composition, clipId: string): Track | null =>
  composition.tracks.find((track) => track.kind === 'video' && track.clips.some((clip) => clip.clipId === clipId)) ?? null

const ordered = (track: Track): readonly Clip[] => Object.freeze(
  track.clips.slice().sort((a, b) => a.compositionStart.ticks - b.compositionStart.ticks || a.clipId.localeCompare(b.clipId)),
)

const gapless = (track: Track): boolean => {
  const clips = ordered(track)
  for (let index = 1; index < clips.length; index += 1) {
    const before = clips[index - 1]
    if (before.compositionStart.ticks + clipCompositionDurationTicks(before) !== clips[index].compositionStart.ticks) return false
  }
  return true
}

const build = (raw: unknown): EditOperation | null => {
  const checked = validateOperation(raw)
  return checked.ok ? checked.value : null
}

/** Prove every operation against the composition produced by the one before it. */
const dryRun = (
  project: EditProject,
  operations: readonly EditOperation[],
): boolean => {
  let composition = effectiveComposition(project)
  for (const operation of operations) {
    const applied = applyTimelineOperation(composition, operation as never, project.assets)
    if (!applied.ok) return false
    composition = applied.value
  }
  return true
}

const placePrimary = (input: Readonly<{
  operationId: string
  clipId: string
  trackId: string
  assetId: string
  sourceStartTicks: number
  sourceDurationTicks: number
  compositionStartTicks: number
}>): EditOperation | null => build(Object.freeze({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: input.operationId,
  capabilityId: PLACE_PRIMARY_CLIP_PRIMITIVE_ID,
  kind: 'place-primary-clip' as const,
  clipId: input.clipId,
  trackId: input.trackId,
  assetId: input.assetId,
  sourceRange: Object.freeze({
    start: mediaTime(input.sourceStartTicks),
    duration: mediaTime(input.sourceDurationTicks),
  }),
  compositionStart: mediaTime(input.compositionStartTicks),
  extensions: Object.freeze({}),
}))

const movePrimary = (clipId: string, ticks: number, operationId: string): EditOperation | null =>
  build(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId,
    capabilityId: MOVE_PRIMARY_CLIP_PRIMITIVE_ID,
    kind: 'move-primary-clip' as const,
    clipId,
    compositionStart: mediaTime(ticks),
    extensions: Object.freeze({}),
  }))

const removePrimary = (clipId: string, ripple: boolean, operationId: string): EditOperation | null =>
  build(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId,
    capabilityId: REMOVE_PRIMITIVE_ID,
    kind: 'remove-clip' as const,
    clipId,
    ripple,
    extensions: Object.freeze({}),
  }))

const reorderPrimary = (clipId: string, toIndex: number, operationId: string): EditOperation | null =>
  build(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId,
    capabilityId: REORDER_PRIMITIVE_ID,
    kind: 'reorder-clip' as const,
    clipId,
    toIndex,
    extensions: Object.freeze({}),
  }))

/**
 * REPLACE — put a different recording in exactly the selected picture slot.
 *
 * It deliberately does NOT change speed. If the chosen source does not contain
 * enough footage for the slot, the planner refuses and Fit Source to Duration
 * is the explicit alternative. The temporary end placement keeps every
 * intermediate composition valid even when the selected clip is the only clip.
 */
export const planReplacePrimary = (input: Readonly<{
  project: EditProject
  targetClipId: string
  assetId: string
  sourceStartTicks?: number
  ids: IdFactory
}>): AdvancedPlacementPlan => {
  const composition = effectiveComposition(input.project)
  const target = findClip(composition, input.targetClipId)
  const track = videoTrackForClip(composition, input.targetClipId)
  const asset = findAsset(input.project.assets, input.assetId)
  if (!target || !track) return refuse('Choose a piece of the main video to replace.')
  if (!asset || !isVideoAsset(asset)) return refuse('Replace needs a video file from this project.')
  const duration = clipCompositionDurationTicks(target)
  const sourceStart = Math.max(0, Math.round(input.sourceStartTicks ?? 0))
  if (!Number.isSafeInteger(sourceStart) || sourceStart + duration > asset.duration.ticks) {
    return refuse('That source does not contain enough footage for this slot. Use Fit Source to Duration instead.')
  }

  const newClipId = input.ids.entity('clip', 0)
  const trackEnd = ordered(track).reduce(
    (end, clip) => Math.max(end, clip.compositionStart.ticks + clipCompositionDurationTicks(clip)),
    0,
  )
  const operations = [
    placePrimary({
      operationId: input.ids.operation(0),
      clipId: newClipId,
      trackId: track.trackId,
      assetId: asset.assetId,
      sourceStartTicks: sourceStart,
      sourceDurationTicks: duration,
      compositionStartTicks: trackEnd,
    }),
    removePrimary(target.clipId, false, input.ids.operation(1)),
    movePrimary(newClipId, target.compositionStart.ticks, input.ids.operation(2)),
  ]
  if (operations.some((operation) => operation === null)) return refuse('That replacement could not be expressed safely.')
  const complete = operations as readonly EditOperation[]
  if (!dryRun(input.project, complete)) return refuse('That replacement would collide with another piece.')
  return okay(complete, 'Replaced the selected main-video slot')
}

/** FIT SOURCE TO DURATION — exactly the existing rational Rate Stretch authority. */
export const planFitSourceToDuration = (input: Readonly<{
  project: EditProject
  clipId: string
  targetDurationTicks: number
  durationPolicy: 'ripple' | 'preserve-start'
  operationId: string
}>): AdvancedPlacementPlan => {
  const clip = findClip(effectiveComposition(input.project), input.clipId)
  if (!clip) return refuse('Choose a piece of the main video to fit.')
  const planned = planRateStretch({
    composition: effectiveComposition(input.project),
    clipId: input.clipId,
    targetDurationTicks: input.targetDurationTicks,
    direction: clip.timeTransform.direction,
    maintainAudioPitch: clip.timeTransform.maintainAudioPitch,
    durationPolicy: input.durationPolicy,
    lockedTrackIds: [],
    operationId: input.operationId,
  })
  if (!planned.ok) return refuse(planned.refusal.message)
  return okay(planned.operations, 'Fit the source to the chosen duration')
}

/** PLACE ON TOP — the existing V2 overlay placement and collision rules, unchanged. */
export const planPlaceOnTop = (input: Readonly<{
  project: EditProject
  assetId: string
  atTicks: number
  ids: IdFactory
}>): AdvancedPlacementPlan => {
  const planned: PlacementResult = planTimelinePlacement({
    project: input.project,
    assetId: input.assetId,
    targetLaneId: 'lane:overlay',
    atTicks: input.atTicks,
    placementMode: 'normal',
    includeLinkedAudio: false,
    expectedRevision: input.project.revision,
    idFactory: input.ids,
  }, { spans: laneSpans(input.project, 'V2') })
  if (!planned.ok) return refuse(planned.error.message)
  return okay(planned.value.operations, 'Placed the source on top of the main video')
}

/**
 * RIPPLE OVERWRITE — replace one complete primary clip and let the sequence
 * become longer or shorter by the incoming source duration.
 *
 * The incoming clip is first parked at the end so the composition is never
 * temporarily empty. After the target is ripple-removed, later clips are moved
 * from right to left to create exactly the new amount of room, then the parked
 * source moves into that room. All operations are one change set.
 */
export const planRippleOverwritePrimary = (input: Readonly<{
  project: EditProject
  targetClipId: string
  assetId: string
  sourceStartTicks?: number
  sourceDurationTicks?: number
  ids: IdFactory
}>): AdvancedPlacementPlan => {
  const composition = effectiveComposition(input.project)
  const target = findClip(composition, input.targetClipId)
  const track = videoTrackForClip(composition, input.targetClipId)
  const asset = findAsset(input.project.assets, input.assetId)
  if (!target || !track) return refuse('Choose one main-video piece to ripple overwrite.')
  if (!gapless(track)) return refuse('Ripple Overwrite needs a gapless main sequence. Close the gaps first.')
  if (!asset || !isVideoAsset(asset)) return refuse('Ripple Overwrite needs a video file from this project.')
  const sourceStart = Math.max(0, Math.round(input.sourceStartTicks ?? 0))
  const sourceDuration = Math.round(input.sourceDurationTicks ?? (asset.duration.ticks - sourceStart))
  if (
    !Number.isSafeInteger(sourceStart) || !Number.isSafeInteger(sourceDuration) ||
    sourceDuration <= 0 || sourceStart + sourceDuration > asset.duration.ticks
  ) return refuse('Choose a real source range for Ripple Overwrite.')

  const clips = ordered(track)
  const targetIndex = clips.findIndex((clip) => clip.clipId === target.clipId)
  const oldDuration = clipCompositionDurationTicks(target)
  const trackEnd = clips[clips.length - 1].compositionStart.ticks + clipCompositionDurationTicks(clips[clips.length - 1])
  const newClipId = input.ids.entity('clip', 0)
  const operations: EditOperation[] = []
  const parking = placePrimary({
    operationId: input.ids.operation(0),
    clipId: newClipId,
    trackId: track.trackId,
    assetId: asset.assetId,
    sourceStartTicks: sourceStart,
    sourceDurationTicks: sourceDuration,
    compositionStartTicks: trackEnd,
  })
  const removal = removePrimary(target.clipId, true, input.ids.operation(1))
  const parkAfterRemoval = movePrimary(newClipId, trackEnd - oldDuration + sourceDuration, input.ids.operation(2))
  if (!parking || !removal || !parkAfterRemoval) return refuse('Ripple Overwrite could not be expressed safely.')
  operations.push(parking, removal, parkAfterRemoval)

  const later = clips.slice(targetIndex + 1).reverse()
  later.forEach((clip, index) => {
    const moved = movePrimary(
      clip.clipId,
      clip.compositionStart.ticks - oldDuration + sourceDuration,
      input.ids.operation(3 + index),
    )
    if (moved) operations.push(moved)
  })
  const finalMove = movePrimary(newClipId, target.compositionStart.ticks, input.ids.operation(3 + later.length))
  if (!finalMove) return refuse('Ripple Overwrite could not place the incoming source.')
  operations.push(finalMove)
  if (!dryRun(input.project, operations)) return refuse('Ripple Overwrite would create an invalid overlap.')
  return okay(operations, 'Ripple-overwrote the selected main-video piece')
}

/** SWAP — exchange two positions in one gapless main track using reorder only. */
export const planSwapPrimary = (input: Readonly<{
  project: EditProject
  firstClipId: string
  secondClipId: string
  ids: IdFactory
}>): AdvancedPlacementPlan => {
  if (input.firstClipId === input.secondClipId) return refuse('Pick two different pieces to swap.')
  const composition = effectiveComposition(input.project)
  const firstTrack = videoTrackForClip(composition, input.firstClipId)
  const secondTrack = videoTrackForClip(composition, input.secondClipId)
  if (!firstTrack || !secondTrack || firstTrack.trackId !== secondTrack.trackId) {
    return refuse('Swap needs two pieces on the same main-video track.')
  }
  if (!gapless(firstTrack)) return refuse('Swap needs a gapless main sequence. Close the gaps first.')
  const clips = ordered(firstTrack)
  const firstIndex = clips.findIndex((clip) => clip.clipId === input.firstClipId)
  const secondIndex = clips.findIndex((clip) => clip.clipId === input.secondClipId)
  const leftIndex = Math.min(firstIndex, secondIndex)
  const rightIndex = Math.max(firstIndex, secondIndex)
  const leftId = clips[leftIndex].clipId
  const rightId = clips[rightIndex].clipId
  const operations = [
    reorderPrimary(leftId, rightIndex, input.ids.operation(0)),
    reorderPrimary(rightId, leftIndex, input.ids.operation(1)),
  ]
  if (operations.some((operation) => operation === null)) return refuse('Those pieces cannot be swapped.')
  const complete = operations as readonly EditOperation[]
  if (!dryRun(input.project, complete)) return refuse('Those pieces cannot be swapped without changing a gap.')
  return okay(complete, 'Swapped two main-video pieces')
}

const seededUnit = (seed: number): (() => number) => {
  let state = (Math.trunc(seed) >>> 0) || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
}

/**
 * SHUFFLE — deterministic Fisher-Yates from an explicit integer seed.
 * No Math.random, no hidden time and no renderer state. Same project + seed
 * yields the same requested order, and the result is expressed only as reorders.
 */
export const planShufflePrimary = (input: Readonly<{
  project: EditProject
  trackId: string
  seed: number
  ids: IdFactory
}>): AdvancedPlacementPlan => {
  if (!Number.isSafeInteger(input.seed)) return refuse('Shuffle needs a whole-number seed.')
  const composition = effectiveComposition(input.project)
  const track = composition.tracks.find((candidate) => candidate.trackId === input.trackId && candidate.kind === 'video')
  if (!track) return refuse('Choose a main-video track to shuffle.')
  if (!gapless(track)) return refuse('Shuffle needs a gapless main sequence. Close the gaps first.')
  const current = ordered(track).map((clip) => clip.clipId)
  if (current.length < 2) return refuse('Shuffle needs at least two pieces.')
  const wanted = [...current]
  const random = seededUnit(input.seed)
  for (let index = wanted.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1))
    ;[wanted[index], wanted[swapWith]] = [wanted[swapWith], wanted[index]]
  }
  if (wanted.every((clipId, index) => clipId === current[index])) {
    wanted.push(wanted.shift() as string)
  }

  const working = [...current]
  const operations: EditOperation[] = []
  let slot = 0
  for (let index = 0; index < wanted.length; index += 1) {
    if (working[index] === wanted[index]) continue
    const from = working.indexOf(wanted[index], index + 1)
    const movedId = wanted[index]
    const operation = reorderPrimary(movedId, index, input.ids.operation(slot))
    if (!operation) return refuse('The shuffled order could not be expressed safely.')
    operations.push(operation)
    working.splice(from, 1)
    working.splice(index, 0, movedId)
    slot += 1
  }
  if (!dryRun(input.project, operations)) return refuse('That shuffled order is not valid for this track.')
  return okay(operations, `Shuffled ${current.length} main-video pieces with seed ${input.seed}`)
}
