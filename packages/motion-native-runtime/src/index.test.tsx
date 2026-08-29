import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MotionGraphBackedComponentModuleV1, MotionShapeNodeV1 } from '@sanverse/motion-graph'
import { applyMotionOperation, constant, createDefaultMask, createMotionScene, evaluateScene, nodeBase } from '@sanverse/motion-graph'
import { mergeMotionGraphNodeStyle, MotionComponentHost, MotionCompositionFrame, MotionSafeArea, useResolvedMotionNode } from './index.tsx'

const composition = { width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 } as const
const context = { localTicks: 720_000, durationTicks: 2_880_000, ticksPerSecond: 1_440_000, composition, reducedMotion: false } as const

const probeModule: MotionGraphBackedComponentModuleV1<Record<string, never>, Record<string, never>> = {
  definition: {
    id: 'sanverse.runtime-operation-probe',
    version: 1,
    name: 'Runtime Operation Probe',
    purpose: 'Prove universal graph operations reach the native host presentation context.',
    category: 'ui',
    performanceClass: 'light',
    supportedAspectRatios: ['16:9'],
    minDurationTicks: 1,
    defaultDurationTicks: 2_880_000,
    maxDurationTicks: 5_760_000,
    events: [],
    contentLimits: [],
  },
  defaultProps: {},
  defaultStyle: {},
  validateProps: () => ({ ok: true, value: {} }),
  validateStyle: () => ({ ok: true, value: {} }),
  Component: () => {
    const node = useResolvedMotionNode('probe-shape')
    return <span data-probe-opacity={node?.opacity ?? 'missing'}>probe</span>
  },
  createScene: () => {
    const root = { ...nodeBase('probe-root', 'Probe Root', null), type: 'group' as const, childIds: ['probe-shape'] as const }
    const shape: MotionShapeNodeV1 = {
      ...nodeBase('probe-shape', 'Probe Shape', 'probe-root'),
      type: 'shape',
      shape: 'rectangle',
      width: constant(400),
      height: constant(200),
      fillColor: constant('#ffffff'),
      strokeColor: constant('#000000'),
      strokeWidth: constant(0),
      radius: constant(0),
    }
    return createMotionScene({
      componentId: 'sanverse.runtime-operation-probe',
      componentVersion: 1,
      rootNodeId: 'probe-root',
      nodes: { 'probe-root': root, 'probe-shape': shape },
      semanticParts: [{ id: 'shape', label: 'Shape', role: 'surface', nodeIds: ['probe-shape'] }],
      exposures: [],
      layout: { mode: 'responsive', ownership: [], formatOverrides: [] },
      supportedAspectRatios: ['16:9'],
    })
  },
}

describe('native runtime', () => {
  it('keeps composition dimensions authoritative while scaling only display', () => {
    const markup = renderToStaticMarkup(<MotionCompositionFrame composition={composition} displayScale={0.5}><span>hello</span></MotionCompositionFrame>)
    expect(markup).toContain('width:960px')
    expect(markup).toContain('height:540px')
    expect(markup).toContain('width:1920px')
    expect(markup).toContain('height:1080px')
    expect(markup).toContain('scale(0.5)')
  })

  it('derives safe area from composition dimensions', () => {
    const markup = renderToStaticMarkup(<MotionSafeArea composition={composition} insetRatio={0.1} />)
    expect(markup).toContain('left:192px')
    expect(markup).toContain('top:108px')
  })

  it('applies universal graph operations before resolving the component presentation context', () => {
    const markup = renderToStaticMarkup(
      <MotionComponentHost
        module={probeModule}
        props={{}}
        style={{}}
        context={context}
        graphOperations={[{ operationId: 'runtime:set-opacity', type: 'set-property', target: { nodeId: 'probe-shape', property: 'opacity' }, value: constant(0.25) }]}
      />,
    )
    expect(markup).toContain('data-motion-graph-backed="true"')
    expect(markup).toContain('data-probe-opacity="0.25"')
  })

  it('renders an approved scene override as the graph authority instead of regenerating candidate graph state', () => {
    const scene = probeModule.createScene({}, {}, context)
    const changed = applyMotionOperation(scene, { operationId: 'approved-opacity', type: 'set-property', target: { nodeId: 'probe-shape', property: 'opacity' }, value: constant(0.42) })
    expect(changed.ok).toBe(true)
    if (!changed.ok) return
    const markup = renderToStaticMarkup(
      <MotionComponentHost module={probeModule} props={{}} style={{}} context={context} sceneOverride={changed.scene} />,
    )
    expect(markup).toContain('data-probe-opacity="0.42"')
  })

  it('refuses a scene override from a different component identity rather than silently rendering the wrong module', () => {
    const scene = probeModule.createScene({}, {}, context)
    const mismatched = { ...scene, componentId: 'sanverse.other-component' }
    expect(() => renderToStaticMarkup(<MotionComponentHost module={probeModule} props={{}} style={{}} context={context} sceneOverride={mismatched} />)).toThrow(/does not match/u)
  })

  it('renders graph-native perspective even when it is the only transform', () => {
    const matrix = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,32,18,0,1)'
    const scene = probeModule.createScene({}, {}, context)
    const changed = applyMotionOperation(scene, { operationId:'perspective-only', type:'set-property', target:{ nodeId:'probe-shape', property:'transform.perspectiveMatrix3d' }, value:constant(matrix) })
    expect(changed.ok).toBe(true)
    if (!changed.ok) return
    const resolved = evaluateScene(changed.scene, context)
    expect(mergeMotionGraphNodeStyle({}, resolved.nodes['probe-shape']!).transform).toContain(matrix)
  })

  it('emits a valid luminance SVG mask for browser compositing', () => {
    const scene = probeModule.createScene({}, {}, context)
    const changed = applyMotionOperation(scene, { operationId:'mask-hole', type:'add-mask', nodeId:'probe-shape', mask:{...createDefaultMask('mask-hole','rounded-rectangle'),invert:true} })
    expect(changed.ok).toBe(true)
    if (!changed.ok) return
    const resolved = evaluateScene(changed.scene, context)
    const style = mergeMotionGraphNodeStyle({ background:'#fff' }, resolved.nodes['probe-shape']!)
    expect(style.maskMode).toBe('luminance')
    const decoded = decodeURIComponent(String(style.maskImage))
    expect(decoded).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(decoded).not.toContain('&lt;svg')
  })

  it('maps graph sibling order to rendered stacking for positioned visual nodes', () => {
    const first = { ...nodeBase('first', 'Red', 'root'), type: 'shape' as const, shape: 'rectangle' as const, width: constant(200), height: constant(200), fillColor: constant('#ff0000'), strokeColor: constant('transparent'), strokeWidth: constant(0), radius: constant(0) }
    const second = { ...nodeBase('second', 'Blue', 'root'), type: 'shape' as const, shape: 'rectangle' as const, width: constant(200), height: constant(200), fillColor: constant('#0000ff'), strokeColor: constant('transparent'), strokeWidth: constant(0), radius: constant(0) }
    const root = { ...nodeBase('root', 'Root', null), type: 'group' as const, childIds: ['first', 'second'] as const }
    const scene = createMotionScene({ componentId:'sanverse.z-order-proof', componentVersion:1, rootNodeId:'root', nodes:{root,first,second}, semanticParts:[{id:'shapes',label:'Shapes',role:'content-group',nodeIds:['first','second']}], exposures:[], layout:{mode:'responsive',ownership:[],formatOverrides:[]}, supportedAspectRatios:['16:9'] })
    const before = evaluateScene(scene, context)
    expect(mergeMotionGraphNodeStyle({ position:'absolute' }, before.nodes.first!).zIndex).toBeUndefined()
    expect(mergeMotionGraphNodeStyle({ position:'absolute' }, before.nodes.second!).zIndex).toBe(1)
    const reordered = applyMotionOperation(scene, { operationId:'reorder-blue', type:'reorder-node', nodeId:'second', index:0 })
    expect(reordered.ok).toBe(true)
    if (!reordered.ok) return
    const after = evaluateScene(reordered.scene, context)
    expect(mergeMotionGraphNodeStyle({ position:'absolute' }, after.nodes.second!).zIndex).toBeUndefined()
    expect(mergeMotionGraphNodeStyle({ position:'absolute' }, after.nodes.first!).zIndex).toBe(1)
  })
})
