import { describe, expect, it } from 'vitest'
import {
  compileCreativeDirection,
  FixtureCreativePlanner,
  PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE,
} from '@sanverse/creative-direction'
import type { CreativeIntentResolverV1 } from '@sanverse/creative-direction'
import { createProductLaunchUnderstandingFixture } from '@sanverse/video-understanding'
import {
  applyMotionOperations,
  buildMotionCurvePresetOperations,
  evaluateScene,
  projectMotionCurves,
  projectMotionDopeSheet,
  projectMotionLayers,
  validateMotionScene,
} from '@sanverse/motion-graph'
import { INITIAL_MOTION_STYLE_PACKS, MOTION_COMPONENT_CATALOG } from '@sanverse/motion-library'
import {
  createCreativePlacementMotionPreview,
  creativePlacementMotionLabUrl,
  placementLocalTicksToSourceTick,
  sourceTickToPlacementLocalTicks,
} from './creative-engine-bridge.ts'
import {
  createSourceStatisticCreativeDirection,
  linkCreativeDirectiveToSourceObservations,
  resolveCreativeSourceTrace,
} from './creative-engine-source-bridge.ts'

const catalog = Object.freeze({
  componentIds: Object.freeze(MOTION_COMPONENT_CATALOG.map((definition) => definition.id)),
  stylePackIds: Object.freeze(INITIAL_MOTION_STYLE_PACKS.map((pack) => pack.id)),
})

const statisticResolver: CreativeIntentResolverV1 = {
  resolveGraphic(directive, available) {
    const requested = directive.communicationIntent === 'source-statistic' ? 'sanverse.donut-breakdown' : null
    return Object.freeze({ candidateComponentIds: Object.freeze(requested ? [requested] : []), selectedComponentId: requested && available.componentIds.includes(requested) ? requested : null })
  },
  resolveStyle(_directive, available) {
    const selected = available.stylePackIds.includes('sanverse.style.clean') ? 'sanverse.style.clean' : available.stylePackIds[0] ?? null
    return Object.freeze({ candidateStylePackIds: Object.freeze(selected ? [selected] : []), selectedStylePackId: selected })
  },
}

const stableGraphIds = (scene: Readonly<{ nodes: Readonly<Record<string, unknown>> }>) => Object.keys(scene.nodes)

const editableCurveWithSegment = (scene: Parameters<typeof projectMotionCurves>[0], nodeFragment?: string) => {
  const projection = projectMotionCurves(scene)
  const track = projection.tracks.find((candidate) => candidate.editable && candidate.keyframes.length >= 2 && (!nodeFragment || candidate.nodeId.includes(nodeFragment)))
    ?? projection.tracks.find((candidate) => candidate.editable && candidate.keyframes.length >= 2)
  if (!track) throw new Error('Expected an editable C5 numeric curve with at least two keys.')
  return track
}

describe('SANVERSE CREATIVE ENGINE ABC-2 source → curve integration', () => {
  it('turns the real B1 68% observation into a traceable B0 statistic proposal and real Plan-A scene', async () => {
    const understanding = await createProductLaunchUnderstandingFixture()
    const percentage = understanding.semanticMoments.find((moment) => moment.kind === 'percentage')!
    expect(percentage.value).toBe(68)
    expect(percentage.unit).toBe('%')
    const trace = resolveCreativeSourceTrace(understanding, percentage.id)
    expect(trace.observationId).toBe(percentage.id)
    expect(trace.startTicks).toBe(4 * 1_440_000)
    expect(trace.endTicks).toBe(8 * 1_440_000)
    expect(trace.analyzerId).toBe('sanverse.semantic-rules.v1')
    expect(trace.transcriptSegmentIds).toEqual(['transcript:1'])

    const direction = createSourceStatisticCreativeDirection(understanding, percentage.id)
    expect(direction.directives).toHaveLength(1)
    expect(direction.directives[0]?.sourceObservationIds).toEqual([percentage.id])
    const proposal = compileCreativeDirection({ document: direction, proposalId: 'proposal:abc2-source-statistic', resolver: statisticResolver, catalog, status: 'proposed', confidence: percentage.confidence, rationale: 'Deterministic B1 statistic → B0 semantic graphic proof.' })
    const placement = proposal.placements[0]!
    expect(placement.sourceObservationIds).toEqual([percentage.id])
    expect(placement.selectedComponentId).toBe('sanverse.donut-breakdown')
    expect(placement.content.fields?.value).toBe('68%')
    expect(placement.content.items).toEqual(['Observed · 68', 'Remaining · 32'])
    expect(creativePlacementMotionLabUrl(placement)).toContain('storyValue=68%25')

    const preview = createCreativePlacementMotionPreview(placement)
    expect(validateMotionScene(preview.scene).ok).toBe(true)
    expect(projectMotionLayers({ scene: preview.scene }).layersById[preview.scene.rootNodeId]).toBeDefined()
    expect(projectMotionDopeSheet(preview.scene).totalKeyframes).toBeGreaterThan(0)
    expect(projectMotionCurves(preview.scene).tracks.some((track) => track.editable)).toBe(true)
    const renderedText = Object.values(evaluateScene(preview.scene, preview.context).nodes).filter((node) => node.type === 'text').map((node) => node.type === 'text' ? node.text : '')
    expect(renderedText).toContain('68%')
  })

  it('keeps B1 evidence time, B0 edit-placement time and Plan-A local animation time explicit and reversible', async () => {
    const understanding = await createProductLaunchUnderstandingFixture()
    const percentage = understanding.semanticMoments.find((moment) => moment.kind === 'percentage')!
    const direction = createSourceStatisticCreativeDirection(understanding, percentage.id)
    const proposal = compileCreativeDirection({ document: direction, proposalId: 'proposal:abc2-time-map', resolver: statisticResolver, catalog })
    const preview = createCreativePlacementMotionPreview(proposal.placements[0]!)
    const evidenceTrace = resolveCreativeSourceTrace(understanding, percentage.id)
    expect(evidenceTrace.startTicks).toBe(preview.sourceStartTicks)
    expect(evidenceTrace.endTicks).toBe(preview.sourceEndTicks)
    const editMidpoint = Math.round((preview.sourceStartTicks + preview.sourceEndTicks) / 2)
    const localMidpoint = sourceTickToPlacementLocalTicks(preview, editMidpoint)
    expect(localMidpoint).toBe(Math.round(preview.context.durationTicks / 2))
    expect(placementLocalTicksToSourceTick(preview, localMidpoint)).toBe(editMidpoint)
  })

  it('edits the statistic in C5 through typed operations while source/directive/component/node/keyframe identity survives', async () => {
    const understanding = await createProductLaunchUnderstandingFixture()
    const percentage = understanding.semanticMoments.find((moment) => moment.kind === 'percentage')!
    const direction = createSourceStatisticCreativeDirection(understanding, percentage.id)
    const proposal = compileCreativeDirection({ document: direction, proposalId: 'proposal:abc2-stat-curve', resolver: statisticResolver, catalog })
    const placement = proposal.placements[0]!
    const preview = createCreativePlacementMotionPreview(placement)
    const track = editableCurveWithSegment(preview.scene, '.value')
    const left = track.keyframes[0]!
    let operationIndex = 0
    const operations = buildMotionCurvePresetOperations({ scene: preview.scene, trackId: track.trackId, leftKeyframeId: left.keyframeId, preset: 'soft', nextOperationId: (prefix) => `abc2:stat:${prefix}:${operationIndex++}` })
    const result = applyMotionOperations(preview.scene, operations, { durationTicks: preview.context.durationTicks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(placement.sourceObservationIds).toEqual([percentage.id])
    expect(result.scene.componentId).toBe(preview.componentId)
    expect(stableGraphIds(result.scene)).toEqual(stableGraphIds(preview.scene))
    const after = projectMotionCurves(result.scene).tracksById[track.trackId]!
    expect(after.keyframes.map((key) => key.keyframeId)).toEqual(track.keyframes.map((key) => key.keyframeId))
    expect(after.keyframes[0]?.interpolation).toBe('bezier')
    expect(projectMotionLayers({ scene: result.scene }).layersById[track.nodeId]).toBeDefined()
  })

  it('traces the real B1 security moment into B0 Scoped Access, then edits its C5 curve without losing either evidence or Motion identity', async () => {
    const understanding = await createProductLaunchUnderstandingFixture()
    const security = understanding.semanticMoments.find((moment) => moment.kind === 'security')!
    const trace = resolveCreativeSourceTrace(understanding, security.id)
    expect(trace.startTicks).toBe(49 * 1_440_000)
    expect(trace.endTicks).toBe(57 * 1_440_000)
    const linkedDirection = linkCreativeDirectiveToSourceObservations(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, 'graphic:scoped-access', [security.id], understanding)
    const proposal = await new FixtureCreativePlanner().propose({ document: linkedDirection, catalog })
    const placement = proposal.placements.find((entry) => entry.sourceDirectiveId === 'graphic:scoped-access')!
    expect(placement.sourceObservationIds).toEqual([security.id])
    expect(placement.selectedComponentId).toBe('sanverse.scoped-access-comparison')

    const preview = createCreativePlacementMotionPreview(placement)
    const track = editableCurveWithSegment(preview.scene, 'item:1')
    const beforeGraphIds = stableGraphIds(preview.scene)
    const beforeKeyIds = track.keyframes.map((key) => key.keyframeId)
    let operationIndex = 0
    const operations = buildMotionCurvePresetOperations({ scene: preview.scene, trackId: track.trackId, leftKeyframeId: track.keyframes[0]!.keyframeId, preset: 'smooth', nextOperationId: (prefix) => `abc2:scope:${prefix}:${operationIndex++}` })
    const result = applyMotionOperations(preview.scene, operations, { durationTicks: preview.context.durationTicks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.scene.componentId).toBe('sanverse.scoped-access-comparison')
    expect(stableGraphIds(result.scene)).toEqual(beforeGraphIds)
    const afterTrack = projectMotionCurves(result.scene).tracksById[track.trackId]!
    expect(afterTrack.keyframes.map((key) => key.keyframeId)).toEqual(beforeKeyIds)
    expect(afterTrack.keyframes[0]?.interpolation).toBe('bezier')
    expect(projectMotionDopeSheet(result.scene).tracksById[track.trackId]).toBeDefined()
    expect(projectMotionLayers({ scene: result.scene }).layersById[track.nodeId]).toBeDefined()
    expect(resolveCreativeSourceTrace(understanding, placement.sourceObservationIds![0]!).observationId).toBe(security.id)
  })
})
