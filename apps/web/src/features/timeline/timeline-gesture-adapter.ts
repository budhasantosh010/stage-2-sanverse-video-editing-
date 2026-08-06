import {
  applyTimelineOperation,
  clipAtCompositionTime,
  effectiveComposition,
  findClip,
  validateOperation,
  type EditOperation,
  type EditProject,
  type Result,
  type TimelineOperation,
} from '@sanverse/edit-domain'
import { err, ok } from '@sanverse/edit-domain/result'

import {
  buildMoveAtPlayhead,
  buildRemoveAtPlayhead,
  buildSetAudioAtPlayhead,
  buildSetEnabledAtPlayhead,
  buildSplitAtPlayhead,
  buildTrimAtPlayhead,
  type TimelineEditResult,
} from './timeline-edits'

export type TimelineGesture =
  | Readonly<{ type: 'split'; atTicks: number }>
  | Readonly<{ type: 'remove-ripple'; atTicks: number }>
  | Readonly<{ type: 'remove-gap'; atTicks: number }>
  | Readonly<{ type: 'trim-start'; clipId: string; deltaTicks: number }>
  | Readonly<{ type: 'trim-end'; clipId: string; deltaTicks: number }>
  | Readonly<{ type: 'set-enabled'; clipId: string; enabled: boolean }>
  | Readonly<{ type: 'move-earlier'; clipId: string }>
  | Readonly<{ type: 'move-later'; clipId: string }>
  | Readonly<{
      type: 'set-audio'
      clipId: string
      gainDb: number
      fadeInTicks: number
      fadeOutTicks: number
    }>

export type TimelineGestureRefusalCode =
  | 'NO_TARGET'
  | 'GESTURE_OUT_OF_RANGE'
  | 'CLIP_UNKNOWN'
  | 'OPERATION_UNSUPPORTED'
  | 'PROPOSAL_PENDING'
  | 'EXPORT_IN_PROGRESS'
  | 'DOMAIN_REFUSAL'

export type TimelineGestureRefusal = Readonly<{
  code: TimelineGestureRefusalCode
  message: string
  domainCode: string | null
}>

export type AdaptTimelineGestureInput = Readonly<{
  project: EditProject
  gesture: TimelineGesture
  createOperationId(): string
  createClipId(): string
  pendingProposalExists: boolean
  exportInProgress: boolean
}>

const refuse = (
  code: TimelineGestureRefusalCode,
  message: string,
  domainCode: string | null = null,
): Result<EditOperation, TimelineGestureRefusal> =>
  err(Object.freeze({ code, message, domainCode }))

const validTicks = (ticks: number): boolean => Number.isSafeInteger(ticks) && ticks >= 0

/**
 * A deterministic point that selects this clip without landing on the next
 * clip's half-open boundary. One-tick clips have no strict interior and are
 * refused rather than addressed ambiguously.
 */
const interiorTick = (clip: ReturnType<typeof findClip>): number | null => {
  if (!clip || clip.sourceRange.duration.ticks <= 1) return null
  const offset = Math.max(1, Math.floor(clip.sourceRange.duration.ticks / 2))
  return clip.compositionStart.ticks + Math.min(offset, clip.sourceRange.duration.ticks - 1)
}

/**
 * Final safety gate after the existing UI builder has produced an operation.
 *
 * The operation is shape-validated and dry-run against the current effective
 * composition. The dry-run is pure: it proves the operation can be applied but
 * does not change the project, revision, history, or redo stack.
 */
const validateBuiltOperation = (
  project: EditProject,
  operation: TimelineOperation,
): Result<EditOperation, TimelineGestureRefusal> => {
  const validated = validateOperation(operation)
  if (!validated.ok || !('clipId' in validated.value)) {
    return refuse(
      'DOMAIN_REFUSAL',
      'The timeline gesture produced an operation the current domain refused.',
      validated.ok ? 'OPERATION_UNSUPPORTED' : validated.error.issues[0]?.code ?? 'OPERATION_INVALID',
    )
  }
  // The VALIDATED operation is what gets applied, not the one just built.
  // Validation is where an optional field becomes its documented default, so
  // applying the raw form would hand the composition an `undefined` where a
  // number belongs and the whole edit would be refused for no visible reason.
  const applied = applyTimelineOperation(
    effectiveComposition(project),
    validated.value as TimelineOperation,
    project.assets,
  )
  if (!applied.ok) {
    return refuse(
      'DOMAIN_REFUSAL',
      `The current project cannot apply this timeline edit: ${applied.error.reason}.`,
      applied.error.reason,
    )
  }
  return ok(validated.value)
}

/**
 * Translate a future timeline gesture into one existing Sanverse operation.
 *
 * Mapping:
 *
 * split          -> buildSplitAtPlayhead       -> split-clip
 * remove-ripple  -> buildRemoveAtPlayhead      -> remove-clip(ripple=true)
 * remove-gap     -> buildRemoveAtPlayhead      -> remove-clip(ripple=false)
 * trim start/end -> buildTrimAtPlayhead        -> trim-clip
 * set-enabled    -> buildSetEnabledAtPlayhead  -> set-clip-enabled
 * move earlier   -> buildMoveAtPlayhead        -> reorder-clip
 * move later     -> buildMoveAtPlayhead        -> reorder-clip
 * set-audio      -> buildSetAudioAtPlayhead    -> set-clip-audio
 *
 * It never creates a change set and never applies the result. The application
 * layer remains the only path from operation -> change set -> API -> history.
 */
export const adaptTimelineGesture = (
  input: AdaptTimelineGestureInput,
): Result<EditOperation, TimelineGestureRefusal> => {
  if (input.pendingProposalExists) {
    return refuse('PROPOSAL_PENDING', 'Finish the pending proposal before changing the timeline.')
  }
  if (input.exportInProgress) {
    return refuse('EXPORT_IN_PROGRESS', 'Wait for the current export to finish before changing the timeline.')
  }

  const composition = effectiveComposition(input.project)
  const gesture = input.gesture
  let built: TimelineEditResult

  if (gesture.type === 'split') {
    if (!validTicks(gesture.atTicks)) {
      return refuse('GESTURE_OUT_OF_RANGE', 'Choose a whole-tick moment inside the video.')
    }
    const clip = clipAtCompositionTime(composition, {
      ticks: gesture.atTicks,
      timescale: input.project.timescale,
    })
    if (!clip) return refuse('NO_TARGET', 'There is no section at that moment.')
    const atClipTime = gesture.atTicks - clip.compositionStart.ticks
    if (atClipTime <= 0 || atClipTime >= clip.sourceRange.duration.ticks) {
      return refuse('GESTURE_OUT_OF_RANGE', 'A split must be inside a section, not on its edge.')
    }
    built = buildSplitAtPlayhead(
      composition,
      gesture.atTicks,
      input.createOperationId,
      input.createClipId,
    )
  } else if (gesture.type === 'remove-ripple' || gesture.type === 'remove-gap') {
    if (!validTicks(gesture.atTicks)) {
      return refuse('GESTURE_OUT_OF_RANGE', 'Choose a whole-tick moment inside the video.')
    }
    const clip = clipAtCompositionTime(composition, {
      ticks: gesture.atTicks,
      timescale: input.project.timescale,
    })
    if (!clip) return refuse('NO_TARGET', 'There is no section at that moment.')
    built = buildRemoveAtPlayhead(
      composition,
      gesture.atTicks,
      input.createOperationId,
      gesture.type === 'remove-ripple',
    )
  } else {
    const clip = findClip(composition, gesture.clipId)
    if (!clip) return refuse('CLIP_UNKNOWN', 'That section is not in the current finished video.')
    const playheadTicks = interiorTick(clip)
    if (playheadTicks === null) {
      return refuse('NO_TARGET', 'That section is too short to address safely.')
    }

    switch (gesture.type) {
      case 'trim-start':
      case 'trim-end':
        if (!validTicks(gesture.deltaTicks) || gesture.deltaTicks <= 0) {
          return refuse('GESTURE_OUT_OF_RANGE', 'Choose a positive whole-tick trim amount.')
        }
        built = buildTrimAtPlayhead(
          composition,
          playheadTicks,
          gesture.type === 'trim-start' ? 'start' : 'end',
          gesture.deltaTicks,
          true,
          input.createOperationId,
        )
        break
      case 'set-enabled':
        built = buildSetEnabledAtPlayhead(
          composition,
          playheadTicks,
          gesture.enabled,
          input.createOperationId,
        )
        break
      case 'move-earlier':
      case 'move-later':
        built = buildMoveAtPlayhead(
          composition,
          playheadTicks,
          gesture.type === 'move-earlier' ? 'earlier' : 'later',
          input.createOperationId,
        )
        break
      case 'set-audio':
        if (
          !validTicks(gesture.fadeInTicks) ||
          !validTicks(gesture.fadeOutTicks) ||
          !Number.isFinite(gesture.gainDb)
        ) {
          return refuse('GESTURE_OUT_OF_RANGE', 'Loudness and fades must be finite whole-tick values.')
        }
        built = buildSetAudioAtPlayhead(
          composition,
          playheadTicks,
          gesture.gainDb,
          gesture.fadeInTicks,
          gesture.fadeOutTicks,
          input.createOperationId,
        )
        break
      default: {
        const unreachable: never = gesture
        void unreachable
        return refuse('OPERATION_UNSUPPORTED', 'This timeline gesture is not supported.')
      }
    }
  }

  if (!built.ok) return refuse('DOMAIN_REFUSAL', built.refusal.reason)
  return validateBuiltOperation(input.project, built.operation)
}
