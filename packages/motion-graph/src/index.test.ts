import { describe, expect, it } from 'vitest'
import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import {
  applyMotionGraphPatch,
  applyMotionGraphPatches,
  constant,
  constantPropertyPatch,
  createDefaultEffect,
  createDefaultMask,
  createMotionScene,
  evaluateScene,
  exposuresForLevel,
  deriveLayerTree,
  deriveNodeEffectRelationships,
  deriveTimelineTracks,
  validateCompositorReadiness,
  identityTransform,
  motionNumber,
  motionString,
  nodeBase,
  validateMotionScene,
} from './index.ts'
import type { MotionSceneV1 } from './index.ts'

const context = (localTicks: number): MotionRenderContextV1 => ({
  localTicks,
  durationTicks: 10_000,
  ticksPerSecond: 1_000,
  composition: { width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 },
  reducedMotion: false,
})

const baseScene = (): MotionSceneV1 => {
  const blur = createDefaultEffect('blur-1', 'blur')
  const glow = createDefaultEffect('glow-1', 'glow')
  const mask = createDefaultMask('mask-1', 'rounded-rectangle')
  const root = Object.freeze({ ...nodeBase('demo.root', 'Demo', null), type: 'group' as const, childIds: Object.freeze(['demo.surface', 'demo.value', 'demo.path', 'demo.image']) })
  const surface = Object.freeze({
    ...nodeBase('demo.surface', 'Surface', 'demo.root'),
    type: 'shape' as const,
    shape: 'rounded-rectangle' as const,
    width: constant(800), height: constant(420), fillColor: constant('#111111'), strokeColor: constant('#ffffff'), strokeWidth: constant(2), radius: constant(36),
    opacity: motionNumber({ kind: 'interpolation', from: 0, to: 1, start: 0, end: 0.5, easing: 'ease-out-cubic' }),
    effects: Object.freeze([blur, glow]), masks: Object.freeze([mask]),
  })
  const value = Object.freeze({
    ...nodeBase('demo.value', 'Value', 'demo.root'),
    type: 'text' as const,
    text: constant('42'), fillColor: constant('#5fff52'), fontFamily: 'Inter', fontSize: constant(80), fontWeight: constant(800), textAlign: 'center' as const,
  })
  const path = Object.freeze({
    ...nodeBase('demo.path', 'Arrow', 'demo.root'),
    type: 'path' as const,
    pathData: 'M0 0 L100 0', fillColor: constant('transparent'), strokeColor: constant('#ffffff'), strokeWidth: constant(4), trimProgress: constant(1),
  })
  const image = Object.freeze({
    ...nodeBase('demo.image', 'Image', 'demo.root'),
    type: 'image' as const,
    source: 'asset://demo', width: constant(320), height: constant(180), fit: 'cover' as const, imageOpacity: constant(1),
  })
  return createMotionScene({
    componentId: 'sanverse.demo', componentVersion: 1, rootNodeId: root.id,
    nodes: Object.freeze({ [root.id]: root, [surface.id]: surface, [value.id]: value, [path.id]: path, [image.id]: image }),
    semanticParts: Object.freeze([
      { id: 'surface', label: 'Surface', role: 'surface', nodeIds: Object.freeze([surface.id]) },
      { id: 'value', label: 'Value', role: 'value', nodeIds: Object.freeze([value.id]) },
    ]),
    exposures: Object.freeze([
      { id: 'content.value', label: 'Value', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'value' }, editor: { type: 'text' }, keyframeable: false },
      { id: 'surface.radius', label: 'Roundness', group: 'Surface', level: 'designer', target: { kind: 'node', nodeId: surface.id, property: 'shape.radius' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 80, step: 1 } },
      { id: 'surface.blur', label: 'Blur', group: 'Effects', level: 'advanced', target: { kind: 'effect', nodeId: surface.id, effectId: blur.id, parameter: 'radius' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 80, step: 1 } },
    ]),
    layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([{ target: { nodeId: surface.id, property: 'transform.positionX' as const }, owner: 'layout' as const, reason: 'Centered by component layout.' }]), formatOverrides: Object.freeze([]) }),
    supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5']),
  })
}

const mutableClone = (scene: MotionSceneV1): Record<string, unknown> => JSON.parse(JSON.stringify(scene)) as Record<string, unknown>

describe('motion graph scene and evaluator', () => {
  it('validates a normalized scene containing group/text/shape/path/image nodes', () => {
    expect(validateMotionScene(baseScene())).toMatchObject({ ok: true })
  })

  it('serializes, parses, validates and evaluates equivalently', () => {
    const scene = baseScene()
    const parsed = JSON.parse(JSON.stringify(scene)) as MotionSceneV1
    expect(validateMotionScene(parsed)).toMatchObject({ ok: true })
    expect(evaluateScene(parsed, context(5_000))).toEqual(evaluateScene(scene, context(5_000)))
  })

  it('is exact-tick deterministic across repeated, backward and random seeks', () => {
    const scene = baseScene()
    const ticks = [0, 1_000, 2_500, 5_000, 7_500, 10_000, 2_500, 0, 7_500]
    const first = ticks.map((tick) => evaluateScene(scene, context(tick)))
    const second = ticks.map((tick) => evaluateScene(scene, context(tick)))
    expect(second).toEqual(first)
    expect(first[2]).toEqual(first[6])
    expect(first[0]).toEqual(first[7])
    expect(first[4]).toEqual(first[8])
  })

  it('evaluates deterministic interpolation and spring drivers without wall-clock state', () => {
    const scene = applyMotionGraphPatch(baseScene(), {
      op: 'set-property', target: { nodeId: 'demo.value', property: 'transform.scaleX' },
      value: motionNumber({ kind: 'spring', from: 0.8, to: 1, start: 0.1, end: 0.5, damping: 7, frequency: 0.9 }),
    })
    const a = evaluateScene(scene, context(3_000)).nodes['demo.value']!.transform.scaleX
    const b = evaluateScene(scene, context(3_000)).nodes['demo.value']!.transform.scaleX
    expect(a).toBe(b)
    expect(Number.isFinite(a)).toBe(true)
  })

  it('evaluates composable scalar formulas including reduced-motion branches', () => {
    const scene = applyMotionGraphPatch(baseScene(), {
      op: 'set-property', target: { nodeId: 'demo.value', property: 'opacity' },
      value: motionNumber({ kind: 'formula', expression: { kind: 'if-reduced-motion', reduced: { kind: 'constant', value: 1 }, normal: { kind: 'multiply', values: [{ kind: 'ease', easing: 'ease-out-cubic', input: { kind: 'sequence', input: { kind: 'progress' }, start: 0, end: 0.5 } }, { kind: 'subtract', a: { kind: 'constant', value: 1 }, b: { kind: 'sequence', input: { kind: 'progress' }, start: 0.8, end: 1 } }] } } }),
    })
    expect(evaluateScene(scene, context(2_500)).nodes['demo.value']!.opacity).toBeGreaterThan(0)
    const reducedContext = { ...context(2_500), reducedMotion: true }
    expect(evaluateScene(scene, reducedContext).nodes['demo.value']!.opacity).toBe(1)
  })

  it('evaluates compact-number and clock string drivers at exact ticks', () => {
    let scene = applyMotionGraphPatch(baseScene(), { op: 'set-property', target: { nodeId: 'demo.value', property: 'text.text' }, value: motionString({ kind: 'compact-number', from: 0, to: 24_000, start: 0, end: 1, easing: 'linear', prefix: '$', suffix: '', decimals: 1, rounding: 'integer' }) })
    expect((evaluateScene(scene, context(5_000)).nodes['demo.value'] as { text: string }).text).toBe('$12K')
    scene = applyMotionGraphPatch(scene, { op: 'set-property', target: { nodeId: 'demo.value', property: 'text.text' }, value: motionString({ kind: 'clock', totalSeconds: 90, mode: 'countdown', start: 0.12, end: 0.72, alwaysShowHours: false }) })
    expect((evaluateScene(scene, context(4_200)).nodes['demo.value'] as { text: string }).text).toBe('0:45')
  })

  it('evaluates simple numeric keyframes and hold values', () => {
    const scene = applyMotionGraphPatches(baseScene(), [
      { op: 'set-property', target: { nodeId: 'demo.value', property: 'transform.positionX' }, value: { kind: 'keyframes', keyframes: Object.freeze([{ id: 'a', tick: 0, value: 0, interpolation: 'linear' }, { id: 'b', tick: 10_000, value: 100, interpolation: 'linear' }]) } },
      { op: 'set-property', target: { nodeId: 'demo.value', property: 'visible' }, value: { kind: 'keyframes', keyframes: Object.freeze([{ id: 'v0', tick: 0, value: false, interpolation: 'hold' }, { id: 'v1', tick: 5_000, value: true, interpolation: 'hold' }]) } },
    ])
    expect(evaluateScene(scene, context(2_500)).nodes['demo.value']!.transform.positionX).toBe(25)
    expect(evaluateScene(scene, context(2_500)).nodes['demo.value']!.visible).toBe(false)
    expect(evaluateScene(scene, context(7_500)).nodes['demo.value']!.visible).toBe(true)
  })

  it('evaluates bounded bindings and refuses binding cycles', () => {
    const bound = applyMotionGraphPatch(baseScene(), { op: 'set-property', target: { nodeId: 'demo.value', property: 'opacity' }, value: { kind: 'binding', binding: { source: { nodeId: 'demo.surface', property: 'opacity' }, map: { scale: 0.5, offset: 0 } } } })
    expect(evaluateScene(bound, context(5_000)).nodes['demo.value']!.opacity).toBeCloseTo(0.5)
    const cyclic = applyMotionGraphPatches(baseScene(), [
      { op: 'set-property', target: { nodeId: 'demo.surface', property: 'opacity' }, value: { kind: 'binding', binding: { source: { nodeId: 'demo.value', property: 'opacity' } } } },
      { op: 'set-property', target: { nodeId: 'demo.value', property: 'opacity' }, value: { kind: 'binding', binding: { source: { nodeId: 'demo.surface', property: 'opacity' } } } },
    ])
    expect(() => evaluateScene(cyclic, context(5_000))).toThrow(/binding cycle/i)
  })
})

describe('single-graph compositor projections', () => {
  it('derives the layer hierarchy directly from group child order', () => {
    const tree = deriveLayerTree(baseScene())
    expect(tree.nodeId).toBe('demo.root')
    expect(tree.children.map((child) => child.nodeId)).toEqual(['demo.surface', 'demo.value', 'demo.path', 'demo.image'])
  })

  it('derives node/effect relationships from the same node records', () => {
    const relationships = deriveNodeEffectRelationships(baseScene())
    expect(relationships.find((entry) => entry.nodeId === 'demo.surface')?.effects.map((effect) => effect.type)).toEqual(['blur', 'glow'])
  })

  it('derives timeline tracks from animatable properties without a second keyframe store', () => {
    const scene = applyMotionGraphPatch(baseScene(), { op: 'set-property', target: { nodeId: 'demo.value', property: 'transform.positionX' }, value: { kind: 'keyframes', keyframes: Object.freeze([{ id: 'a', tick: 0, value: 0, interpolation: 'linear' }, { id: 'b', tick: 10_000, value: 100, interpolation: 'linear' }]) } })
    const tracks = deriveTimelineTracks(scene)
    expect(tracks).toEqual(expect.arrayContaining([expect.objectContaining({ nodeId: 'demo.surface', property: 'opacity', animationKind: 'motion' }), expect.objectContaining({ nodeId: 'demo.value', property: 'transform.positionX', animationKind: 'keyframes', keyframeTicks: [0, 10_000] })]))
  })

  it('reports missing semantic coverage as not compositor ready', () => {
    const report = validateCompositorReadiness(baseScene())
    expect(report.ready).toBe(false)
    expect(report.issues.some((entry) => entry.message.includes('semantic part'))).toBe(true)
  })
})

describe('effects, masks, blend and patches', () => {
  it('preserves ordered effects and reorders them explicitly', () => {
    const scene = baseScene()
    expect(scene.nodes['demo.surface']!.effects.map((effect) => effect.effectType)).toEqual(['blur', 'glow'])
    const reordered = applyMotionGraphPatch(scene, { op: 'reorder-effect', nodeId: 'demo.surface', effectId: 'glow-1', index: 0 })
    expect(reordered.nodes['demo.surface']!.effects.map((effect) => effect.effectType)).toEqual(['glow', 'blur'])
  })

  it('can add, disable, duplicate, edit and remove generic effects', () => {
    let scene = applyMotionGraphPatch(baseScene(), { op: 'add-effect', nodeId: 'demo.value', effect: createDefaultEffect('contrast-1', 'contrast') })
    scene = applyMotionGraphPatch(scene, { op: 'set-effect-enabled', nodeId: 'demo.value', effectId: 'contrast-1', enabled: false })
    scene = applyMotionGraphPatch(scene, { op: 'duplicate-effect', nodeId: 'demo.value', effectId: 'contrast-1', duplicateId: 'contrast-2' })
    scene = applyMotionGraphPatch(scene, { op: 'set-effect-property', nodeId: 'demo.value', effectId: 'contrast-2', parameter: 'amount', value: constant(1.5) })
    expect(evaluateScene(scene, context(5_000)).nodes['demo.value']!.effects).toMatchObject([{ id: 'contrast-1', enabled: false }, { id: 'contrast-2', parameters: { amount: 1.5 } }])
    scene = applyMotionGraphPatch(scene, { op: 'remove-effect', nodeId: 'demo.value', effectId: 'contrast-1' })
    expect(scene.nodes['demo.value']!.effects.map((effect) => effect.id)).toEqual(['contrast-2'])
  })

  it('adds/removes serializable rectangle/rounded rectangle/ellipse masks', () => {
    let scene = baseScene()
    scene = applyMotionGraphPatch(scene, { op: 'add-mask', nodeId: 'demo.value', mask: createDefaultMask('ellipse-1', 'ellipse') })
    expect(evaluateScene(scene, context(5_000)).nodes['demo.value']!.masks[0]).toMatchObject({ id: 'ellipse-1', type: 'ellipse', opacity: 1 })
    scene = applyMotionGraphPatch(scene, { op: 'remove-mask', nodeId: 'demo.value', maskId: 'ellipse-1' })
    expect(scene.nodes['demo.value']!.masks).toHaveLength(0)
  })

  it('sets a bounded supported blend mode', () => {
    const scene = applyMotionGraphPatch(baseScene(), { op: 'set-blend-mode', nodeId: 'demo.value', blendMode: 'screen' })
    expect(evaluateScene(scene, context(5_000)).nodes['demo.value']!.blendMode).toBe('screen')
  })

  it('supports typed constant property patches', () => {
    const scene = applyMotionGraphPatch(baseScene(), constantPropertyPatch({ nodeId: 'demo.surface', property: 'shape.radius' }, 64))
    expect(evaluateScene(scene, context(5_000)).nodes['demo.surface']).toMatchObject({ type: 'shape', radius: 64 })
  })
})

describe('exposure levels', () => {
  it('creator sees creator only, designer inherits creator, advanced sees all levels', () => {
    const exposures = baseScene().exposures
    expect(exposuresForLevel(exposures, 'creator').map((entry) => entry.id)).toEqual(['content.value'])
    expect(exposuresForLevel(exposures, 'designer').map((entry) => entry.id)).toEqual(['content.value', 'surface.radius'])
    expect(exposuresForLevel(exposures, 'advanced').map((entry) => entry.id)).toEqual(['content.value', 'surface.radius', 'surface.blur'])
  })
})

describe('truthful invalid graph refusal', () => {
  it('refuses a missing root', () => {
    const invalid = mutableClone(baseScene()); invalid.rootNodeId = 'missing'
    expect(validateMotionScene(invalid)).toMatchObject({ ok: false })
  })

  it('refuses duplicate structural node ids', () => {
    const invalid = mutableClone(baseScene()); const nodes = invalid.nodes as Record<string, unknown>; nodes.duplicate = { ...(nodes['demo.value'] as Record<string, unknown>), id: 'demo.value' }
    expect(validateMotionScene(invalid)).toMatchObject({ ok: false })
  })

  it('refuses a missing parent', () => {
    const invalid = mutableClone(baseScene()); ((invalid.nodes as Record<string, Record<string, unknown>>)['demo.value']!).parentId = 'missing'
    expect(validateMotionScene(invalid)).toMatchObject({ ok: false })
  })

  it('refuses a parent cycle', () => {
    const invalid = mutableClone(baseScene()); const nodes = invalid.nodes as Record<string, Record<string, unknown>>; nodes['demo.surface']!.parentId = 'demo.value'; nodes['demo.value']!.parentId = 'demo.surface'
    expect(validateMotionScene(invalid)).toMatchObject({ ok: false })
  })

  it('refuses an invalid semantic node reference', () => {
    const invalid = mutableClone(baseScene()); ((invalid.semanticParts as Record<string, unknown>[])[0]!).nodeIds = ['missing']
    expect(validateMotionScene(invalid)).toMatchObject({ ok: false })
  })

  it('refuses an invalid exposure target', () => {
    const invalid = mutableClone(baseScene()); ((invalid.exposures as Record<string, unknown>[])[1]!).target = { kind: 'node', nodeId: 'missing', property: 'opacity' }
    expect(validateMotionScene(invalid)).toMatchObject({ ok: false })
  })

  it('refuses invalid effect types', () => {
    const invalid = mutableClone(baseScene()); const nodes = invalid.nodes as Record<string, Record<string, unknown>>; ((nodes['demo.surface']!.effects as Record<string, unknown>[])[0]!).effectType = 'warp-drive'
    expect(validateMotionScene(invalid)).toMatchObject({ ok: false })
  })

  it('refuses unsupported blend modes', () => {
    const invalid = mutableClone(baseScene()); ((invalid.nodes as Record<string, Record<string, unknown>>)['demo.value']!).blendMode = 'difference'
    expect(validateMotionScene(invalid)).toMatchObject({ ok: false })
  })

  it('refuses invalid masks', () => {
    const invalid = mutableClone(baseScene()); const nodes = invalid.nodes as Record<string, Record<string, unknown>>; ((nodes['demo.surface']!.masks as Record<string, unknown>[])[0]!).type = 'star'
    expect(validateMotionScene(invalid)).toMatchObject({ ok: false })
  })

  it('refuses non-finite properties', () => {
    const invalid = baseScene(); const node = invalid.nodes['demo.value']!; const broken = { ...invalid, nodes: { ...invalid.nodes, [node.id]: { ...node, opacity: { kind: 'constant', value: Number.NaN } } } }
    expect(validateMotionScene(broken)).toMatchObject({ ok: false })
  })

  it('refuses malformed scalar formulas recursively', () => {
    const invalid = mutableClone(baseScene())
    const valueNode = (invalid.nodes as Record<string, Record<string, unknown>>)['demo.value']!
    valueNode.opacity = motionNumber({ kind: 'formula', expression: { kind: 'sequence', input: { kind: 'constant', value: Number.NaN }, start: 0.8, end: 0.2 } })
    expect(validateMotionScene(invalid)).toMatchObject({ ok: false })
  })

  it('refuses malformed clock drivers', () => {
    const invalid = mutableClone(baseScene())
    const valueNode = (invalid.nodes as Record<string, Record<string, unknown>>)['demo.value']!
    valueNode.text = motionString({ kind: 'clock', totalSeconds: 0, mode: 'countdown', start: 0.8, end: 0.2, alwaysShowHours: false })
    expect(validateMotionScene(invalid)).toMatchObject({ ok: false })
  })
})
