import {
  DEFAULT_MUSIC_GAIN_DB,
  MEDIA_OVERLAY_COMPONENT_ID,
  MUSIC_COMPONENT_ID,
  MUSIC_PRIMITIVE_ID,
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  activeOverlayOperations,
  clipAtCompositionTime,
  clipTimeToSource,
  compositionDuration,
  compositionTimeToClip,
  effectiveComposition,
  validateOperation,
  validateOperationAgainstComposition,
  type AddMediaOverlayOperation,
  type AddMusicOperation,
  type EditProject,
  type MediaAsset,
  type SetMusicOperation,
} from '@sanverse/edit-domain'
import type { MediaActionBuildResult, MediaActionIds } from './media-contract'

const time = (ticks: number) => Object.freeze({ ticks, timescale: PROJECT_TIMESCALE })

const randomId = (prefix: string): string => {
  const bytes = new Uint8Array(8)
  globalThis.crypto.getRandomValues(bytes)
  return `${prefix}${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export const createMediaActionIds = (): MediaActionIds => Object.freeze({
  operationId: randomId('operation_'),
  overlayId: randomId('broll_'),
  musicId: randomId('music_'),
})

export const sourceMomentAt = (
  project: EditProject,
  playheadMs: number,
): Readonly<{ assetId: string; startTicks: number; remainingTicks: number }> | null => {
  const composition = effectiveComposition(project)
  const ticks = Math.round(playheadMs * PROJECT_TIMESCALE / 1000)
  const clip = clipAtCompositionTime(composition, time(ticks))
  if (!clip) return null
  const clipTime = compositionTimeToClip(clip, time(ticks))
  const sourceTime = clipTimeToSource(clip, clipTime)
  return Object.freeze({
    assetId: clip.assetId,
    startTicks: sourceTime.ticks,
    remainingTicks: clip.sourceRange.start.ticks + clip.sourceRange.duration.ticks - sourceTime.ticks,
  })
}

const finish = (project: EditProject, operation: AddMediaOverlayOperation | AddMusicOperation | SetMusicOperation, timelineItemId: string): MediaActionBuildResult => {
  const validated = validateOperation(operation)
  if (!validated.ok) return Object.freeze({ ok: false, message: 'That media placement is not valid. Nothing was changed.' })
  const fits = validateOperationAgainstComposition(validated.value, effectiveComposition(project), project.assets)
  if (!fits.ok) return Object.freeze({ ok: false, message: 'That media does not fit at this moment. Nothing was changed.' })
  return Object.freeze({ ok: true, operation: validated.value, timelineItemId })
}

export const buildAddAsBrollOperation = (input: Readonly<{
  project: EditProject
  expectedRevision: number
  asset: MediaAsset
  playheadMs: number
  durationSeconds?: number
  ids: Pick<MediaActionIds, 'operationId' | 'overlayId'>
}>): MediaActionBuildResult => {
  if (input.project.revision !== input.expectedRevision) return Object.freeze({ ok: false, message: 'The project changed before this media could be added. Try again.' })
  if (!input.project.assets.some((asset) => asset.assetId === input.asset.assetId)) return Object.freeze({ ok: false, message: 'That media is no longer in this project.' })
  if (input.asset.mediaKind === 'audio') return Object.freeze({ ok: false, message: 'Choose a video or image for B-roll.' })
  const anchor = sourceMomentAt(input.project, input.playheadMs)
  if (!anchor) return Object.freeze({ ok: false, message: 'Move the playhead onto a part of the video that still has footage.' })
  if (anchor.assetId === input.asset.assetId) return Object.freeze({ ok: false, message: 'The primary video is already on V1. Choose another video or an image.' })
  const wanted = Math.max(1, Math.min(30, input.durationSeconds ?? 3)) * PROJECT_TIMESCALE
  const available = input.asset.mediaKind === 'video' ? input.asset.duration.ticks : wanted
  const duration = Math.min(wanted, anchor.remainingTicks, available)
  if (duration < PROJECT_TIMESCALE) return Object.freeze({ ok: false, message: 'There is less than one second available here. Choose an earlier moment or longer media.' })
  const operation: AddMediaOverlayOperation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operationId,
    kind: 'add-media-overlay',
    capabilityId: MEDIA_OVERLAY_COMPONENT_ID,
    overlayId: input.ids.overlayId,
    overlayAssetId: input.asset.assetId,
    assetId: anchor.assetId,
    sourceInterval: Object.freeze({ start: time(anchor.startTicks), duration: time(duration) }),
    overlaySourceStart: time(0),
    region: Object.freeze({ coordinateSpace: 'composition-normalized', x: 0.04, y: 0.06, width: 0.42, height: 0.42 }),
    opacity: 1,
    useOverlayAudio: false,
    extensions: Object.freeze({}),
  })
  return finish(input.project, operation, `overlay:${operation.overlayId}:0`)
}

export const buildAddAsMusicOperation = (input: Readonly<{
  project: EditProject
  expectedRevision: number
  asset: MediaAsset
  playheadMs: number
  ids: Pick<MediaActionIds, 'operationId' | 'musicId'>
}>): MediaActionBuildResult => {
  if (input.project.revision !== input.expectedRevision) return Object.freeze({ ok: false, message: 'The project changed before this music could be added. Try again.' })
  if (input.asset.mediaKind !== 'audio') return Object.freeze({ ok: false, message: 'Choose an audio file to add as music.' })
  if (!input.project.assets.some((asset) => asset.assetId === input.asset.assetId)) return Object.freeze({ ok: false, message: 'That audio is no longer in this project.' })
  const durationTicks = compositionDuration(effectiveComposition(input.project)).ticks
  const startTicks = Math.max(0, Math.min(durationTicks - 1, Math.round(input.playheadMs * PROJECT_TIMESCALE / 1000)))

  // A2 holds music AND anything else added underneath, so a second piece is a
  // second item, not a replacement for the first. Silently overwriting the bed
  // somebody chose ten minutes ago is a loss they cannot see happening.
  //
  // What it must not do is stack two pieces on top of each other, because the
  // user would hear both at once and see one rectangle hiding another.
  const songLeft = input.asset.duration.ticks
  const wanted = Math.min(durationTicks - startTicks, songLeft)
  const clash = activeOverlayOperations(input.project).some((operation) => {
    if (operation.kind !== 'add-music') return false
    const asset = input.project.assets.find((candidate) => candidate.assetId === operation.assetId)
    if (!asset || asset.mediaKind !== 'audio') return false
    const asked = operation.durationTicks === null ? Number.MAX_SAFE_INTEGER : operation.durationTicks.ticks
    const length = Math.min(
      durationTicks - operation.compositionStart.ticks,
      asset.duration.ticks - operation.sourceStart.ticks,
      asked,
    )
    if (length <= 0) return false
    return startTicks < operation.compositionStart.ticks + length && operation.compositionStart.ticks < startTicks + wanted
  })
  if (clash) {
    return Object.freeze({
      ok: false,
      message: 'There is already music playing at that moment. Move the playhead past it, or move the music that is there.',
    })
  }

  const operation: AddMusicOperation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operationId,
    kind: 'add-music',
    capabilityId: MUSIC_COMPONENT_ID,
    musicId: input.ids.musicId,
    assetId: input.asset.assetId,
    compositionStart: time(startTicks),
    sourceStart: time(0),
    // A bed under whatever is left of the video, which is what adding music
    // means to somebody who has not asked for a length.
    durationTicks: null,
    gainDb: DEFAULT_MUSIC_GAIN_DB,
    fadeIn: time(PROJECT_TIMESCALE),
    fadeOut: time(2 * PROJECT_TIMESCALE),
    extensions: Object.freeze({}),
  })
  return finish(input.project, operation, `music:${operation.musicId}:0`)
}
