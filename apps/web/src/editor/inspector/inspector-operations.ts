import {
  CALLOUT_PRIMITIVE_ID,
  CAPTION_CUE_PRIMITIVE_ID,
  CAPTION_STYLE_PRIMITIVE_ID,
  CLIP_AUDIO_PRIMITIVE_ID,
  CLIP_ENABLED_PRIMITIVE_ID,
  CLIP_TRANSITION_PRIMITIVE_ID,
  MEDIA_OVERLAY_PRIMITIVE_ID,
  MUSIC_PRIMITIVE_ID,
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  TITLE_PRIMITIVE_ID,
  VISUAL_PROPERTIES_PRIMITIVE_ID,
  validateOperation,
  type CaptionStyleId,
  type EditOperation,
  type NormalizedRect,
  type SetClipTransitionOperation,
  type TitlePlacement,
  type TitleStyleId,
  type VisualProperties,
} from '@sanverse/edit-domain'

import type {
  InspectorCaptionSelection,
  InspectorCalloutSelection,
  InspectorDialogueSelection,
  InspectorMediaOverlaySelection,
  InspectorMusicSelection,
  InspectorTitleSelection,
  InspectorVideoClipSelection,
  InspectorVisualFields,
} from './inspector-contract'

export type InspectorOperationBuildResult =
  | Readonly<{ ok: true; operation: EditOperation }>
  | Readonly<{ ok: false; message: string }>

export type InspectorClipSelection = InspectorVideoClipSelection | InspectorDialogueSelection
export type InspectorVisualSelection = InspectorVisualFields & Readonly<{ projectRevision: number }>

const time = (ticks: number) => Object.freeze({
  ticks,
  timescale: PROJECT_TIMESCALE,
})

const isWholeTick = (value: number): boolean => Number.isSafeInteger(value) && value >= 0

const validateRange = (startTicks: number, endTicks: number): string | null => {
  if (!isWholeTick(startTicks) || !isWholeTick(endTicks)) return 'Timing must use positive whole project ticks.'
  if (endTicks <= startTicks) return 'The end must be after the start.'
  return null
}

const finish = (candidate: unknown, fallback: string): InspectorOperationBuildResult => {
  const validated = validateOperation(candidate)
  if (!validated.ok) return Object.freeze({ ok: false, message: fallback })
  return Object.freeze({ ok: true, operation: validated.value })
}

const common = (operationId: string) => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId,
  extensions: Object.freeze({}),
}) as const

export const buildClipEnabledOperation = (
  selection: InspectorClipSelection,
  enabled: boolean,
  operationId: string,
): InspectorOperationBuildResult => finish({
  ...common(operationId),
  kind: 'set-clip-enabled',
  capabilityId: CLIP_ENABLED_PRIMITIVE_ID,
  clipId: selection.clip.clipId,
  enabled,
}, 'That visibility setting is not valid for this clip.')

export type ClipAudioDraft = Readonly<{
  gainDb: number
  fadeInTicks: number
  fadeOutTicks: number
}>

export const buildClipAudioOperation = (
  selection: InspectorClipSelection,
  draft: ClipAudioDraft,
  operationId: string,
): InspectorOperationBuildResult => {
  if (!isWholeTick(draft.fadeInTicks) || !isWholeTick(draft.fadeOutTicks)) {
    return Object.freeze({ ok: false, message: 'Fade lengths must be zero or positive whole ticks.' })
  }
  if (draft.fadeInTicks + draft.fadeOutTicks > selection.clip.sourceRange.duration.ticks) {
    return Object.freeze({ ok: false, message: 'The two fades cannot be longer than this clip.' })
  }
  return finish({
    ...common(operationId),
    kind: 'set-clip-audio',
    capabilityId: CLIP_AUDIO_PRIMITIVE_ID,
    clipId: selection.clip.clipId,
    gainDb: draft.gainDb,
    fadeIn: time(draft.fadeInTicks),
    fadeOut: time(draft.fadeOutTicks),
  }, 'That sound setting is outside the supported range.')
}

export type ClipTransitionDraft = Readonly<{
  style: SetClipTransitionOperation['style']
  durationTicks: number
  audio: SetClipTransitionOperation['audio']
}>

export const buildClipTransitionOperation = (
  selection: InspectorClipSelection,
  draft: ClipTransitionDraft,
  operationId: string,
): InspectorOperationBuildResult => {
  if (!selection.nextClipId) {
    return Object.freeze({ ok: false, message: 'This clip has no adjacent next clip for a transition.' })
  }
  if (!isWholeTick(draft.durationTicks)) {
    return Object.freeze({ ok: false, message: 'Transition length must use whole project ticks.' })
  }
  const durationTicks = draft.style === 'none' ? 0 : draft.durationTicks
  if (draft.style !== 'none' && durationTicks <= 0) {
    return Object.freeze({ ok: false, message: 'Choose a positive transition length.' })
  }
  return finish({
    ...common(operationId),
    kind: 'set-clip-transition',
    capabilityId: CLIP_TRANSITION_PRIMITIVE_ID,
    clipId: selection.clip.clipId,
    nextClipId: selection.nextClipId,
    style: draft.style,
    duration: time(durationTicks),
    audio: draft.style === 'none' ? 'cut' : draft.audio,
  }, 'That transition is not valid between these two clips.')
}

export type CaptionCueDraft = Readonly<{
  lines: readonly string[]
  startTicks: number
  endTicks: number
}>

export const buildCaptionCueOperation = (
  selection: InspectorCaptionSelection,
  draft: CaptionCueDraft,
  operationId: string,
): InspectorOperationBuildResult => {
  const rangeError = validateRange(draft.startTicks, draft.endTicks)
  if (rangeError) return Object.freeze({ ok: false, message: rangeError })
  return finish({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId,
    kind: 'set-caption-cue',
    capabilityId: CAPTION_CUE_PRIMITIVE_ID,
    captionSetId: selection.captionSet.captionSetId,
    cueId: selection.cue.cueId,
    sourceInterval: {
      start: time(draft.startTicks),
      duration: time(draft.endTicks - draft.startTicks),
    },
    lines: Object.freeze([...draft.lines]),
  }, 'Check the caption text and timing. Nothing was changed.')
}

export const buildCaptionStyleOperation = (
  selection: InspectorCaptionSelection,
  styleId: CaptionStyleId,
  operationId: string,
): InspectorOperationBuildResult => finish({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId,
  kind: 'set-caption-style',
  capabilityId: CAPTION_STYLE_PRIMITIVE_ID,
  captionSetId: selection.captionSet.captionSetId,
  styleId,
}, 'That caption style is not available.')

export type TitleDraft = Readonly<{
  headline: string
  subhead: string
  placement: TitlePlacement
  styleId: TitleStyleId
  startTicks: number
  endTicks: number
}>

export const buildTitleOperation = (
  selection: InspectorTitleSelection,
  draft: TitleDraft,
  operationId: string,
): InspectorOperationBuildResult => {
  const rangeError = validateRange(draft.startTicks, draft.endTicks)
  if (rangeError) return Object.freeze({ ok: false, message: rangeError })
  return finish({
    ...selection.operation,
    ...common(operationId),
    kind: 'set-title',
    capabilityId: TITLE_PRIMITIVE_ID,
    sourceInterval: {
      start: time(draft.startTicks),
      duration: time(draft.endTicks - draft.startTicks),
    },
    headline: draft.headline.trim(),
    subhead: draft.subhead.trim(),
    placement: draft.placement,
    styleId: draft.styleId,
  }, 'Check the title words, style, and timing. Nothing was changed.')
}

export type CalloutDraft = Readonly<{
  label: string
  styleId: InspectorCalloutSelection['operation']['styleId']
  region: NormalizedRect
  startTicks: number
  endTicks: number
}>

export const buildCalloutOperation = (
  selection: InspectorCalloutSelection,
  draft: CalloutDraft,
  operationId: string,
): InspectorOperationBuildResult => {
  const rangeError = validateRange(draft.startTicks, draft.endTicks)
  if (rangeError) return Object.freeze({ ok: false, message: rangeError })
  return finish({
    ...selection.operation,
    ...common(operationId),
    kind: 'set-callout',
    capabilityId: CALLOUT_PRIMITIVE_ID,
    sourceInterval: {
      start: time(draft.startTicks),
      duration: time(draft.endTicks - draft.startTicks),
    },
    label: draft.label.trim(),
    styleId: draft.styleId,
    region: draft.region,
  }, 'Check the callout label, box, and timing. Nothing was changed.')
}

export type MediaOverlayDraft = Readonly<{
  overlayAssetId: string
  region: NormalizedRect
  opacity: number
  useOverlayAudio: boolean
  startTicks: number
  endTicks: number
  overlaySourceStartTicks: number
}>

export const buildMediaOverlayOperation = (
  selection: InspectorMediaOverlaySelection,
  draft: MediaOverlayDraft,
  operationId: string,
): InspectorOperationBuildResult => {
  const rangeError = validateRange(draft.startTicks, draft.endTicks)
  if (rangeError) return Object.freeze({ ok: false, message: rangeError })
  if (!isWholeTick(draft.overlaySourceStartTicks)) {
    return Object.freeze({ ok: false, message: 'The overlay source start must use whole project ticks.' })
  }
  return finish({
    ...selection.operation,
    ...common(operationId),
    kind: 'set-media-overlay',
    capabilityId: MEDIA_OVERLAY_PRIMITIVE_ID,
    overlayAssetId: draft.overlayAssetId,
    sourceInterval: {
      start: time(draft.startTicks),
      duration: time(draft.endTicks - draft.startTicks),
    },
    overlaySourceStart: time(draft.overlaySourceStartTicks),
    region: draft.region,
    opacity: draft.opacity,
    useOverlayAudio: draft.useOverlayAudio,
  }, 'Check the overlay media, box, opacity, audio, and timing. Nothing was changed.')
}

export type MusicDraft = Readonly<{
  compositionStartTicks: number
  sourceStartTicks: number
  gainDb: number
  fadeInTicks: number
  fadeOutTicks: number
}>

export const buildMusicOperation = (
  selection: InspectorMusicSelection,
  draft: MusicDraft,
  operationId: string,
): InspectorOperationBuildResult => {
  if (
    !isWholeTick(draft.compositionStartTicks) ||
    !isWholeTick(draft.sourceStartTicks) ||
    !isWholeTick(draft.fadeInTicks) ||
    !isWholeTick(draft.fadeOutTicks)
  ) {
    return Object.freeze({ ok: false, message: 'Music timing must use zero or positive whole ticks.' })
  }
  return finish({
    ...selection.operation,
    ...common(operationId),
    kind: 'set-music',
    capabilityId: MUSIC_PRIMITIVE_ID,
    compositionStart: time(draft.compositionStartTicks),
    sourceStart: time(draft.sourceStartTicks),
    gainDb: draft.gainDb,
    fadeIn: time(draft.fadeInTicks),
    fadeOut: time(draft.fadeOutTicks),
  }, 'Check the music start, level, and fades. Nothing was changed.')
}

export const buildVisualPropertiesOperation = (
  selection: InspectorVisualSelection,
  properties: VisualProperties,
  operationId: string,
): InspectorOperationBuildResult => finish({
  ...common(operationId),
  kind: 'set-visual-properties',
  capabilityId: VISUAL_PROPERTIES_PRIMITIVE_ID,
  visualId: selection.visualId,
  transform: properties.transform,
  crop: properties.crop,
  layer: properties.layer,
  mask: properties.mask,
  tracks: properties.tracks,
  transition: properties.transition,
  effects: properties.effects,
}, 'Check the visual values. One or more are outside the supported range.')
