import {
  OPERATION_SCHEMA_VERSION,
  applyTimelineOperation,
  effectiveComposition,
  findAsset,
  findClip,
  mediaTime,
  validateOperation,
  type EditProject,
} from '@sanverse/edit-domain'
import { LINKED_AUDIO_PRIMITIVE_ID } from '@sanverse/edit-domain/capabilities'
import type { SetLinkedAudioWindowOperation } from '@sanverse/edit-domain/timeline-operations'
import { isFreezeClip } from '@sanverse/edit-domain/composition'
import { sourceTicksForCompositionOffset } from '@sanverse/edit-domain/clip-time'

export type LinkedAudioPlanResult =
  | Readonly<{ ok: true; operation: SetLinkedAudioWindowOperation; summary: string }>
  | Readonly<{ ok: false; message: string }>

const refuse = (message: string): LinkedAudioPlanResult => Object.freeze({ ok: false, message })

/**
 * Plan a still-linked J/L window from composition-time extensions.
 *
 * `leadTicks` is how much A1 starts before V1; `tailTicks` is how much it ends
 * after V1. Both are composition time. The source extension is derived from the
 * clip's exact rational speed so the picture and sound keep one clip identity.
 * Custom J/L handles on reverse footage are refused because the current bounded
 * reverse Preview artifact contains the picture interval only, not extra sound
 * handles. Showing the original source forwards for those handles would be a lie.
 */
export const planLinkedAudioWindow = (input: Readonly<{
  project: EditProject
  clipId: string
  leadTicks: number
  tailTicks: number
  operationId: string
}>): LinkedAudioPlanResult => {
  const { project, clipId, operationId } = input
  const leadTicks = Math.max(0, Math.round(input.leadTicks))
  const tailTicks = Math.max(0, Math.round(input.tailTicks))
  if (!Number.isSafeInteger(leadTicks) || !Number.isSafeInteger(tailTicks)) {
    return refuse('Those audio edge values are not valid timeline times.')
  }

  const composition = effectiveComposition(project)
  const clip = findClip(composition, clipId)
  if (!clip) return refuse('That piece is no longer on the timeline.')
  if (isFreezeClip(clip)) return refuse('A held frame is intentionally silent.')
  if (clip.timeTransform.direction === 'reverse' && (leadTicks > 0 || tailTicks > 0)) {
    return refuse('J/L cuts on backwards footage need a reverse proxy with extra audio handles. Reset Reverse first, or split the section.')
  }
  const asset = findAsset(project.assets, clip.assetId)
  if (!asset || asset.mediaKind !== 'video' || !asset.hasAudio) {
    return refuse('That footage does not contain linked sound.')
  }

  const earlySourceTicks = sourceTicksForCompositionOffset(leadTicks, clip.timeTransform.playbackRate)
  const lateSourceTicks = sourceTicksForCompositionOffset(tailTicks, clip.timeTransform.playbackRate)
  const pictureStart = clip.sourceRange.start.ticks
  const pictureEnd = pictureStart + clip.sourceRange.duration.ticks

  const sourceStart = clip.timeTransform.direction === 'forward'
    ? pictureStart - earlySourceTicks
    : pictureStart - lateSourceTicks
  const sourceEnd = clip.timeTransform.direction === 'forward'
    ? pictureEnd + lateSourceTicks
    : pictureEnd + earlySourceTicks
  if (sourceStart < 0 || sourceEnd > asset.duration.ticks || sourceEnd <= sourceStart) {
    return refuse('There is not enough recorded sound beyond that picture edge for this J/L cut.')
  }

  const operation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId,
    capabilityId: LINKED_AUDIO_PRIMITIVE_ID,
    kind: 'set-linked-audio-window' as const,
    clipId,
    sourceRange: Object.freeze({
      start: mediaTime(sourceStart),
      duration: mediaTime(sourceEnd - sourceStart),
    }),
    compositionOffsetTicks: -leadTicks,
    extensions: Object.freeze({}),
  })
  const checked = validateOperation(operation)
  if (!checked.ok) return refuse('That linked-audio edit is not valid.')
  const dryRun = applyTimelineOperation(composition, checked.value as never, project.assets)
  if (!dryRun.ok) {
    return refuse(
      dryRun.error.reason === 'LINKED_AUDIO_WINDOW_INVALID'
        ? 'That sound edge would fall outside the finished video or source recording.'
        : dryRun.error.reason === 'LINKED_AUDIO_WINDOW_CUSTOM'
          ? 'Reset the current linked-audio window before changing the clip structure.'
          : 'That linked-audio edit cannot be applied here.',
    )
  }
  const label = leadTicks > 0 && tailTicks > 0
    ? 'Changed the J/L cut'
    : leadTicks > 0
      ? 'Made a J-cut'
      : tailTicks > 0
        ? 'Made an L-cut'
        : 'Reset the linked sound to the picture'
  return Object.freeze({ ok: true, operation: checked.value as SetLinkedAudioWindowOperation, summary: label })
}
