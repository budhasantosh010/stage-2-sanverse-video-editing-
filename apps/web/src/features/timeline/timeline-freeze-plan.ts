import {
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  applyTimelineOperation,
  effectiveComposition,
  findClip,
  mediaTime,
  validateOperation,
  type EditProject,
  type IdFactory,
} from '@sanverse/edit-domain'
import {
  FREEZE_FRAME_PRIMITIVE_ID,
} from '@sanverse/edit-domain/capabilities'
import {
  MAX_FREEZE_FRAME_TICKS,
  MIN_FREEZE_FRAME_TICKS,
  type InsertFreezeFrameOperation,
} from '@sanverse/edit-domain/timeline-operations'
import { clipCompositionDurationTicks, isFreezeClip } from '@sanverse/edit-domain/composition'

export type FreezeFramePlan =
  | Readonly<{ ok: true; operation: InsertFreezeFrameOperation; summary: string }>
  | Readonly<{ ok: false; message: string }>

const refuse = (message: string): FreezeFramePlan => Object.freeze({ ok: false, message })

/**
 * Insert a real held-frame segment at one exact composition tick.
 *
 * The hold is not speed zero. The accepted operation splits the moving clip,
 * inserts a distinct silent freeze segment, and ripples the right-hand picture
 * by the hold duration. One operation means one change set and one Undo.
 */
export const planFreezeFrame = (input: Readonly<{
  project: EditProject
  clipId: string
  atCompositionTicks: number
  durationTicks: number
  ids: IdFactory
}>): FreezeFramePlan => {
  const durationTicks = Math.round(input.durationTicks)
  if (
    !Number.isSafeInteger(durationTicks) ||
    durationTicks < MIN_FREEZE_FRAME_TICKS ||
    durationTicks > MAX_FREEZE_FRAME_TICKS
  ) {
    return refuse(
      `A held frame must last between ${(MIN_FREEZE_FRAME_TICKS / PROJECT_TIMESCALE).toFixed(1)} and ` +
      `${Math.round(MAX_FREEZE_FRAME_TICKS / PROJECT_TIMESCALE)} seconds.`,
    )
  }
  if (!Number.isSafeInteger(input.atCompositionTicks) || input.atCompositionTicks < 0) {
    return refuse('Move the playhead to a real moment inside the selected clip.')
  }

  const composition = effectiveComposition(input.project)
  const clip = findClip(composition, input.clipId)
  if (!clip) return refuse('That piece is no longer on the timeline.')
  if (isFreezeClip(clip)) return refuse('That piece is already a held frame.')
  if (clip.linkedAudio != null) {
    return refuse('Reset the J/L cut on this piece before inserting a held frame.')
  }

  const atClipTicks = input.atCompositionTicks - clip.compositionStart.ticks
  const clipDurationTicks = clipCompositionDurationTicks(clip)
  if (atClipTicks <= 0 || atClipTicks >= clipDurationTicks) {
    return refuse('Move the playhead inside the selected clip, not on its edge.')
  }

  const operation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operation(0),
    capabilityId: FREEZE_FRAME_PRIMITIVE_ID,
    kind: 'insert-freeze-frame' as const,
    clipId: input.clipId,
    atClipTime: mediaTime(atClipTicks),
    duration: mediaTime(durationTicks),
    freezeClipId: input.ids.entity('clip', 0),
    rightClipId: input.ids.entity('clip', 1),
    extensions: Object.freeze({}),
  })

  const checked = validateOperation(operation)
  if (!checked.ok) return refuse('That held-frame edit is not valid.')
  const dryRun = applyTimelineOperation(composition, checked.value as never, input.project.assets)
  if (!dryRun.ok) {
    switch (dryRun.error.reason) {
      case 'SPLIT_TIME_OUTSIDE_CLIP':
        return refuse('Move the playhead farther inside the selected clip.')
      case 'LINKED_AUDIO_WINDOW_CUSTOM':
        return refuse('Reset the J/L cut on this piece before inserting a held frame.')
      case 'CLIP_ID_IN_USE':
        return refuse('The held-frame edit could not create unique clip identities. Try again.')
      default:
        return refuse('A held frame cannot be inserted at that moment.')
    }
  }

  return Object.freeze({
    ok: true,
    operation: checked.value as InsertFreezeFrameOperation,
    summary: `Held one frame for ${(durationTicks / PROJECT_TIMESCALE).toFixed(2)} seconds`,
  })
}
