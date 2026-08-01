import { ASSET_SCHEMA_VERSION, type AudioAsset, type ImageAsset, type VideoAsset } from './assets.ts'
import { NAMEPLATE_COMPONENT_ID } from './capabilities.ts'
import type { ChangeSet } from './change-set.ts'
import { OPERATION_SCHEMA_VERSION, type AddNameplateOperation, type EditOperation } from './operations.ts'
import { DEFAULT_CAPTION_STYLE_ID, type AddCaptionsOperation } from './caption-operations.ts'
import { addAsset, createProject, type EditProject } from './project.ts'
import type { TimelineOperation } from './timeline-operations.ts'
import {
  DEFAULT_CALLOUT_STYLE_ID,
  DEFAULT_MUSIC_GAIN_DB,
  DEFAULT_TITLE_STYLE_ID,
  type AddCalloutOperation,
  type AddMediaOverlayOperation,
  type AddMusicOperation,
  type AddTitleOperation,
} from './overlay-operations.ts'
import {
  CALLOUT_COMPONENT_ID,
  CAPTIONS_COMPONENT_ID,
  MEDIA_OVERLAY_COMPONENT_ID,
  MUSIC_COMPONENT_ID,
  TITLE_COMPONENT_ID,
  CLIP_AUDIO_PRIMITIVE_ID,
  CLIP_TRANSITION_PRIMITIVE_ID,
  CLIP_ENABLED_PRIMITIVE_ID,
  FOOTAGE_MOTION_PRIMITIVE_ID,
  REMOVE_PRIMITIVE_ID,
  REORDER_PRIMITIVE_ID,
  SPLIT_PRIMITIVE_ID,
  TRIM_PRIMITIVE_ID,
} from './capabilities.ts'
import { PROJECT_TIMESCALE, mediaTimeFromMilliseconds } from './time.ts'
import type { SetFootageMotionOperation } from './footage-motion.ts'

export const TEST_PROJECT_ID = 'project_aaaaaaaaaaaaaaaa'
export const TEST_COMPOSITION_ID = 'composition_aaaaaaaa'
export const TEST_TRACK_ID = 'track_aaaaaaaa'
export const TEST_CLIP_ID = 'clip_aaaaaaaa'

export const ms = (milliseconds: number) => {
  const time = mediaTimeFromMilliseconds(milliseconds)
  if (!time.ok) throw new Error(`invalid fixture time: ${milliseconds}`)
  return time.value
}

/** A 30-second, 1920x1080, 30 fps asset with audio. */
export const testAsset = (overrides: Partial<VideoAsset> = {}): VideoAsset => ({
  schemaVersion: ASSET_SCHEMA_VERSION,
  mediaKind: 'video',
  assetId: 'asset_aaaaaaaa',
  storageRef: 'project/project_aaaaaaaaaaaaaaaa/source',
  sha256: 'a'.repeat(64),
  byteLength: 1_000_000,
  duration: ms(30_000),
  width: 1920,
  height: 1080,
  frameRate: { numerator: 30, denominator: 1 },
  hasAudio: true,
  durationResidualSeconds: 0,
  ...overrides,
})

export const testProject = (asset: VideoAsset = testAsset()): EditProject => {
  const project = createProject({
    projectId: TEST_PROJECT_ID,
    asset,
    compositionId: TEST_COMPOSITION_ID,
    trackId: TEST_TRACK_ID,
    clipId: TEST_CLIP_ID,
  })
  if (!project.ok) throw new Error(`invalid fixture project: ${JSON.stringify(project.error)}`)
  return project.value
}

export const TEST_ASSET_ID = 'asset_aaaaaaaa'
export const TEST_BROLL_ASSET_ID = 'asset_bbbbbbbb'
export const TEST_IMAGE_ASSET_ID = 'asset_cccccccc'
export const TEST_MUSIC_ASSET_ID = 'asset_dddddddd'

/** A 10-second, 1280x720 B-roll clip with no sound. */
export const testBrollAsset = (overrides: Partial<VideoAsset> = {}): VideoAsset =>
  testAsset({
    assetId: TEST_BROLL_ASSET_ID,
    storageRef: 'project/project_aaaaaaaaaaaaaaaa/broll',
    sha256: 'b'.repeat(64),
    duration: ms(10_000),
    width: 1280,
    height: 720,
    hasAudio: false,
    ...overrides,
  })

/** A 1200x800 still picture. A picture has no length of its own. */
export const testImageAsset = (overrides: Partial<ImageAsset> = {}): ImageAsset => ({
  schemaVersion: ASSET_SCHEMA_VERSION,
  mediaKind: 'image',
  assetId: TEST_IMAGE_ASSET_ID,
  storageRef: 'project/project_aaaaaaaaaaaaaaaa/picture',
  sha256: 'c'.repeat(64),
  byteLength: 250_000,
  duration: null,
  width: 1200,
  height: 800,
  frameRate: null,
  hasAudio: false,
  durationResidualSeconds: 0,
  ...overrides,
})

/** A 120-second piece of music. Music has no picture. */
export const testMusicAsset = (overrides: Partial<AudioAsset> = {}): AudioAsset => ({
  schemaVersion: ASSET_SCHEMA_VERSION,
  mediaKind: 'audio',
  assetId: TEST_MUSIC_ASSET_ID,
  storageRef: 'project/project_aaaaaaaaaaaaaaaa/music',
  sha256: 'd'.repeat(64),
  byteLength: 3_000_000,
  duration: ms(120_000),
  width: null,
  height: null,
  frameRate: null,
  hasAudio: true,
  durationResidualSeconds: 0,
  ...overrides,
})

export const testOperation = (
  overrides: Partial<AddNameplateOperation> = {},
): AddNameplateOperation => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: 'operation_aaaaaaaa',
  kind: 'add-nameplate',
  capabilityId: NAMEPLATE_COMPONENT_ID,
  assetId: TEST_ASSET_ID,
  sourceInterval: { start: ms(2_000), duration: ms(5_000) },
  target: {
    coordinateSpace: 'composition-normalized',
    point: { x: 0.25, y: 0.75 },
    anchor: 'center',
  },
  primaryText: 'Ada Lovelace',
  secondaryText: 'Mathematician',
  extensions: {},
  ...overrides,
})

export const testFootageMotion = (
  overrides: Partial<SetFootageMotionOperation> = {},
): SetFootageMotionOperation => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: 'operation_motion001',
  kind: 'set-footage-motion',
  capabilityId: FOOTAGE_MOTION_PRIMITIVE_ID,
  motionId: 'motion_aaaaaaaa',
  assetId: TEST_ASSET_ID,
  sourceInterval: { start: ms(5_000), duration: ms(4_000) },
  transform: {
    translateX: 0,
    translateY: 0,
    scale: 1.2,
    rotationDegrees: 0,
    opacity: 1,
  },
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  tracks: [],
  extensions: {},
  ...overrides,
})

export const testChangeSet = (
  overrides: Partial<ChangeSet> = {},
  operationOverrides: Partial<AddNameplateOperation> = {},
): ChangeSet => ({
  schemaVersion: 'sanverse.change-set/v1',
  changeSetId: 'changeset_aaaaaaaa',
  baseRevision: 0,
  operations: [testOperation(operationOverrides)],
  provenance: { source: 'direct', requestId: null },
  extensions: {},
  ...overrides,
})

const timelineDefaults = (operationId: string, capabilityId: string) => ({
  schemaVersion: OPERATION_SCHEMA_VERSION as typeof OPERATION_SCHEMA_VERSION,
  operationId,
  capabilityId,
  clipId: TEST_CLIP_ID,
  extensions: {},
})

export const testSplit = (
  overrides: Partial<Extract<TimelineOperation, { kind: 'split-clip' }>> = {},
): TimelineOperation => ({
  ...timelineDefaults('operation_split001', SPLIT_PRIMITIVE_ID),
  kind: 'split-clip',
  atClipTime: ms(10_000),
  newClipId: 'clip_bbbbbbbb',
  ...overrides,
})

export const testTrim = (
  overrides: Partial<Extract<TimelineOperation, { kind: 'trim-clip' }>> = {},
): TimelineOperation => ({
  ...timelineDefaults('operation_trim0001', TRIM_PRIMITIVE_ID),
  kind: 'trim-clip',
  trimStart: ms(1_000),
  trimEnd: ms(0),
  ripple: true,
  ...overrides,
})

export const testRemove = (
  overrides: Partial<Extract<TimelineOperation, { kind: 'remove-clip' }>> = {},
): TimelineOperation => ({
  ...timelineDefaults('operation_remove01', REMOVE_PRIMITIVE_ID),
  kind: 'remove-clip',
  ripple: true,
  ...overrides,
})

export const testReorder = (
  overrides: Partial<Extract<TimelineOperation, { kind: 'reorder-clip' }>> = {},
): TimelineOperation => ({
  ...timelineDefaults('operation_reorder1', REORDER_PRIMITIVE_ID),
  kind: 'reorder-clip',
  toIndex: 0,
  ...overrides,
})

export const testSetEnabled = (
  overrides: Partial<Extract<TimelineOperation, { kind: 'set-clip-enabled' }>> = {},
): TimelineOperation => ({
  ...timelineDefaults('operation_enabled1', CLIP_ENABLED_PRIMITIVE_ID),
  kind: 'set-clip-enabled',
  enabled: false,
  ...overrides,
})

export const testSetAudio = (
  overrides: Partial<Extract<TimelineOperation, { kind: 'set-clip-audio' }>> = {},
): TimelineOperation => ({
  ...timelineDefaults('operation_audio001', CLIP_AUDIO_PRIMITIVE_ID),
  kind: 'set-clip-audio',
  gainDb: -6,
  fadeIn: ms(500),
  fadeOut: ms(500),
  ...overrides,
})

export const testTransition = (
  overrides: Partial<Extract<TimelineOperation, { kind: 'set-clip-transition' }>> = {},
): TimelineOperation => ({
  ...timelineDefaults('operation_trans001', CLIP_TRANSITION_PRIMITIVE_ID),
  kind: 'set-clip-transition',
  nextClipId: 'clip_bbbbbbbb',
  style: 'dip-to-black',
  duration: ms(500),
  audio: 'fade-through-silence',
  ...overrides,
})

export const TEST_CAPTION_SET_ID = 'captions_aaaaaaaa'

/** Captions covering source seconds 1-2, 3-4, and 5-6 by default. */
export const testCaptions = (
  overrides: Partial<AddCaptionsOperation> = {},
): AddCaptionsOperation => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: 'operation_caption1',
  kind: 'add-captions',
  capabilityId: CAPTIONS_COMPONENT_ID,
  captionSetId: TEST_CAPTION_SET_ID,
  assetId: TEST_ASSET_ID,
  styleId: DEFAULT_CAPTION_STYLE_ID,
  cues: [
    { cueId: 'cue_0001', sourceInterval: { start: ms(1_000), duration: ms(1_000) }, lines: ['first line'] },
    { cueId: 'cue_0002', sourceInterval: { start: ms(3_000), duration: ms(1_000) }, lines: ['second line'] },
    { cueId: 'cue_0003', sourceInterval: { start: ms(5_000), duration: ms(1_000) }, lines: ['third line'] },
  ],
  ...overrides,
})

export const testTitle = (overrides: Partial<AddTitleOperation> = {}): AddTitleOperation => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: 'operation_title001',
  kind: 'add-title',
  capabilityId: TITLE_COMPONENT_ID,
  titleId: 'title_0001',
  assetId: TEST_ASSET_ID,
  sourceInterval: { start: ms(0), duration: ms(3_000) },
  headline: 'How we edit',
  subhead: 'in under a minute',
  placement: 'center',
  styleId: DEFAULT_TITLE_STYLE_ID,
  extensions: {},
  ...overrides,
})

export const testCallout = (overrides: Partial<AddCalloutOperation> = {}): AddCalloutOperation => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: 'operation_call0001',
  kind: 'add-callout',
  capabilityId: CALLOUT_COMPONENT_ID,
  calloutId: 'callout_0001',
  assetId: TEST_ASSET_ID,
  sourceInterval: { start: ms(4_000), duration: ms(3_000) },
  region: { coordinateSpace: 'composition-normalized', x: 0.55, y: 0.2, width: 0.3, height: 0.25 },
  label: 'the export button',
  styleId: DEFAULT_CALLOUT_STYLE_ID,
  extensions: {},
  ...overrides,
})

export const testMediaOverlay = (
  overrides: Partial<AddMediaOverlayOperation> = {},
): AddMediaOverlayOperation => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: 'operation_broll001',
  kind: 'add-media-overlay',
  capabilityId: MEDIA_OVERLAY_COMPONENT_ID,
  overlayId: 'broll_0001',
  overlayAssetId: TEST_BROLL_ASSET_ID,
  assetId: TEST_ASSET_ID,
  sourceInterval: { start: ms(8_000), duration: ms(4_000) },
  overlaySourceStart: ms(1_000),
  region: { coordinateSpace: 'composition-normalized', x: 0.05, y: 0.05, width: 0.4, height: 0.4 },
  opacity: 1,
  useOverlayAudio: false,
  extensions: {},
  ...overrides,
})

export const testMusic = (overrides: Partial<AddMusicOperation> = {}): AddMusicOperation => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: 'operation_music001',
  kind: 'add-music',
  capabilityId: MUSIC_COMPONENT_ID,
  musicId: 'music_0001',
  assetId: TEST_MUSIC_ASSET_ID,
  compositionStart: ms(0),
  sourceStart: ms(0),
  gainDb: DEFAULT_MUSIC_GAIN_DB,
  fadeIn: ms(1_000),
  fadeOut: ms(2_000),
  extensions: {},
  ...overrides,
})

/** A project holding footage plus B-roll, a picture, and music. */
export const testMultiAssetProject = (): EditProject => {
  let project = testProject()
  for (const asset of [testBrollAsset(), testImageAsset(), testMusicAsset()]) {
    const next = addAsset(project, asset)
    if (!next.ok) throw new Error(`invalid fixture asset: ${JSON.stringify(next.error)}`)
    project = next.value
  }
  return project
}

/** A change set holding whatever operations a test needs. */
export const changeSetOf = (
  changeSetId: string,
  baseRevision: number,
  operations: readonly EditOperation[],
): ChangeSet => ({
  schemaVersion: 'sanverse.change-set/v1',
  changeSetId,
  baseRevision,
  operations,
  provenance: { source: 'direct', requestId: null },
  extensions: {},
})

export { PROJECT_TIMESCALE }
