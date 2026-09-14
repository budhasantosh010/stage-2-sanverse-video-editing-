import { effectiveComposition, activeTimelineTrackState, OPERATION_SCHEMA_VERSION, type EditProject, type IdFactory } from '@sanverse/edit-domain'
import { EXTRACT_AUDIO_PRIMITIVE_ID } from '@sanverse/edit-domain/capabilities'
import { planAddTimelineTrack, type TrackControlPlan } from './timeline-track-controls'

export function planExtractAudio(input: Readonly<{
  project: EditProject; clipId: string; lockedTrackIds: readonly string[]
  pendingProposalExists: boolean; exportInProgress: boolean; ids: IdFactory
}>): TrackControlPlan {
  const refuse = (message: string): TrackControlPlan => ({ ok: false, refusal: { code: 'ITEM_UNKNOWN', message } })
  if (input.pendingProposalExists) return refuse('Finish the pending proposal first.')
  if (input.exportInProgress) return refuse('Wait for export to finish.')
  const track = effectiveComposition(input.project).tracks.find(track => track.clips.some(clip => clip.clipId === input.clipId))
  const clip = track?.clips.find(clip => clip.clipId === input.clipId)
  const asset = input.project.assets.find(asset => asset.assetId === clip?.assetId)
  if (track?.kind !== 'video' || !clip || clip.audioDetached || clip.segmentKind === 'freeze' || !asset || asset.mediaKind !== 'video' || !asset.hasAudio) {
    return refuse('Choose footage that still has linked sound.')
  }
  const dialogue = activeTimelineTrackState(input.project).tracks.find(track => track.role === 'dialogue')
  if (input.lockedTrackIds.includes(track.trackId) || (dialogue && input.lockedTrackIds.includes(dialogue.trackId))) {
    return refuse('Unlock the picture and linked dialogue tracks first.')
  }
  const added = planAddTimelineTrack({ project: input.project, kind: 'audio', name: 'Extracted audio', ids: input.ids })
  if (!added.ok) return added
  return { ok: true, summary: 'Extract audio independently', operations: [...added.operations, {
    schemaVersion: OPERATION_SCHEMA_VERSION, operationId: input.ids.operation(1),
    capabilityId: EXTRACT_AUDIO_PRIMITIVE_ID, kind: 'extract-clip-audio',
    clipId: clip.clipId, newClipId: input.ids.entity('clip', 0),
    trackId: input.ids.entity('track', 0), extensions: {},
  }] }
}
