import { describe, expect, it } from 'vitest'
import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import {
  applyMotionGraphPatch,
  applyMotionGraphPatches,
  constant,
  createDefaultEffect,
  createDefaultMask,
  deriveLayerTree,
  deriveNodeEffectRelationships,
  deriveTimelineTracks,
  evaluateScene,
  validateCompositorReadiness,
  validateMotionScene,
} from '@sanverse/motion-graph'
import type { MotionSceneV1, MotionTextNodeV1 } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { MOTION_REFERENCE_COMPOSITIONS } from './reference-compositions.ts'
import {
  DEFAULT_KINETIC_HEADLINE_PROPS,
  DEFAULT_KINETIC_HEADLINE_STYLE,
  createKineticHeadlineScene,
} from './components/kinetic-headline.tsx'
import {
  DEFAULT_CHECKLIST_CARD_PROPS,
  DEFAULT_CHECKLIST_CARD_STYLE,
  createChecklistCardScene,
} from './components/checklist-card.tsx'
import {
  DEFAULT_COST_VALUE_CARD_PROPS,
  DEFAULT_COST_VALUE_CARD_STYLE,
  createCostValueCardScene,
} from './components/cost-value-card.tsx'
import {
  DEFAULT_TIMER_STATUS_PILL_PROPS,
  DEFAULT_TIMER_STATUS_PILL_STYLE,
  createTimerStatusPillScene,
} from './components/timer-status-pill.tsx'
import {
  DEFAULT_TEAM_NETWORK_PROPS,
  DEFAULT_TEAM_NETWORK_STYLE,
  createTeamNetworkDiagramScene,
} from './components/team-network-diagram.tsx'

const context = (localTicks: number, durationSeconds: number): MotionRenderContextV1 => ({
  localTicks,
  durationTicks: durationSeconds * SANVERSE_TICKS_PER_SECOND,
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: MOTION_REFERENCE_COMPOSITIONS['16:9'],
  reducedMotion: false,
})

const scenes = (): readonly Readonly<{ scene: MotionSceneV1; durationSeconds: number; mutationNodeId: string }>[] => Object.freeze([
  Object.freeze({ scene: createKineticHeadlineScene(DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, context(1_296_000, 3)), durationSeconds: 3, mutationNodeId: 'kinetic-headline.background' }),
  Object.freeze({ scene: createChecklistCardScene(DEFAULT_CHECKLIST_CARD_PROPS, DEFAULT_CHECKLIST_CARD_STYLE, context(4_464_000, 5)), durationSeconds: 5, mutationNodeId: 'checklist.surface' }),
  Object.freeze({ scene: createCostValueCardScene(DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, context(4_320_000, 5)), durationSeconds: 5, mutationNodeId: 'cost-card.value' }),
  Object.freeze({ scene: createTimerStatusPillScene(DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, context(3_024_000, 5)), durationSeconds: 5, mutationNodeId: 'timer.surface' }),
  Object.freeze({ scene: createTeamNetworkDiagramScene(DEFAULT_TEAM_NETWORK_PROPS, DEFAULT_TEAM_NETWORK_STYLE, context(4_752_000, 6)), durationSeconds: 6, mutationNodeId: 'team-network.node:core' }),
])

const roundTrip = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('MOTION-C0 representative Level-4 readiness audit', () => {
  it('all five proof components enumerate a valid semantic hierarchy and derive Layers, Nodes/Effects and Timeline views', () => {
    for (const { scene } of scenes()) {
      expect(validateMotionScene(scene)).toMatchObject({ ok: true })
      expect(validateCompositorReadiness(scene)).toMatchObject({ ready: true })
      expect(deriveLayerTree(scene).nodeId).toBe(scene.rootNodeId)
      expect(deriveNodeEffectRelationships(scene)).toHaveLength(Object.keys(scene.nodes).length)
      expect(deriveTimelineTracks(scene).length).toBeGreaterThan(0)
      const covered = new Set(scene.semanticParts.flatMap((part) => part.nodeIds))
      expect(Object.keys(scene.nodes).filter((nodeId) => nodeId !== scene.rootNodeId).every((nodeId) => covered.has(nodeId))).toBe(true)
    }
  })

  it('all five scenes serialize/deserialize and evaluate identically at repeated, backward and random exact ticks', () => {
    for (const { scene, durationSeconds } of scenes()) {
      const parsed = roundTrip(scene)
      expect(validateMotionScene(parsed)).toMatchObject({ ok: true })
      const ticks = [0.67, 0.13, 0.91, 0.42, 0.13, 0.67].map((progress) => Math.round(durationSeconds * SANVERSE_TICKS_PER_SECOND * progress))
      const resolved = ticks.map((tick) => evaluateScene(parsed, context(tick, durationSeconds)))
      expect(resolved[0]).toEqual(resolved[5])
      expect(resolved[1]).toEqual(resolved[4])
    }
  })

  it('every representative scene supports independent node transform, opacity, effect, mask and blend edits without mutating the source', () => {
    for (const { scene, mutationNodeId } of scenes()) {
      const original = roundTrip(scene)
      let edited = applyMotionGraphPatches(scene, [
        { op: 'set-property', target: { nodeId: mutationNodeId, property: 'transform.positionX' }, value: constant(37) },
        { op: 'set-property', target: { nodeId: mutationNodeId, property: 'opacity' }, value: constant(0.73) },
        { op: 'add-effect', nodeId: mutationNodeId, effect: createDefaultEffect('c0-glow', 'glow') },
        { op: 'add-mask', nodeId: mutationNodeId, mask: createDefaultMask('c0-mask', 'rectangle') },
        { op: 'set-blend-mode', nodeId: mutationNodeId, blendMode: 'screen' },
      ])
      edited = applyMotionGraphPatch(edited, { op: 'reorder-effect', nodeId: mutationNodeId, effectId: 'c0-glow', index: 0 })
      expect(edited.nodes[mutationNodeId]).toMatchObject({ blendMode: 'screen' })
      expect(edited.nodes[mutationNodeId]!.effects.map((effect) => effect.id)).toContain('c0-glow')
      expect(edited.nodes[mutationNodeId]!.masks.map((mask) => mask.id)).toContain('c0-mask')
      expect(scene).toEqual(original)
      expect(validateMotionScene(edited)).toMatchObject({ ok: true })
    }
  })

  it('performs the required Cost Card structural mutation through graph APIs only', () => {
    const source = createCostValueCardScene(DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, context(4_320_000, 5))
    const valueNumber = source.nodes['cost-card.value.number']
    expect(valueNumber?.type).toBe('text')
    if (!valueNumber || valueNumber.type !== 'text') throw new Error('Cost Card value number node is required for C0 proof.')

    const secondaryValue: MotionTextNodeV1 = Object.freeze({
      ...valueNumber,
      id: 'cost-card.value.secondary-number',
      name: 'Secondary Value',
      parentId: 'cost-card.value',
      text: constant('+24h'),
      transform: Object.freeze({ ...valueNumber.transform, positionY: constant(72) }),
      effects: Object.freeze([]),
      masks: Object.freeze([]),
    })

    const derived = applyMotionGraphPatches(source, [
      { op: 'add-node', node: secondaryValue, parentId: 'cost-card.value' },
      { op: 'remove-node', nodeId: 'cost-card.direction-indicator' },
      { op: 'add-effect', nodeId: 'cost-card.value', effect: createDefaultEffect('c0-value-glow', 'glow') },
      { op: 'add-mask', nodeId: 'cost-card.value', mask: createDefaultMask('c0-value-mask', 'rounded-rectangle') },
    ])

    expect(derived.nodes['cost-card.value.secondary-number']).toBeDefined()
    expect(derived.nodes['cost-card.direction-indicator']).toBeUndefined()
    expect(derived.nodes['cost-card.value']!.effects.map((effect) => effect.id)).toContain('c0-value-glow')
    expect(derived.nodes['cost-card.value']!.masks.map((mask) => mask.id)).toContain('c0-value-mask')
    expect(derived.semanticParts.find((part) => part.id === 'value')?.nodeIds).toContain('cost-card.value.secondary-number')
    expect(derived.semanticParts.some((part) => part.nodeIds.includes('cost-card.direction-indicator'))).toBe(false)
    expect(validateMotionScene(derived)).toMatchObject({ ok: true })
    expect(validateCompositorReadiness(derived)).toMatchObject({ ready: true })
    expect(deriveLayerTree(derived).children.length).toBeGreaterThan(0)
    expect(deriveNodeEffectRelationships(derived).find((entry) => entry.nodeId === 'cost-card.value')?.effects.map((effect) => effect.type)).toContain('glow')

    const tick = Math.round(5 * SANVERSE_TICKS_PER_SECOND * 0.55)
    const a = evaluateScene(roundTrip(derived), context(tick, 5))
    const b = evaluateScene(roundTrip(derived), context(tick, 5))
    expect(a).toEqual(b)
  })
})
