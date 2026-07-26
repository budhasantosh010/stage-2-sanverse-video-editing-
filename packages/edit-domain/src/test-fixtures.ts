import type { VideoAsset } from './assets.ts'
import { NAMEPLATE_COMPONENT_ID } from './capabilities.ts'
import type { ChangeSet } from './change-set.ts'
import type { AddNameplateOperation } from './operations.ts'
import { createProject, type EditProject } from './project.ts'
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

export const testOperation = (
  overrides: Partial<AddNameplateOperation> = {},
): AddNameplateOperation => ({
  schemaVersion: 'sanverse.operation/v2',
  operationId: 'operation_aaaaaaaa',
  kind: 'add-nameplate',
  capabilityId: NAMEPLATE_COMPONENT_ID,
  clipId: TEST_CLIP_ID,
  sampledClipTime: ms(2_000),
  compositionInterval: { start: ms(2_000), duration: ms(5_000) },
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

export { PROJECT_TIMESCALE }
