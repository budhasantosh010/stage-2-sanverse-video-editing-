import { describe, expect, it } from 'vitest'
import { createMotionScene } from './scene.ts'
import { constant } from './properties.ts'
import { nodeBase, type MotionExpertNodeV1 } from './nodes.ts'
import { validateMotionScene } from './validation.ts'
import { evaluateScene } from './evaluator.ts'
import { projectMotionLayers } from './layers.ts'

const context = Object.freeze({
  localTicks: 720_000,
  durationTicks: 7_200_000,
  ticksPerSecond: 1_440_000,
  composition: Object.freeze({ width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 }),
  reducedMotion: false,
})

const expertNode = (overrides: Partial<MotionExpertNodeV1['expert']> = {}): MotionExpertNodeV1 => Object.freeze({
  ...nodeBase('expert.demo', 'Expert Demo', 'root'),
  type: 'expert',
  expert: Object.freeze({
    schemaVersion: 'sanverse.motion-expert-node/v1',
    kind: 'particles',
    program: 'radial-burst',
    seed: 42,
    width: 960,
    height: 540,
    maxPrimitives: 96,
    parameters: Object.freeze({ count: 64, lifetimeTicks: 2_880_000, radius: 220, size: 10, speed: 1 }),
    ...overrides,
  }) as MotionExpertNodeV1['expert'],
})

const sceneWith = (node: MotionExpertNodeV1) => createMotionScene({
  componentId: 'expert-contract-test',
  componentVersion: 1,
  rootNodeId: 'root',
  nodes: Object.freeze({
    root: Object.freeze({ ...nodeBase('root', 'Root', null), type: 'group' as const, childIds: Object.freeze([node.id]) }),
    [node.id]: node,
  }),
  semanticParts: Object.freeze([{ id: 'expert', label: 'Expert visual', role: 'decoration' as const, nodeIds: Object.freeze([node.id]) }]),
  exposures: Object.freeze([]),
  layout: Object.freeze({ mode: 'manual' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }),
  supportedAspectRatios: Object.freeze(['16:9' as const]),
})

describe('C11/C12 canonical expert node contract', () => {
  it('keeps one bounded expert node inside the canonical Motion Scene and C3 projection', () => {
    const scene = sceneWith(expertNode())
    expect(validateMotionScene(scene)).toMatchObject({ ok: true })
    const resolved = evaluateScene(scene, context)
    expect(resolved.nodes['expert.demo']).toMatchObject({ type: 'expert', expert: { kind: 'particles', seed: 42, maxPrimitives: 96 } })
    expect(projectMotionLayers({ scene, resolvedScene: resolved }).layersById['expert.demo']).toMatchObject({ nodeType: 'expert', effectivelyVisibleAtTick: true })
  })

  it('fails closed before render when expert resource bounds are exceeded', () => {
    const result = validateMotionScene(sceneWith(expertNode({ maxPrimitives: 20_000 })))
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.issues.some((entry) => entry.path.includes('expert.maxPrimitives'))).toBe(true)
  })

  it('fails closed on unrecognized expert programs rather than executing arbitrary source', () => {
    const result = validateMotionScene(sceneWith(expertNode({ program: 'eval-user-code' as never })))
    expect(result).toMatchObject({ ok: false })
  })
})
