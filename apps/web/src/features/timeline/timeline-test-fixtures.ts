import {
  CALLOUT_PRIMITIVE_ID,
  CAPTIONS_PRIMITIVE_ID,
  DEFAULT_CALLOUT_STYLE_ID,
  DEFAULT_CAPTION_STYLE_ID,
  DEFAULT_TITLE_STYLE_ID,
  MEDIA_OVERLAY_PRIMITIVE_ID,
  MUSIC_PRIMITIVE_ID,
  NAMEPLATE_COMPONENT_ID,
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  TITLE_PRIMITIVE_ID,
  acceptChangeSet,
  addAsset,
  effectiveComposition,
  type AddCalloutOperation,
  type AddCaptionsOperation,
  type AddMediaOverlayOperation,
  type AddMusicOperation,
  type AddNameplateOperation,
  type AddTitleOperation,
  type AudioAsset,
  type CaptionCue,
  type EditOperation,
  type EditProject,
  type ImageAsset,
  type VideoAsset,
} from '@sanverse/edit-domain'

import { testAsset, testProject } from '../../test-fixtures'
import {
  buildMoveAtPlayhead,
  buildRemoveAtPlayhead,
  buildSetAudioAtPlayhead,
  buildSetEnabledAtPlayhead,
  buildSplitAtPlayhead,
} from './timeline-edits'

export const S = PROJECT_TIMESCALE
export const ticks = (seconds: number) => Math.round(seconds * S)
export const time = (seconds: number) => Object.freeze({ ticks: ticks(seconds), timescale: PROJECT_TIMESCALE })
export const range = (startSeconds: number, durationSeconds: number) => Object.freeze({
  start: time(startSeconds),
  duration: time(durationSeconds),
})

export type TestIdSequence = Readonly<{
  operation(): string
  clip(): string
}>

export const createIds = (start = 0): TestIdSequence => {
  let value = start
  const next = () => String(value += 1).padStart(8, '0')
  return Object.freeze({
    operation: () => `operation_${next()}`,
    clip: () => `clip_${next()}`,
  })
}

export const acceptOperation = (project: EditProject, operation: EditOperation): EditProject => {
  const changeSetId = `changeset_${operation.operationId.replace(/^operation_/, '')}`
  const accepted = acceptChangeSet(project, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId,
    baseRevision: project.revision,
    operations: [operation],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!accepted.ok) throw new Error(`fixture accept failed: ${JSON.stringify(accepted.error)}`)
  return accepted.value
}

export const addFixtureAsset = (project: EditProject, asset: ImageAsset | AudioAsset | VideoAsset): EditProject => {
  const added = addAsset(project, asset)
  if (!added.ok) throw new Error(`fixture asset failed: ${JSON.stringify(added.error)}`)
  return added.value
}

export const imageAsset = (): ImageAsset => Object.freeze({
  schemaVersion: 'sanverse.asset/media/v1',
  mediaKind: 'image',
  assetId: 'asset_image0001',
  storageRef: 'project:test/image',
  sha256: 'b'.repeat(64),
  byteLength: 2_000,
  duration: null,
  width: 1280,
  height: 720,
  frameRate: null,
  hasAudio: false,
  durationResidualSeconds: 0,
})

export const brollAsset = (): VideoAsset => Object.freeze({
  ...testAsset({
    assetId: 'asset_broll0001',
    storageRef: 'project:test/broll',
    sha256: 'c'.repeat(64),
    byteLength: 2_000_000,
    duration: time(30),
    width: 1280,
    height: 720,
  }),
})

export const musicAsset = (durationSeconds = 30): AudioAsset => Object.freeze({
  schemaVersion: 'sanverse.asset/media/v1',
  mediaKind: 'audio',
  assetId: 'asset_music0001',
  storageRef: 'project:test/music',
  sha256: 'd'.repeat(64),
  byteLength: 500_000,
  duration: time(durationSeconds),
  width: null,
  height: null,
  frameRate: null,
  hasAudio: true,
  durationResidualSeconds: 0,
})

export const nameplate = (
  operationId: string,
  startSeconds = 1,
  durationSeconds = 5,
  text = 'Santosh',
): AddNameplateOperation => Object.freeze({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId,
  kind: 'add-nameplate',
  capabilityId: NAMEPLATE_COMPONENT_ID,
  assetId: 'asset_aaaaaaaa',
  sourceInterval: range(startSeconds, durationSeconds),
  target: {
    coordinateSpace: 'composition-normalized' as const,
    point: { x: 0.5, y: 0.5 },
    anchor: 'center' as const,
  },
  primaryText: text,
  secondaryText: 'Founder',
  extensions: {},
})

export const captions = (
  operationId: string,
  cues: readonly CaptionCue[] = [
    Object.freeze({ cueId: 'cue_0001', sourceInterval: range(1, 1), lines: Object.freeze(['Hello world']) }),
  ],
): AddCaptionsOperation => Object.freeze({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId,
  kind: 'add-captions',
  capabilityId: CAPTIONS_PRIMITIVE_ID,
  captionSetId: `captions_${operationId.slice(-8)}`,
  assetId: 'asset_aaaaaaaa',
  styleId: DEFAULT_CAPTION_STYLE_ID,
  cues: Object.freeze([...cues]),
})

export const title = (operationId: string): AddTitleOperation => Object.freeze({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId,
  kind: 'add-title',
  capabilityId: TITLE_PRIMITIVE_ID,
  titleId: `title_${operationId.slice(-8)}`,
  assetId: 'asset_aaaaaaaa',
  sourceInterval: range(3, 2),
  headline: 'Main point',
  subhead: 'Why it matters',
  placement: 'center',
  styleId: DEFAULT_TITLE_STYLE_ID,
  extensions: {},
})

export const callout = (operationId: string): AddCalloutOperation => Object.freeze({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId,
  kind: 'add-callout',
  capabilityId: CALLOUT_PRIMITIVE_ID,
  calloutId: `callout_${operationId.slice(-8)}`,
  assetId: 'asset_aaaaaaaa',
  sourceInterval: range(6, 2),
  region: { coordinateSpace: 'composition-normalized' as const, x: 0.55, y: 0.25, width: 0.3, height: 0.3 },
  label: 'Look here',
  styleId: DEFAULT_CALLOUT_STYLE_ID,
  extensions: {},
})

export const mediaOverlay = (
  operationId: string,
  overlayAssetId = 'asset_image0001',
  startSeconds = 9,
): AddMediaOverlayOperation => Object.freeze({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId,
  kind: 'add-media-overlay',
  capabilityId: MEDIA_OVERLAY_PRIMITIVE_ID,
  overlayId: `broll_${operationId.slice(-8)}`,
  overlayAssetId,
  assetId: 'asset_aaaaaaaa',
  sourceInterval: range(startSeconds, 2),
  overlaySourceStart: time(0),
  region: { coordinateSpace: 'composition-normalized' as const, x: 0.55, y: 0.1, width: 0.35, height: 0.35 },
  opacity: 1,
  useOverlayAudio: false,
  extensions: {},
})

export const music = (operationId: string, startSeconds = 0): AddMusicOperation => Object.freeze({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId,
  kind: 'add-music',
  capabilityId: MUSIC_PRIMITIVE_ID,
  musicId: `music_${operationId.slice(-8)}`,
  assetId: 'asset_music0001',
  compositionStart: time(startSeconds),
  sourceStart: time(0),
  gainDb: -18,
  fadeIn: time(1),
  fadeOut: time(1),
  extensions: {},
})

const requireBuilt = (result: ReturnType<typeof buildSplitAtPlayhead> | ReturnType<typeof buildRemoveAtPlayhead>): EditOperation => {
  if (!result.ok) throw new Error(`fixture edit failed: ${result.refusal.reason}`)
  return result.operation
}

export const splitProject = (project: EditProject, atSeconds: number, ids = createIds()): EditProject =>
  acceptOperation(
    project,
    requireBuilt(buildSplitAtPlayhead(effectiveComposition(project), ticks(atSeconds), ids.operation, ids.clip)),
  )

export const removedProject = (closeGap: boolean): EditProject => {
  const ids = createIds()
  let project = splitProject(testProject(), 10, ids)
  const remove = buildRemoveAtPlayhead(effectiveComposition(project), ticks(2), ids.operation, closeGap)
  project = acceptOperation(project, requireBuilt(remove))
  return project
}

export const disabledProject = (): EditProject => {
  const ids = createIds()
  let project = splitProject(testProject(), 10, ids)
  const hidden = buildSetEnabledAtPlayhead(effectiveComposition(project), ticks(2), false, ids.operation)
  if (!hidden.ok) throw new Error(`fixture hide failed: ${hidden.refusal.reason}`)
  return acceptOperation(project, hidden.operation)
}

export const audioAdjustedProject = (): EditProject => {
  const ids = createIds()
  const base = testProject()
  const adjusted = buildSetAudioAtPlayhead(effectiveComposition(base), ticks(5), -6, ticks(2), ticks(3), ids.operation)
  if (!adjusted.ok) throw new Error(`fixture audio failed: ${adjusted.refusal.reason}`)
  return acceptOperation(base, adjusted.operation)
}

export const reorderedProject = (): EditProject => {
  const ids = createIds()
  let project = splitProject(testProject(), 10, ids)
  project = splitProject(project, 20, ids)
  const thirdClip = effectiveComposition(project).tracks[0].clips
    .slice()
    .sort((left, right) => left.compositionStart.ticks - right.compositionStart.ticks)[2]
  const moved = buildMoveAtPlayhead(
    effectiveComposition(project),
    thirdClip.compositionStart.ticks + 1,
    'earlier',
    ids.operation,
  )
  if (!moved.ok) throw new Error(`fixture move failed: ${moved.refusal.reason}`)
  return acceptOperation(project, moved.operation)
}

export const projectWithAllTimelineFamilies = (): EditProject => {
  const ids = createIds()
  let project = testProject()
  project = addFixtureAsset(project, imageAsset())
  project = addFixtureAsset(project, brollAsset())
  project = addFixtureAsset(project, musicAsset())
  project = acceptOperation(project, captions(ids.operation()))
  project = acceptOperation(project, nameplate(ids.operation(), 1, 2))
  project = acceptOperation(project, title(ids.operation()))
  project = acceptOperation(project, callout(ids.operation()))
  project = acceptOperation(project, mediaOverlay(ids.operation(), imageAsset().assetId, 9))
  project = acceptOperation(project, mediaOverlay(ids.operation(), brollAsset().assetId, 12))
  project = acceptOperation(project, music(ids.operation()))
  return project
}

export const splitPlacementProject = (): EditProject => {
  const ids = createIds()
  let project = testProject()
  project = acceptOperation(project, nameplate(ids.operation(), 8, 4, 'Across the cut'))
  project = splitProject(project, 10, ids)
  return project
}

export const blockedPlacementProject = (): EditProject => {
  const ids = createIds()
  let project = testProject()
  project = acceptOperation(project, nameplate(ids.operation(), 1, 2, 'Removed moment'))
  project = splitProject(project, 5, ids)
  const remove = buildRemoveAtPlayhead(effectiveComposition(project), ticks(2), ids.operation, true)
  project = acceptOperation(project, requireBuilt(remove))
  return project
}

export const largeTimelineProject = (): EditProject => {
  const ids = createIds()
  let project = testProject(testAsset({ duration: time(300), byteLength: 10_000_000 }))
  project = addFixtureAsset(project, musicAsset(300))

  for (let index = 1; index < 50; index += 1) {
    project = splitProject(project, index * 6, ids)
  }

  const cues: CaptionCue[] = Array.from({ length: 100 }, (_, index) => Object.freeze({
    cueId: `cue_${String(index + 1).padStart(4, '0')}`,
    sourceInterval: range(index * 2, 1),
    lines: Object.freeze([`Caption ${index + 1}`]),
  }))
  project = acceptOperation(project, captions(ids.operation(), cues))

  for (let index = 0; index < 20; index += 1) {
    project = acceptOperation(
      project,
      nameplate(ids.operation(), index * 12, 1, `Overlay ${index + 1}`),
    )
  }
  project = acceptOperation(project, music(ids.operation()))
  return project
}
