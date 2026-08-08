import { describe, expect, it } from 'vitest'
import {
  applyMotionOperation,
  applyMotionOperations,
  constant,
  createDefaultEffect,
  createDefaultMask,
  createMotionScene,
  identityTransform,
  nodeBase,
  validateCompositorReadiness,
  validateMotionGraphOperation,
  validateMotionScene,
} from './index.ts'
import type {
  MotionGraphOperationV1,
  MotionGroupNodeV1,
  MotionNodeV1,
  MotionPathNodeV1,
  MotionSceneV1,
  MotionShapeNodeV1,
  MotionTextNodeV1,
} from './index.ts'

const group = (id: string, name: string, parentId: string | null, childIds: readonly string[]): MotionGroupNodeV1 => Object.freeze({
  ...nodeBase(id, name, parentId), type: 'group', childIds: Object.freeze([...childIds]),
})

const text = (id: string, name: string, parentId: string, value: string): MotionTextNodeV1 => Object.freeze({
  ...nodeBase(id, name, parentId), type: 'text', text: constant(value), fillColor: constant('#ffffff'), fontFamily: 'Inter, sans-serif', fontSize: constant(48), fontWeight: constant(700), textAlign: 'left',
})

const shape = (id: string, name: string, parentId: string): MotionShapeNodeV1 => Object.freeze({
  ...nodeBase(id, name, parentId), type: 'shape', shape: 'rounded-rectangle', width: constant(640), height: constant(360), fillColor: constant('#111111'), strokeColor: constant('#ffffff'), strokeWidth: constant(2), radius: constant(24),
})

const path = (id: string, name: string, parentId: string): MotionPathNodeV1 => Object.freeze({
  ...nodeBase(id, name, parentId), type: 'path', pathData: 'M0 0 L100 0', fillColor: constant('transparent'), strokeColor: constant('#5fff52'), strokeWidth: constant(4), trimProgress: constant(1),
})

const baseScene = (): MotionSceneV1 => createMotionScene({
  componentId: 'sanverse.operations-test',
  componentVersion: 1,
  rootNodeId: 'root',
  nodes: Object.freeze({
    root: group('root', 'Root', null, ['surface', 'content', 'footer']),
    surface: shape('surface', 'Surface', 'root'),
    content: group('content', 'Content', 'root', ['label', 'value', 'icon']),
    label: text('label', 'Label', 'content', 'Revenue'),
    value: text('value', 'Value', 'content', '$24K'),
    icon: path('icon', 'Icon', 'content'),
    footer: text('footer', 'Footer', 'root', 'Source: internal'),
  }),
  semanticParts: Object.freeze([
    { id: 'surface', label: 'Surface', role: 'surface', nodeIds: Object.freeze(['surface']) },
    { id: 'content', label: 'Content', role: 'content-group', nodeIds: Object.freeze(['content', 'label', 'value', 'icon']) },
    { id: 'footer', label: 'Footer', role: 'secondary-text', nodeIds: Object.freeze(['footer']) },
  ]),
  exposures: Object.freeze([]),
  layout: Object.freeze({ mode: 'responsive', ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }),
  supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5']),
})

const expectSuccess = (result: ReturnType<typeof applyMotionOperation>) => {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error.message)
  expect(validateMotionScene(result.scene)).toMatchObject({ ok: true })
  return result
}

const apply = (scene: MotionSceneV1, operation: MotionGraphOperationV1) => expectSuccess(applyMotionOperation(scene, operation))

describe('MotionGraphOperationV1 syntax and property operations', () => {
  it('rejects malformed operation syntax before mutation', () => {
    const error = validateMotionGraphOperation({ type: 'set-property', operationId: '', target: {}, value: {} })
    expect(error).toMatchObject({ code: 'OPERATION_INVALID', path: '$.operationId' })
  })

  it('sets and resets a typed property immutably and exposes inverse readiness', () => {
    const scene = baseScene()
    const set = apply(scene, { operationId: 'op:set-opacity', type: 'set-property', target: { nodeId: 'value', property: 'opacity' }, value: constant(0.4) })
    expect(set.scene.nodes.value!.opacity).toEqual(constant(0.4))
    expect(scene.nodes.value!.opacity).toEqual(constant(1))
    expect(set.inverseOperations?.[0]).toMatchObject({ type: 'set-property', target: { nodeId: 'value', property: 'opacity' }, value: { kind: 'constant', value: 1 } })

    const reset = apply(set.scene, { operationId: 'op:reset-opacity', type: 'reset-property', target: { nodeId: 'value', property: 'opacity' }, value: constant(1) })
    expect(reset.scene.nodes.value!.opacity).toEqual(constant(1))
  })

  it('refuses properties unsupported by the addressed node type', () => {
    const result = applyMotionOperation(baseScene(), { operationId: 'op:bad-property', type: 'set-property', target: { nodeId: 'surface', property: 'text.text' }, value: constant('nope') })
    expect(result).toMatchObject({ ok: false, error: { code: 'PROPERTY_INVALID' } })
  })
})

describe('MotionGraphOperationV1 node structure', () => {
  it('adds and removes nodes with semantic coverage and explicit subtree removal', () => {
    const badge = text('badge', 'Badge', 'content', 'NEW')
    const added = apply(baseScene(), { operationId: 'op:add-badge', type: 'add-node', node: badge, parentId: 'content', index: 1 })
    expect((added.scene.nodes.content as MotionGroupNodeV1).childIds).toEqual(['label', 'badge', 'value', 'icon'])
    expect(added.scene.semanticParts.find((part) => part.id === 'content')?.nodeIds).toContain('badge')

    const removed = apply(added.scene, { operationId: 'op:remove-badge', type: 'remove-node', nodeId: 'badge', mode: 'subtree' })
    expect(removed.scene.nodes.badge).toBeUndefined()
    expect(removed.scene.semanticParts.some((part) => part.nodeIds.includes('badge'))).toBe(false)
  })

  it('removes an entire subtree and prunes graph references', () => {
    const removed = apply(baseScene(), { operationId: 'op:remove-content', type: 'remove-node', nodeId: 'content', mode: 'subtree' })
    for (const id of ['content', 'label', 'value', 'icon']) expect(removed.scene.nodes[id]).toBeUndefined()
    expect(removed.scene.semanticParts.some((part) => part.id === 'content')).toBe(false)
  })

  it('renames nodes without changing stable addressing', () => {
    const result = apply(baseScene(), { operationId: 'op:rename', type: 'rename-node', nodeId: 'value', name: 'Primary Revenue' })
    expect(result.scene.nodes.value).toMatchObject({ id: 'value', name: 'Primary Revenue' })
    expect(result.inverseOperations?.[0]).toMatchObject({ type: 'rename-node', nodeId: 'value', name: 'Value' })
  })

  it('reparents and reorders nodes while rejecting hierarchy cycles', () => {
    const reparented = apply(baseScene(), { operationId: 'op:reparent-footer', type: 'reparent-node', nodeId: 'footer', parentId: 'content', index: 1 })
    expect(reparented.scene.nodes.footer!.parentId).toBe('content')
    expect((reparented.scene.nodes.content as MotionGroupNodeV1).childIds).toEqual(['label', 'footer', 'value', 'icon'])

    const reordered = apply(reparented.scene, { operationId: 'op:reorder-footer', type: 'reorder-node', nodeId: 'footer', index: 3 })
    expect((reordered.scene.nodes.content as MotionGroupNodeV1).childIds).toEqual(['label', 'value', 'icon', 'footer'])

    const cyclic = applyMotionOperation(baseScene(), { operationId: 'op:cycle', type: 'reparent-node', nodeId: 'content', parentId: 'value' })
    expect(cyclic).toMatchObject({ ok: false, error: { code: 'PARENT_INVALID' } })

    const childGroup = group('nested', 'Nested', 'content', [])
    const nested = apply(baseScene(), { operationId: 'op:add-nested', type: 'add-node', node: childGroup, parentId: 'content' })
    const actualCycle = applyMotionOperation(nested.scene, { operationId: 'op:actual-cycle', type: 'reparent-node', nodeId: 'content', parentId: 'nested' })
    expect(actualCycle).toMatchObject({ ok: false, error: { code: 'CYCLE_DETECTED' } })
  })

  it('groups and ungroups contiguous siblings while preserving order', () => {
    const grouped = apply(baseScene(), { operationId: 'op:group', type: 'group-nodes', nodeIds: ['label', 'value'], groupId: 'metric-group', groupName: 'Metric' })
    expect((grouped.scene.nodes.content as MotionGroupNodeV1).childIds).toEqual(['metric-group', 'icon'])
    expect((grouped.scene.nodes['metric-group'] as MotionGroupNodeV1).childIds).toEqual(['label', 'value'])
    expect(grouped.scene.nodes.label!.parentId).toBe('metric-group')

    const ungrouped = apply(grouped.scene, { operationId: 'op:ungroup', type: 'ungroup-nodes', groupId: 'metric-group' })
    expect((ungrouped.scene.nodes.content as MotionGroupNodeV1).childIds).toEqual(['label', 'value', 'icon'])
    expect(ungrouped.scene.nodes['metric-group']).toBeUndefined()
  })

  it('refuses non-contiguous grouping because visual ordering would be ambiguous', () => {
    const result = applyMotionOperation(baseScene(), { operationId: 'op:bad-group', type: 'group-nodes', nodeIds: ['label', 'icon'], groupId: 'bad-group', groupName: 'Bad Group' })
    expect(result).toMatchObject({ ok: false, error: { code: 'GROUP_INVALID' } })
  })

  it('duplicates a subtree with deterministic fresh node/effect/mask IDs and copied semantic membership', () => {
    let scene = baseScene()
    scene = apply(scene, { operationId: 'op:add-glow', type: 'add-effect', nodeId: 'value', effect: createDefaultEffect('value-glow', 'glow') }).scene
    scene = apply(scene, { operationId: 'op:add-mask', type: 'add-mask', nodeId: 'value', mask: createDefaultMask('value-mask', 'ellipse') }).scene

    const first = apply(scene, { operationId: 'op:duplicate-content', type: 'duplicate-node', nodeId: 'content', duplicateId: 'content-copy' })
    const second = apply(scene, { operationId: 'op:duplicate-content', type: 'duplicate-node', nodeId: 'content', duplicateId: 'content-copy' })
    expect(first.scene).toEqual(second.scene)
    expect(first.scene.nodes['content-copy']).toBeDefined()
    const duplicatedValue = first.scene.nodes['content-copy::node:value']
    expect(duplicatedValue?.effects[0]?.id).toBe('content-copy::node:value::effect:value-glow')
    expect(duplicatedValue?.masks[0]?.id).toBe('content-copy::node:value::mask:value-mask')
    expect(first.scene.semanticParts.find((part) => part.id === 'content')?.nodeIds).toContain('content-copy::node:value')
    expect(validateCompositorReadiness(first.scene).ready).toBe(true)
  })

  it('accepts an injectable deterministic ID strategy without putting functions in the operation payload', () => {
    const operation: MotionGraphOperationV1 = { operationId: 'op:custom-ids', type: 'duplicate-node', nodeId: 'value', duplicateId: 'value-copy' }
    expect(JSON.parse(JSON.stringify(operation))).toEqual(operation)
    const result = applyMotionOperation(baseScene(), operation, { idFactory: ({ kind, sourceId, suggestedId }) => kind === 'node' && sourceId === 'value' ? suggestedId : `${suggestedId}:stable` })
    expect(result.ok).toBe(true)
  })
})

describe('MotionGraphOperationV1 effects', () => {
  it('adds, enables/disables, duplicates, reorders, edits and removes effects', () => {
    let scene = apply(baseScene(), { operationId: 'op:add-blur', type: 'add-effect', nodeId: 'surface', effect: createDefaultEffect('blur-a', 'blur') }).scene
    scene = apply(scene, { operationId: 'op:add-glow', type: 'add-effect', nodeId: 'surface', effect: createDefaultEffect('glow-a', 'glow') }).scene
    scene = apply(scene, { operationId: 'op:disable-glow', type: 'set-effect-enabled', nodeId: 'surface', effectId: 'glow-a', enabled: false }).scene
    scene = apply(scene, { operationId: 'op:duplicate-glow', type: 'duplicate-effect', nodeId: 'surface', effectId: 'glow-a', duplicateId: 'glow-b' }).scene
    scene = apply(scene, { operationId: 'op:reorder-glow', type: 'reorder-effect', nodeId: 'surface', effectId: 'glow-b', index: 0 }).scene
    scene = apply(scene, { operationId: 'op:set-radius', type: 'set-effect-property', nodeId: 'surface', effectId: 'glow-b', parameter: 'radius', value: constant(44) }).scene
    expect(scene.nodes.surface!.effects.map((effect) => effect.id)).toEqual(['glow-b', 'blur-a', 'glow-a'])
    expect(scene.nodes.surface!.effects[0]?.parameters.radius).toEqual(constant(44))
    expect(scene.nodes.surface!.effects[2]?.enabled).toBe(false)
    scene = apply(scene, { operationId: 'op:remove-blur', type: 'remove-effect', nodeId: 'surface', effectId: 'blur-a' }).scene
    expect(scene.nodes.surface!.effects.map((effect) => effect.id)).toEqual(['glow-b', 'glow-a'])
  })

  it('fails closed on unknown or out-of-range effect parameters', () => {
    const withGlow = apply(baseScene(), { operationId: 'op:add-glow', type: 'add-effect', nodeId: 'surface', effect: createDefaultEffect('glow-a', 'glow') }).scene
    const unknown = applyMotionOperation(withGlow, { operationId: 'op:bad-param', type: 'set-effect-property', nodeId: 'surface', effectId: 'glow-a', parameter: 'not-real', value: constant(1) })
    expect(unknown).toMatchObject({ ok: false, error: { code: 'EFFECT_PARAMETER_INVALID' } })
    const range = applyMotionOperation(withGlow, { operationId: 'op:bad-range', type: 'set-effect-property', nodeId: 'surface', effectId: 'glow-a', parameter: 'radius', value: constant(999) })
    expect(range).toMatchObject({ ok: false, error: { code: 'EFFECT_PARAMETER_INVALID' } })
  })
})

describe('MotionGraphOperationV1 masks and blend modes', () => {
  it('adds, edits, reorders and removes masks deterministically', () => {
    let scene = apply(baseScene(), { operationId: 'op:add-rect', type: 'add-mask', nodeId: 'value', mask: createDefaultMask('rect-a', 'rectangle') }).scene
    scene = apply(scene, { operationId: 'op:add-ellipse', type: 'add-mask', nodeId: 'value', mask: createDefaultMask('ellipse-a', 'ellipse') }).scene
    scene = apply(scene, { operationId: 'op:move-ellipse', type: 'reorder-mask', nodeId: 'value', maskId: 'ellipse-a', index: 0 }).scene
    scene = apply(scene, { operationId: 'op:feather', type: 'set-mask-property', nodeId: 'value', maskId: 'ellipse-a', property: 'feather', value: constant(0.35) }).scene
    expect(scene.nodes.value!.masks.map((mask) => mask.id)).toEqual(['ellipse-a', 'rect-a'])
    expect(scene.nodes.value!.masks[0]?.feather).toEqual(constant(0.35))
    scene = apply(scene, { operationId: 'op:remove-rect', type: 'remove-mask', nodeId: 'value', maskId: 'rect-a' }).scene
    expect(scene.nodes.value!.masks.map((mask) => mask.id)).toEqual(['ellipse-a'])
  })

  it('refuses invalid mask geometry and unknown blend modes', () => {
    const withMask = apply(baseScene(), { operationId: 'op:add-mask', type: 'add-mask', nodeId: 'value', mask: createDefaultMask('mask-a', 'rectangle') }).scene
    const mask = applyMotionOperation(withMask, { operationId: 'op:bad-mask', type: 'set-mask-property', nodeId: 'value', maskId: 'mask-a', property: 'opacity', value: constant(4) })
    expect(mask).toMatchObject({ ok: false, error: { code: 'MASK_INVALID' } })
    const blend = applyMotionOperation(baseScene(), { operationId: 'op:bad-blend', type: 'set-blend-mode', nodeId: 'value', blendMode: 'difference' as never })
    expect(blend).toMatchObject({ ok: false, error: { code: 'BLEND_MODE_INVALID' } })
  })

  it('sets a supported blend mode and records its inverse', () => {
    const result = apply(baseScene(), { operationId: 'op:screen', type: 'set-blend-mode', nodeId: 'value', blendMode: 'screen' })
    expect(result.scene.nodes.value!.blendMode).toBe('screen')
    expect(result.inverseOperations?.[0]).toMatchObject({ type: 'set-blend-mode', blendMode: 'normal' })
  })
})

describe('Motion operation transactions and serialization', () => {
  it('keeps operation payloads serializable and produces identical results after JSON round trip', () => {
    const operations: readonly MotionGraphOperationV1[] = [
      { operationId: 'op:opacity', type: 'set-property', target: { nodeId: 'value', property: 'opacity' }, value: constant(0.7) },
      { operationId: 'op:glow', type: 'add-effect', nodeId: 'value', effect: createDefaultEffect('glow-a', 'glow') },
      { operationId: 'op:mask', type: 'add-mask', nodeId: 'value', mask: createDefaultMask('mask-a', 'rounded-rectangle') },
    ]
    const parsed = JSON.parse(JSON.stringify(operations)) as MotionGraphOperationV1[]
    expect(parsed).toEqual(operations)
    const a = applyMotionOperations(baseScene(), operations)
    const b = applyMotionOperations(baseScene(), parsed)
    expect(a).toEqual(b)
    expect(a.ok).toBe(true)
  })

  it('applies batches atomically and exposes the failed index/cause without mutating the input', () => {
    const scene = baseScene()
    const before = JSON.parse(JSON.stringify(scene)) as MotionSceneV1
    const result = applyMotionOperations(scene, [
      { operationId: 'op:first', type: 'set-property', target: { nodeId: 'value', property: 'opacity' }, value: constant(0.2) },
      { operationId: 'op:second', type: 'set-property', target: { nodeId: 'surface', property: 'text.text' }, value: constant('invalid') },
      { operationId: 'op:third', type: 'rename-node', nodeId: 'footer', name: 'Never Reached' },
    ])
    expect(result).toMatchObject({ ok: false, error: { code: 'BATCH_FAILED', causeCode: 'PROPERTY_INVALID', failedOperationIndex: 1 } })
    expect(scene).toEqual(before)
    expect(scene.nodes.value!.opacity).toEqual(constant(1))
  })

  it('keeps every successful result graph-valid and deterministic across repeated identical application', () => {
    const operations: readonly MotionGraphOperationV1[] = [
      { operationId: 'op:rename', type: 'rename-node', nodeId: 'value', name: 'Metric Value' },
      { operationId: 'op:duplicate', type: 'duplicate-node', nodeId: 'value', duplicateId: 'value-copy' },
      { operationId: 'op:blend', type: 'set-blend-mode', nodeId: 'value-copy', blendMode: 'multiply' },
    ]
    const first = applyMotionOperations(baseScene(), operations)
    const second = applyMotionOperations(baseScene(), operations)
    expect(first).toEqual(second)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(validateMotionScene(first.scene)).toMatchObject({ ok: true })
    expect(validateCompositorReadiness(first.scene).ready).toBe(true)
  })
})
