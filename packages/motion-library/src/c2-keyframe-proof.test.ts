import { describe, expect, it } from 'vitest'
import { applyMotionOperations, deriveTimelineTracks, evaluateScene } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { COST_VALUE_CARD_DEFINITION, CostValueCardModule, DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE } from './components/cost-value-card.tsx'
import { C2_COST_CARD_KEYFRAME_PROOF_OPERATIONS, C2_COST_CARD_PROOF_DURATION_TICKS } from './c2-keyframe-proof.ts'
import { MOTION_REFERENCE_COMPOSITIONS } from './reference-compositions.ts'

const context = (localTicks: number) => ({
  localTicks,
  durationTicks: C2_COST_CARD_PROOF_DURATION_TICKS,
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: MOTION_REFERENCE_COMPOSITIONS['16:9'],
  reducedMotion: false,
}) as const

const buildProof = () => {
  const base = CostValueCardModule.createScene(DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, context(0))
  const result = applyMotionOperations(base, C2_COST_CARD_KEYFRAME_PROOF_OPERATIONS, { durationTicks: C2_COST_CARD_PROOF_DURATION_TICKS })
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return { base, scene: result.scene }
}

describe('C2 Cost / Value Card compositor keyframe proof', () => {
  it('changes no Cost Card definition or JSX contract and applies the proof only through graph operations', () => {
    const { base, scene } = buildProof()
    expect(COST_VALUE_CARD_DEFINITION.version).toBe(1)
    expect(base.nodes['cost-card.value']?.effects.some((effect) => effect.id === 'c2-proof-glow')).toBe(false)
    expect(scene.nodes['cost-card.value']?.effects.some((effect) => effect.id === 'c2-proof-glow')).toBe(true)
    expect(C2_COST_CARD_KEYFRAME_PROOF_OPERATIONS.every((operation) => typeof operation.operationId === 'string')).toBe(true)
  })

  it('keys surface opacity, value scale, arrow rotation, glow intensity and whole-card positionY', () => {
    const { scene } = buildProof()
    const tracks = deriveTimelineTracks(scene)
    expect(tracks).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'cost-card.surface', property: 'opacity', animationKind: 'keyframes' }),
      expect.objectContaining({ nodeId: 'cost-card.value', property: 'transform.scaleX', animationKind: 'keyframes' }),
      expect.objectContaining({ nodeId: 'cost-card.value', property: 'transform.scaleY', animationKind: 'keyframes' }),
      expect.objectContaining({ nodeId: 'cost-card.direction-indicator', property: 'transform.rotationDeg', animationKind: 'keyframes' }),
      expect.objectContaining({ nodeId: 'cost-card.value', property: 'effect.c2-proof-glow.intensity', animationKind: 'keyframes' }),
      expect.objectContaining({ nodeId: 'cost-card.root', property: 'transform.positionY', animationKind: 'keyframes' }),
    ]))
  })

  it('resolves the authored proof endpoints exactly', () => {
    const { scene } = buildProof()
    const start = evaluateScene(scene, context(0))
    expect(start.nodes['cost-card.surface']?.opacity).toBe(0)
    expect(start.nodes['cost-card.value']?.transform.scaleX).toBe(0.8)
    expect(start.nodes['cost-card.value']?.transform.scaleY).toBe(0.8)
    expect(start.nodes['cost-card.root']?.transform.positionY).toBe(60)
    expect(start.nodes['cost-card.value']?.effects.find((effect) => effect.id === 'c2-proof-glow')?.parameters.intensity).toBe(0)

    const settled = evaluateScene(scene, context(Math.round(C2_COST_CARD_PROOF_DURATION_TICKS * 0.72)))
    expect(settled.nodes['cost-card.surface']?.opacity).toBe(1)
    expect(settled.nodes['cost-card.value']?.transform.scaleX).toBe(1)
    expect(settled.nodes['cost-card.value']?.transform.scaleY).toBe(1)
    expect(settled.nodes['cost-card.direction-indicator']?.transform.rotationDeg).toBe(0)
    expect(settled.nodes['cost-card.root']?.transform.positionY).toBe(0)
    expect(settled.nodes['cost-card.value']?.effects.find((effect) => effect.id === 'c2-proof-glow')?.parameters.intensity).toBe(0.2)
  })

  it('matches direct exact-tick evaluation after forward, backward and random seeks', () => {
    const { scene } = buildProof()
    const targetTick = Math.round(C2_COST_CARD_PROOF_DURATION_TICKS * 0.46)
    const direct = evaluateScene(scene, context(targetTick))
    for (const tick of [0, C2_COST_CARD_PROOF_DURATION_TICKS, Math.round(C2_COST_CARD_PROOF_DURATION_TICKS * 0.14), targetTick, Math.round(C2_COST_CARD_PROOF_DURATION_TICKS * 0.9), targetTick]) evaluateScene(scene, context(tick))
    const repeated = evaluateScene(scene, context(targetTick))
    expect(repeated).toEqual(direct)
    expect(repeated.nodes['cost-card.surface']?.opacity).toBe(1)
    expect(repeated.nodes['cost-card.direction-indicator']?.transform.rotationDeg).toBeCloseTo(0, 8)
    expect(repeated.nodes['cost-card.value']?.effects.find((effect) => effect.id === 'c2-proof-glow')?.parameters.intensity).toBeCloseTo(0.6, 8)
  })

  it('keeps the proof duration inside the component supported duration window', () => {
    expect(C2_COST_CARD_PROOF_DURATION_TICKS).toBeGreaterThanOrEqual(COST_VALUE_CARD_DEFINITION.minDurationTicks)
    expect(C2_COST_CARD_PROOF_DURATION_TICKS).toBeLessThanOrEqual(COST_VALUE_CARD_DEFINITION.maxDurationTicks)
  })
})
