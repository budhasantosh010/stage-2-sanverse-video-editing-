import { describe, expect, it } from 'vitest'
import {
  applyMotionOperation,
  applyMotionOperations,
  constant,
  createMotionAuthoringMetadata,
  createMotionScene,
  nodeBase,
  validateMotionAuthoringBudgetV1,
  validateMotionScene,
  type MotionGraphOperationV1,
  type MotionGroupNodeV1,
  type MotionImageNodeV1,
  type MotionPathNodeV1,
  type MotionSceneV1,
  type MotionShapeNodeV1,
  type MotionTextNodeV1,
} from './index.ts'

const group = (id: string, parentId: string | null, childIds: readonly string[]): MotionGroupNodeV1 => Object.freeze({ ...nodeBase(id, id, parentId), type: 'group', childIds: Object.freeze([...childIds]) })
const text = (id: string, parentId: string, value: string): MotionTextNodeV1 => Object.freeze({ ...nodeBase(id, id, parentId), type: 'text', text: constant(value), fillColor: constant('#fff'), fontFamily: 'Inter, sans-serif', fontSize: constant(48), fontWeight: constant(700), textAlign: 'left' })
const shape = (id: string, parentId: string, kind: MotionShapeNodeV1['shape'] = 'rectangle', size = 100): MotionShapeNodeV1 => Object.freeze({ ...nodeBase(id, id, parentId), type: 'shape', shape: kind, width: constant(size), height: constant(size), fillColor: constant('#ff6a00'), strokeColor: constant('#fff'), strokeWidth: constant(2), radius: constant(0) })
const path = (id: string, parentId: string, pathData = 'M0 0 L100 0'): MotionPathNodeV1 => Object.freeze({ ...nodeBase(id, id, parentId), type: 'path', pathData, fillColor: constant('transparent'), strokeColor: constant('#fff'), strokeWidth: constant(2), trimProgress: constant(1) })
const image = (id: string, parentId: string): MotionImageNodeV1 => Object.freeze({ ...nodeBase(id, id, parentId), type: 'image', source: 'asset://hero-a', width: constant(320), height: constant(180), fit: 'cover', imageOpacity: constant(1) })

const scene = (): MotionSceneV1 => createMotionScene({
  componentId: 'sanverse.authoring-test', componentVersion: 1, rootNodeId: 'root',
  nodes: Object.freeze({
    root: group('root', null, ['headline', 'chart', 'art', 'media']),
    headline: text('headline', 'root', '$29'),
    chart: group('chart', 'root', ['bar.a', 'bar.b', 'bar.c']),
    'bar.a': shape('bar.a', 'chart', 'rectangle', 90),
    'bar.b': shape('bar.b', 'chart', 'rectangle', 120),
    'bar.c': shape('bar.c', 'chart', 'rectangle', 150),
    art: path('art', 'root'),
    media: image('media', 'root'),
  }),
  semanticParts: Object.freeze([
    { id: 'hero.metric', label: 'Hero metric', role: 'value', nodeIds: Object.freeze(['headline']) },
    { id: 'chart.series', label: 'Chart series', role: 'content-group', nodeIds: Object.freeze(['chart', 'bar.a', 'bar.b', 'bar.c']) },
  ]),
  exposures: Object.freeze([]),
  layout: Object.freeze({ mode: 'responsive', ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }),
  supportedAspectRatios: Object.freeze(['16:9', '9:16']),
})

const expectOk = (result: ReturnType<typeof applyMotionOperation>) => {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error.message)
  expect(validateMotionScene(result.scene)).toMatchObject({ ok: true })
  return result
}

describe('general static Motion Graph authoring', () => {
  it('edits every approved static node property and records inverse operations', () => {
    const operations: readonly MotionGraphOperationV1[] = [
      { operationId: 'font', type: 'set-node-static-property', nodeId: 'headline', change: { property: 'text.fontFamily', value: 'Satoshi, sans-serif' } },
      { operationId: 'align', type: 'set-node-static-property', nodeId: 'headline', change: { property: 'text.textAlign', value: 'center' } },
      { operationId: 'shape', type: 'set-node-static-property', nodeId: 'bar.a', change: { property: 'shape.shape', value: 'ellipse' } },
      { operationId: 'path', type: 'set-node-static-property', nodeId: 'art', change: { property: 'path.pathData', value: 'M0 0 C20 40 80 40 100 0' } },
      { operationId: 'source', type: 'set-node-static-property', nodeId: 'media', change: { property: 'image.source', value: 'asset://hero-b' } },
      { operationId: 'fit', type: 'set-node-static-property', nodeId: 'media', change: { property: 'image.fit', value: 'contain' } },
    ]
    const applied = applyMotionOperations(scene(), operations)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.scene.nodes.headline).toMatchObject({ fontFamily: 'Satoshi, sans-serif', textAlign: 'center' })
    expect(applied.scene.nodes['bar.a']).toMatchObject({ shape: 'ellipse' })
    expect(applied.scene.nodes.art).toMatchObject({ pathData: 'M0 0 C20 40 80 40 100 0' })
    expect(applied.scene.nodes.media).toMatchObject({ source: 'asset://hero-b', fit: 'contain' })
    expect(applied.inverseOperations).not.toBeNull()
    const restored = applyMotionOperations(applied.scene, applied.inverseOperations ?? [])
    expect(restored).toMatchObject({ ok: true })
    if (restored.ok) expect(restored.scene).toEqual(scene())
  })

  it('refuses a static property on the wrong node type', () => {
    const result = applyMotionOperation(scene(), { operationId: 'bad', type: 'set-node-static-property', nodeId: 'headline', change: { property: 'shape.shape', value: 'ellipse' } })
    expect(result).toMatchObject({ ok: false, error: { code: 'PROPERTY_INVALID' } })
  })
})

describe('replace-node authoring', () => {
  it('turns a rectangle into an ellipse while preserving stable identity, parent, semantic membership and stack slot', () => {
    const before = scene()
    const parentBefore = (before.nodes.chart as MotionGroupNodeV1).childIds
    const result = expectOk(applyMotionOperation(before, { operationId: 'replace', type: 'replace-node', nodeId: 'bar.a', replacement: shape('bar.a', 'chart', 'ellipse', 90), identityPolicy: 'preserve-target-id' }))
    expect(result.scene.nodes['bar.a']).toMatchObject({ id: 'bar.a', parentId: 'chart', type: 'shape', shape: 'ellipse' })
    expect((result.scene.nodes.chart as MotionGroupNodeV1).childIds).toEqual(parentBefore)
    expect(result.scene.semanticParts.find((part) => part.id === 'chart.series')?.nodeIds).toContain('bar.a')
    const restored = applyMotionOperations(result.scene, result.inverseOperations ?? [])
    expect(restored.ok).toBe(true)
    if (restored.ok) expect(restored.scene).toEqual(before)
  })

  it('refuses replacement of a locked node and ambiguous populated-group replacement', () => {
    const locked = applyMotionOperation(scene(), { operationId: 'locked', type: 'replace-node', nodeId: 'bar.a', replacement: shape('bar.a', 'chart', 'ellipse'), identityPolicy: 'preserve-target-id' }, { authoringMetadata: createMotionAuthoringMetadata(['bar.a']) })
    expect(locked).toMatchObject({ ok: false, error: { code: 'LOCKED' } })
    const ambiguous = applyMotionOperation(scene(), { operationId: 'ambiguous', type: 'replace-node', nodeId: 'chart', replacement: group('chart', 'root', []), identityPolicy: 'preserve-target-id' })
    expect(ambiguous).toMatchObject({ ok: false, error: { code: 'GROUP_INVALID' } })
  })
})

describe('replace-subtree authoring', () => {
  const circles = () => Object.freeze({
    rootNodeId: 'chart',
    nodes: Object.freeze({
      chart: group('chart', 'root', ['bar.a', 'bar.b', 'bar.c']),
      'bar.a': shape('bar.a', 'chart', 'ellipse', 90),
      'bar.b': shape('bar.b', 'chart', 'ellipse', 120),
      'bar.c': shape('bar.c', 'chart', 'ellipse', 150),
    }),
  })

  it('replaces three bars with proportional circles atomically and is reversible', () => {
    const before = scene()
    const result = expectOk(applyMotionOperation(before, { operationId: 'circles', type: 'replace-subtree', rootNodeId: 'chart', replacement: circles() }))
    for (const id of ['bar.a', 'bar.b', 'bar.c']) expect(result.scene.nodes[id]).toMatchObject({ type: 'shape', shape: 'ellipse' })
    expect(result.scene.semanticParts.find((part) => part.id === 'chart.series')?.nodeIds).toEqual(['chart', 'bar.a', 'bar.b', 'bar.c'])
    const restored = applyMotionOperations(result.scene, result.inverseOperations ?? [])
    expect(restored.ok).toBe(true)
    if (restored.ok) expect(restored.scene).toEqual(before)
  })

  it('fails closed for broken child references, outside ID collisions, bad mappings and locked descendants', () => {
    const broken = circles()
    const brokenChart = Object.freeze({ ...(broken.nodes.chart as MotionGroupNodeV1), childIds: Object.freeze(['bar.a', 'missing']) })
    expect(applyMotionOperation(scene(), { operationId: 'broken', type: 'replace-subtree', rootNodeId: 'chart', replacement: { rootNodeId: 'chart', nodes: { ...broken.nodes, chart: brokenChart } } })).toMatchObject({ ok: false, error: { code: 'PARENT_INVALID' } })
    expect(applyMotionOperation(scene(), { operationId: 'collision', type: 'replace-subtree', rootNodeId: 'chart', replacement: { rootNodeId: 'chart', nodes: { ...broken.nodes, headline: text('headline', 'chart', 'bad') } } })).toMatchObject({ ok: false, error: { code: 'DUPLICATE_ID' } })
    expect(applyMotionOperation(scene(), { operationId: 'mapping', type: 'replace-subtree', rootNodeId: 'chart', replacement: circles(), semanticMapping: [{ previousNodeId: 'not-in-old', nextNodeId: 'bar.a' }] })).toMatchObject({ ok: false, error: { code: 'SEMANTIC_INVALID' } })
    expect(applyMotionOperation(scene(), { operationId: 'locked-subtree', type: 'replace-subtree', rootNodeId: 'chart', replacement: circles() }, { authoringMetadata: createMotionAuthoringMetadata(['bar.b']) })).toMatchObject({ ok: false, error: { code: 'LOCKED' } })
  })
})

describe('semantic and responsive-layout authoring', () => {
  it('authors semantic parts through typed reversible operations', () => {
    let current = scene()
    current = expectOk(applyMotionOperation(current, { operationId: 'add-part', type: 'add-semantic-part', part: { id: 'art.accent', label: 'Art accent', role: 'accent', nodeIds: ['art'] } })).scene
    current = expectOk(applyMotionOperation(current, { operationId: 'role', type: 'set-semantic-part-role', partId: 'art.accent', role: 'decoration' })).scene
    current = expectOk(applyMotionOperation(current, { operationId: 'member', type: 'add-node-to-semantic-part', partId: 'art.accent', nodeId: 'media' })).scene
    expect(current.semanticParts.find((part) => part.id === 'art.accent')).toMatchObject({ role: 'decoration', nodeIds: ['art', 'media'] })
  })

  it('switches layout ownership/mode and format overrides without a second layout system', () => {
    let current = scene()
    current = expectOk(applyMotionOperation(current, { operationId: 'manual', type: 'set-layout-mode', mode: 'manual' })).scene
    current = expectOk(applyMotionOperation(current, { operationId: 'owner', type: 'set-layout-owner', ownership: { target: { nodeId: 'headline', property: 'transform.positionX' }, owner: 'manual', reason: 'Owner-directed placement' } })).scene
    current = expectOk(applyMotionOperation(current, { operationId: 'override', type: 'set-format-override', override: { ratio: '9:16', target: { nodeId: 'headline', property: 'transform.positionX' }, value: 180 } })).scene
    expect(current.layout).toMatchObject({ mode: 'manual' })
    expect(current.layout.ownership).toHaveLength(1)
    expect(current.layout.formatOverrides).toHaveLength(1)
  })
})

describe('Storyboard-scale graph authoring budgets', () => {
  it('reports bounded complexity instead of truncating authored graphs', () => {
    expect(validateMotionAuthoringBudgetV1(scene())).toMatchObject({ ok: true, code: 'OK' })
    expect(validateMotionAuthoringBudgetV1(scene(), { maxNodes: 2, maxPathBytesPerNode: 131_072, maxEffectsPerNode: 32, maxMasksPerNode: 32, maxSerializedGraphBytes: 8 * 1024 * 1024 })).toMatchObject({ ok: false, code: 'AUTHORING_BUDGET_EXCEEDED' })
  })
})
