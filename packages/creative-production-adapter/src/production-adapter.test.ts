import { describe, expect, it } from 'vitest'
import { acceptChangeSet, activeOverlayOperations, activeVisualProperties, deserializeProject, serializeProject, undoChangeSet, redoChangeSet } from '@sanverse/edit-domain'
import { testProject } from '@sanverse/edit-domain/test-fixtures'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'
import {
  CREATIVE_PRODUCTION_LINEAGE_KEY,
  applyCreativeCurvePresetV16,
  buildCreativeProductionApplyBundleV16,
  buildKineticHeadlineCandidateV16,
  creativeAspectRatioForProjectV16,
  listCreativeInternalToolsV16,
  listCreativeProductionOpportunitiesV16,
  projectCreativeCandidateDetailsV16,
  projectCreativeCandidateV16,
  resolveCreativeProductionSourceV16,
} from './production-adapter.ts'

const candidate = () => {
  const built = buildKineticHeadlineCandidateV16({ project: testProject(), compositionTicks: 2_880_000, headline: 'Retention compounds faster', subhead: 'Creative Engine V1.6' })
  expect(built.ok).toBe(true)
  if (!built.ok) throw new Error(built.refusal.message)
  return built.value
}

describe('Creative production adapter V1.6', () => {
  it('uses the existing project clock/source identity and projects one semantic node through C3/C4/C5/C6', () => {
    const source = resolveCreativeProductionSourceV16({ project: testProject(), compositionTicks: 2_880_000 })
    expect(source).toMatchObject({ ok: true, value: { projectRevision: 0, assetId: 'asset_aaaaaaaa', compositionTicks: 2_880_000, sourceTicks: 2_880_000, durationTicks: 4_320_000 } })
    const projected = projectCreativeCandidateV16(candidate())
    expect(projected.layerCount).toBeGreaterThan(2)
    expect(projected.dopeTrackCount).toBeGreaterThan(0)
    expect(projected.keyframeCount).toBeGreaterThan(0)
    expect(projected.curveTrackCount).toBeGreaterThan(0)
    expect(projected).toMatchObject({ c3HasSelection: true, c4HasSelection: true, c5HasSelection: true, c6HasSelection: true })
  })

  it('exposes the real C3/C4/C5/C6 projections and applies C5 presets through canonical Motion Graph operations', () => {
    const source = candidate()
    const details = projectCreativeCandidateDetailsV16(source)
    expect(details.layers.length).toBeGreaterThan(2)
    expect(details.dopeTracks.length).toBeGreaterThan(0)
    expect(details.curveTracks.length).toBeGreaterThan(0)
    expect(details.nodes.length).toBe(details.layers.length)
    const editable = details.curveTracks.find((track) => track.editable && track.keyframes.length > 1)
    expect(editable).toBeDefined()
    if (!editable) return
    const before = editable.keyframes.map((key) => ({ id: key.keyframeId, interpolation: key.interpolation, value: key.value }))
    const edited = applyCreativeCurvePresetV16({ candidate: source, trackId: editable.trackId, leftKeyframeId: editable.keyframes[0]!.keyframeId, preset: 'snappy' })
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(edited.value.id).not.toBe(source.id)
    expect(edited.value.selectedNodeId).toBe(editable.nodeId)
    const after = projectCreativeCandidateDetailsV16(edited.value).curveTracks.find((track) => track.trackId === editable.trackId)
    expect(after?.keyframes.map((key) => key.keyframeId)).toEqual(before.map((key) => key.id))
    expect(after?.keyframes[0]?.interpolation).toBe('bezier')
    expect(after?.keyframes.map((key) => key.value)).toEqual(before.map((key) => key.value))
  })

  it.each([
    ['16:9', 1920, 1080],
    ['9:16', 1080, 1920],
    ['1:1', 1080, 1080],
    ['4:5', 1080, 1350],
  ] as const)('keeps one exact-tick Creative/production path at %s', (ratio, width, height) => {
    const base = testProject()
    const project = Object.freeze({ ...base, composition: Object.freeze({ ...base.composition, width, height }) })
    expect(creativeAspectRatioForProjectV16(project)).toBe(ratio)
    const built = buildKineticHeadlineCandidateV16({ project, compositionTicks: 1_440_000, headline: `Ratio ${ratio}` })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.value.renderContext).toMatchObject({ ticksPerSecond: 1_440_000, composition: { width, height } })
    expect(projectCreativeCandidateV16(built.value)).toMatchObject({ c3HasSelection: true, c4HasSelection: true, c5HasSelection: true, c6HasSelection: true })
    const bundle = buildCreativeProductionApplyBundleV16(built.value)
    expect(bundle.ok).toBe(true)
    if (!bundle.ok) return
    const accepted = acceptChangeSet(project, {
      schemaVersion: 'sanverse.change-set/v1', changeSetId: bundle.value.changeSetId, baseRevision: project.revision,
      operations: bundle.value.operations, provenance: bundle.value.provenance, extensions: bundle.value.extensions,
    })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    const compiled = compileProjectToRenderPlan(accepted.value)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    expect(compiled.value).toMatchObject({ width, height })
    expect(compiled.value.overlays.some((node) => node.kind === 'title-overlay' && node.headline === `Ratio ${ratio}`)).toBe(true)
  })

  it('fails closed for missing source time and unsupported non-1x source timing', () => {
    const base = testProject()
    expect(resolveCreativeProductionSourceV16({ project: base, compositionTicks: 99 * 1_440_000 })).toMatchObject({ ok: false, refusal: { code: 'NO_ACTIVE_PRIMARY_SOURCE' } })
    const track = base.composition.tracks[0]!
    const clip = track.clips[0]!
    const transformed = Object.freeze({
      ...base,
      composition: Object.freeze({
        ...base.composition,
        tracks: Object.freeze([
          Object.freeze({
            ...track,
            clips: Object.freeze([
              Object.freeze({ ...clip, timeTransform: Object.freeze({ ...clip.timeTransform, playbackRate: Object.freeze({ numerator: 2, denominator: 1 }) }) }),
            ]),
          }),
        ]),
      }),
    })
    expect(resolveCreativeProductionSourceV16({ project: transformed, compositionTicks: 1_440_000 })).toMatchObject({ ok: false, refusal: { code: 'UNSUPPORTED_SOURCE_TIME_TRANSFORM' } })
  })

  it('lists the one truthful production adapter without pretending the other 98 library components are production-native', () => {
    const opportunities = listCreativeProductionOpportunitiesV16()
    expect(opportunities).toHaveLength(99)
    expect(opportunities.filter((entry) => entry.productionStatus === 'native-production-adapter').map((entry) => entry.componentId)).toEqual(['sanverse.kinetic-headline'])
    expect(opportunities.filter((entry) => entry.productionStatus === 'creative-preview-only')).toHaveLength(98)
    const tools = listCreativeInternalToolsV16()
    expect(tools).toHaveLength(15)
    expect(tools.some((tool) => tool.id === 'motion.apply-plan-atomic-v15')).toBe(true)
    expect(tools.some((tool) => tool.id === 'external.inspect-three-webgl')).toBe(true)
  })

  it('adapts approved Creative output into existing title + visual operations as one accepted project action with lineage, Undo/Redo and save/reopen parity', () => {
    const built = buildCreativeProductionApplyBundleV16(candidate())
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.value.operations.map((operation) => operation.kind)).toEqual(['add-title', 'set-visual-properties'])
    expect(built.value.operations.every((operation) => 'extensions' in operation && CREATIVE_PRODUCTION_LINEAGE_KEY in operation.extensions)).toBe(true)
    const accepted = acceptChangeSet(testProject(), {
      schemaVersion: 'sanverse.change-set/v1', changeSetId: built.value.changeSetId, baseRevision: 0,
      operations: built.value.operations, provenance: built.value.provenance, extensions: built.value.extensions,
    })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.value.revision).toBe(1)
    expect(activeOverlayOperations(accepted.value)).toHaveLength(1)
    expect(activeVisualProperties(accepted.value)).toHaveLength(1)
    const compiled = compileProjectToRenderPlan(accepted.value)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    expect(compiled.value.overlays.some((node) => node.kind === 'title-overlay' && node.headline === 'Retention compounds faster')).toBe(true)
    const undone = undoChangeSet(accepted.value); expect(undone.ok).toBe(true); if (!undone.ok) return
    expect(activeOverlayOperations(undone.value)).toHaveLength(0)
    const redone = redoChangeSet(undone.value); expect(redone.ok).toBe(true); if (!redone.ok) return
    expect(activeOverlayOperations(redone.value)).toHaveLength(1)
    const serialized = serializeProject(redone.value); expect(serialized.ok).toBe(true); if (!serialized.ok) return
    const reopened = deserializeProject(serialized.value); expect(reopened.ok).toBe(true); if (!reopened.ok) return
    const reopenedPlan = compileProjectToRenderPlan(reopened.value); expect(reopenedPlan.ok).toBe(true); if (!reopenedPlan.ok) return
    // Undo/Redo advances the project revision by design. Render content itself
    // must survive save/reopen byte-for-structure-identically.
    expect(reopenedPlan.value.overlays).toEqual(compiled.value.overlays)
    expect(reopenedPlan.value.segments).toEqual(compiled.value.segments)
    expect(reopenedPlan.value.music).toEqual(compiled.value.music)
    expect(reopenedPlan.value.durationTicks).toEqual(compiled.value.durationTicks)
  })
})
