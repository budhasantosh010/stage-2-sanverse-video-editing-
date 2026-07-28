import type { VideoAsset } from './assets.ts'
import { NAMEPLATE_COMPONENT_ID } from './capabilities.ts'
import type { ChangeSet } from './change-set.ts'
import { OPERATION_SCHEMA_VERSION, type AddNameplateOperation, type EditOperation } from './operations.ts'
import { DEFAULT_CAPTION_STYLE_ID, type AddCaptionsOperation } from './caption-operations.ts'
import { createProject, type EditProject } from './project.ts'
import type { TimelineOperation } from './timeline-operations.ts'
import {
  CAPTIONS_COMPONENT_ID,
  CLIP_AUDIO_PRIMITIVE_ID,
  CLIP_ENABLED_PRIMITIVE_ID,
  REMOVE_PRIMITIVE_ID,
  REORDER_PRIMITIVE_ID,
  SPLIT_PRIMITIVE_ID,
  TRIM_PRIMITIVE_ID,
} from './capabilities.ts'
import { PROJECT_TIMESCALE, mediaTimeFromMilliseconds } from './time.ts'

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
  schemaVersion: 'sanverse.asset/video/v1',
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
