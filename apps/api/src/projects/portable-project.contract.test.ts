import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'vitest'

import {
  CREATIVE_SCENE_PRIMITIVE_ID,
  PROJECT_TIMESCALE,
  acceptChangeSetAtomic,
  mediaTime,
} from '@sanverse/edit-domain'
import { testProject } from '@sanverse/edit-domain/test-fixtures'
import { createMotionScene, nodeBase } from '@sanverse/motion-graph'
import { canonicalCreativeArtifactJsonV1, type CreativeSceneArtifactV1 } from '@sanverse/render-contract/creative-scene-artifact'
import {
  PortableProjectError,
  buildPortableProjectArchive,
  restorePortableProject,
  restorePortableProjectBundle,
  validatePortableProjectArchive,
} from './portable-project.ts'

test('portable archive verifies integrity and restores against matching media', () => {
  const project = testProject()
  const archive = buildPortableProjectArchive(project, '2026-07-29T00:00:00.000Z')
  assert.equal(validatePortableProjectArchive(archive).project.projectId, project.projectId)
  assert.deepEqual(restorePortableProject(archive, project), project)
})

test('portable archive rejects corruption, unknown fields, and missing media', () => {
  const project = testProject()
  const archive = buildPortableProjectArchive(project, '2026-07-29T00:00:00.000Z')
  const corrupted = structuredClone(archive) as Record<string, unknown>
  corrupted.exportedAt = '2026-07-29T00:00:01.000Z'
  assert.throws(() => validatePortableProjectArchive(corrupted), PortableProjectError)

  const traversal = { ...archive, path: '../source.mp4' }
  assert.throws(() => validatePortableProjectArchive(traversal), PortableProjectError)

  const missing = {
    ...structuredClone(project),
    assets: project.assets.map((asset) => ({ ...asset, sha256: 'f'.repeat(64) })),
  }
  assert.throws(
    () => restorePortableProject(archive, missing),
    (error: unknown) => error instanceof PortableProjectError && error.code === 'PORTABLE_MEDIA_MISSING',
  )
})

test('portable archive carries exact immutable Creative artifacts and rebinds their content identity on restore', () => {
  const base = testProject()
  const root = Object.freeze({ ...nodeBase('creative.root', 'Root', null), type: 'group' as const, childIds: Object.freeze([]) })
  const scene = createMotionScene({
    componentId: 'sanverse.portable-proof',
    componentVersion: 1,
    rootNodeId: root.id,
    nodes: Object.freeze({ [root.id]: root }),
    semanticParts: Object.freeze([{ id: 'root-part', label: 'Root', role: 'content-group' as const, nodeIds: Object.freeze([root.id]) }]),
    exposures: Object.freeze([]),
    layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }),
    supportedAspectRatios: Object.freeze(['16:9'] as const),
  })
  const artifact: CreativeSceneArtifactV1 = Object.freeze({
    schemaVersion: 'sanverse.creative-scene-artifact/v1',
    projectId: base.projectId,
    productionBaseRevision: base.revision,
    sceneId: 'creative_scene_portable1',
    opportunityId: 'opportunity_portable1',
    componentId: scene.componentId,
    componentVersion: scene.componentVersion,
    source: Object.freeze({ assetId: base.assets[0]!.assetId, sourceStartTick: 0, sourceEndTick: PROJECT_TIMESCALE, durationTicks: PROJECT_TIMESCALE, width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 }),
    presentation: Object.freeze({ mode: 'overlay', sourceTreatment: 'normal', backgroundTreatment: 'source-video', preserveSourceAudio: true, preserveSourceVideo: true }),
    component: Object.freeze({ props: Object.freeze({ text: 'Portable proof' }), style: Object.freeze({}) }),
    motion: Object.freeze({ motionPlanId: 'motion-plan:portable', motionDraftId: 'motion-draft:portable', motionDraftRevision: 1, motionOwnerApprovalId: 'approval_portable', scene, selectedNodeId: root.id, semanticNodeIds: Object.freeze([root.id]) }),
    governance: Object.freeze({
      styleLockId: 'style-lock:portable', creativeLanguageId: 'creative-language:portable', cohesionScore: 1, requiredCapabilities: Object.freeze([]), structuralQaPassed: true,
      reviewEvidence: Object.freeze({ canonicalReviewRef: 'production-preview://portable', posterRef: 'production-preview://portable/poster', criticalFrameRefs: Object.freeze([]), kvsAnchorFrameRefs: Object.freeze([]), entrancePayoffExitFrameRefs: Object.freeze([]), sourceCompositeFrameRefs: Object.freeze([]) }),
    }),
  })
  const serialized = canonicalCreativeArtifactJsonV1(artifact)
  const digest = createHash('sha256').update(serialized).digest('hex')
  const artifactId = `creativeart_${digest}`
  const accepted = acceptChangeSetAtomic(base, Object.freeze({
    schemaVersion: 'sanverse.change-set/v1', changeSetId: 'changeset_portable1', baseRevision: base.revision,
    operations: Object.freeze([Object.freeze({
      schemaVersion: 'sanverse.operation/v1', operationId: 'operation_portable1', kind: 'add-creative-scene', capabilityId: CREATIVE_SCENE_PRIMITIVE_ID,
      sceneId: artifact.sceneId, assetId: artifact.source.assetId, sourceInterval: Object.freeze({ start: mediaTime(0), duration: mediaTime(PROJECT_TIMESCALE) }),
      artifactId, artifactSha256: digest, presentationMode: 'overlay', layer: 1, extensions: Object.freeze({}),
    })]),
    provenance: Object.freeze({ source: 'ai', requestId: 'request_portable1' }), extensions: Object.freeze({}),
  }))
  assert.equal(accepted.status, 'accepted')
  if (accepted.status !== 'accepted') throw new Error('fixture Creative change set refused')

  const archive = buildPortableProjectArchive(accepted.project, '2026-08-29T00:00:00.000Z', [{ artifactId, sha256: digest, serialized }])
  assert.equal(archive.creativeArtifacts?.length, 1)
  assert.equal(validatePortableProjectArchive(archive).creativeArtifacts?.[0]?.artifactId, artifactId)

  const target = Object.freeze({ ...base, projectId: 'project_bbbbbbbbbbbbbbbb' })
  const restored = restorePortableProjectBundle(archive, target)
  assert.equal(restored.creativeArtifacts.length, 1)
  assert.notEqual(restored.creativeArtifacts[0]!.artifactId, artifactId)
  const restoredOperation = restored.project.changeSets[0]!.changeSet.operations[0]
  assert.equal(restoredOperation.kind, 'add-creative-scene')
  if (restoredOperation.kind !== 'add-creative-scene') throw new Error('restored operation kind changed')
  assert.equal(restoredOperation.artifactId, restored.creativeArtifacts[0]!.artifactId)
  assert.equal(restoredOperation.artifactSha256, restored.creativeArtifacts[0]!.sha256)
  assert.equal(JSON.parse(restored.creativeArtifacts[0]!.serialized).projectId, target.projectId)
})
