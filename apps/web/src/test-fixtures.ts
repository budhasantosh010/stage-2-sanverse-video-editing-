import {
  NAMEPLATE_COMPONENT_ID,
  PROJECT_TIMESCALE,
  acceptChangeSet,
  createProject,
  type AddNameplateOperation,
  type EditProject,
  type VideoAsset,
} from '@sanverse/edit-domain'

export const TEST_PROJECT_ID = 'project_1234567890abcdef'
export const TEST_COMPOSITION_ID = 'composition_aaaaaaaa'
export const TEST_TRACK_ID = 'track_aaaaaaaa'
export const TEST_ASSET_ID = 'asset_aaaaaaaa'
export const TEST_CLIP_ID = 'clip_aaaaaaaa'

export const ms = (milliseconds: number) => ({
  ticks: milliseconds * (PROJECT_TIMESCALE / 1000),
  timescale: PROJECT_TIMESCALE,
}) as const

/** A 30-second, 1920x1080 asset with audio. */
export const testAsset = (overrides: Partial<VideoAsset> = {}): VideoAsset => ({
  schemaVersion: 'sanverse.asset/media/v1' as const,
      mediaKind: 'video' as const,
  assetId: 'asset_aaaaaaaa',
  storageRef: `project:${TEST_PROJECT_ID}/source`,
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

export const testProject = (
  asset: VideoAsset = testAsset(),
  projectId: string = TEST_PROJECT_ID,
): EditProject => {
  const project = createProject({
    projectId,
    asset,
    compositionId: TEST_COMPOSITION_ID,
    trackId: TEST_TRACK_ID,
    clipId: TEST_CLIP_ID,
  })
  if (!project.ok) throw new Error(`fixture failed: ${JSON.stringify(project.error)}`)
  return project.value
}

export const testOperation = (
  overrides: Partial<AddNameplateOperation> = {},
): AddNameplateOperation => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId: 'operation_aaaaaaaa',
  kind: 'add-nameplate',
  capabilityId: NAMEPLATE_COMPONENT_ID,
  assetId: TEST_ASSET_ID,
  sourceInterval: { start: ms(1_000), duration: ms(5_000) },
  target: { coordinateSpace: 'composition-normalized', point: { x: 0.25, y: 0.75 }, anchor: 'center' },
  primaryText: 'Santosh',
  secondaryText: 'Founder',
  extensions: {},
  ...overrides,
})

export const testChangeSet = (
  baseRevision: number,
  changeSetId = 'changeset_aaaaaaaa',
  operation: Partial<AddNameplateOperation> = {},
) => ({
  schemaVersion: 'sanverse.change-set/v1' as const,
  changeSetId,
  baseRevision,
  operations: [testOperation({ operationId: `operation_${changeSetId.slice(-8)}`, ...operation })],
  provenance: { source: 'direct' as const, requestId: null },
  extensions: {},
})

/** A project with one accepted nameplate, as the server would report it. */
export const testProjectWithNameplate = (
  changeSetId = 'changeset_aaaaaaaa',
  operation: Partial<AddNameplateOperation> = {},
): EditProject => {
  const base = testProject()
  const accepted = acceptChangeSet(base, testChangeSet(base.revision, changeSetId, operation))
  if (!accepted.ok) throw new Error(`fixture failed: ${JSON.stringify(accepted.error)}`)
  return accepted.value
}

export const testOpenedProject = (editProject: EditProject = testProject()) => ({
  id: TEST_PROJECT_ID,
  originalFilename: 'owner.mp4',
  createdAt: '2026-07-14T00:00:00.000Z',
  sizeBytes: 24,
  sha256: 'a'.repeat(64),
  mediaUrl: `/api/projects/${TEST_PROJECT_ID}/media`,
  project: editProject,
})
