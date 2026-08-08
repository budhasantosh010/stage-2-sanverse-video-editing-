import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MotionGraphBackedComponentModuleV1, MotionShapeNodeV1 } from '@sanverse/motion-graph'
import { constant, createMotionScene, nodeBase } from '@sanverse/motion-graph'
import { MotionComponentHost, MotionCompositionFrame, MotionSafeArea, useResolvedMotionNode } from './index.tsx'

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
})
