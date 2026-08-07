import {
  CLIP_TRANSITION_PRIMITIVE_ID,
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  activeOperations,
  applyTimelineOperation,
  effectiveComposition,
  validateOperation,
  type EditProject,
  type SetClipTransitionOperation,
} from '@sanverse/edit-domain'

export type TransitionStyleV1 = SetClipTransitionOperation['style']
export type TransitionAudioV1 = SetClipTransitionOperation['audio']

export type TimelineTransitionSubject = Readonly<{
  clipId: string
  nextClipId: string
  clipLabel: string
  nextClipLabel: string
  style: TransitionStyleV1
  durationTicks: number
  audio: TransitionAudioV1
}>

export type TimelineTransitionPlan =
  | Readonly<{ ok: true; operation: SetClipTransitionOperation; summary: string }>
  | Readonly<{ ok: false; message: string }>

const refuse = (message: string): TimelineTransitionPlan => Object.freeze({ ok: false, message })

/** Latest accepted transition authority for one join; `none` is a real reset. */
export const currentTransitionFor = (
  project: EditProject,
  clipId: string,
  nextClipId: string,
): Readonly<{ style: TransitionStyleV1; durationTicks: number; audio: TransitionAudioV1 }> => {
  let style: TransitionStyleV1 = 'none'
  let durationTicks = 0
  let audio: TransitionAudioV1 = 'cut'
  for (const operation of activeOperations(project)) {
    if (
      operation.kind !== 'set-clip-transition' ||
      operation.clipId !== clipId ||
      operation.nextClipId !== nextClipId
    ) continue
    style = operation.style
    durationTicks = operation.duration.ticks
    audio = operation.audio
  }
  return Object.freeze({ style, durationTicks, audio })
}

/** One chooser/range/numeric edit becomes exactly one existing transition operation. */
export const planTimelineTransition = (input: Readonly<{
  project: EditProject
  clipId: string
  nextClipId: string
  style: TransitionStyleV1
  durationTicks: number
  audio: TransitionAudioV1
  operationId: string
}>): TimelineTransitionPlan => {
  const durationTicks = input.style === 'none' ? 0 : Math.round(input.durationTicks)
  if (!Number.isSafeInteger(durationTicks) || durationTicks < 0 || durationTicks > 2 * PROJECT_TIMESCALE) {
    return refuse('Transition duration must be between 0 and 2 seconds.')
  }
  if (input.style !== 'none' && durationTicks <= 0) {
    return refuse('Choose a transition duration greater than zero.')
  }
  const operation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId,
    capabilityId: CLIP_TRANSITION_PRIMITIVE_ID,
    kind: 'set-clip-transition' as const,
    clipId: input.clipId,
    nextClipId: input.nextClipId,
    style: input.style,
    duration: Object.freeze({ ticks: durationTicks, timescale: PROJECT_TIMESCALE }),
    audio: input.style === 'none' ? 'cut' as const : input.audio,
    extensions: Object.freeze({}),
  })
  const checked = validateOperation(operation)
  if (!checked.ok) return refuse('That transition setting is not valid.')
  const applied = applyTimelineOperation(
    effectiveComposition(input.project),
    checked.value as never,
    input.project.assets,
  )
  if (!applied.ok) {
    switch (applied.error.reason) {
      case 'TRANSITION_TARGET_INVALID':
        return refuse('Those two pieces are no longer directly next to each other.')
      case 'TRANSITION_LONGER_THAN_CLIP':
        return refuse('That transition is longer than one of the two pieces can support.')
      case 'LINKED_AUDIO_WINDOW_CUSTOM':
        return refuse('Reset the J/L cut on this join before adding an audio transition.')
      default:
        return refuse('That transition cannot be applied at this join.')
    }
  }
  const summary = input.style === 'none'
    ? 'Removed the transition'
    : input.style === 'dip-to-white'
      ? 'Dipped through white'
      : 'Dipped through black'
  return Object.freeze({ ok: true, operation: checked.value as SetClipTransitionOperation, summary })
}