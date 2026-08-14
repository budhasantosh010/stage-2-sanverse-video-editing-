import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MotionAspectRatio, MotionRenderContextV1 } from '@sanverse/motion-contract'
import { evaluateScene, projectMotionCurves, projectMotionDopeSheet, projectMotionLayers, validateCompositorReadiness, validateMotionScene } from '@sanverse/motion-graph'
import { MotionComponentHost, MotionCompositionFrame } from '@sanverse/motion-native-runtime'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { MOTION_REFERENCE_COMPOSITIONS } from '../reference-compositions.ts'
import { DEFAULT_FROSTED_ICON_RAIL_PROPS, DEFAULT_FROSTED_ICON_RAIL_STYLE, FROSTED_ICON_RAIL_AI_EDIT_PLAN, FrostedIconRailModule, createFrostedIconRailScene, evaluateFrostedIconRailState, layoutFrostedIconRail } from './frosted-icon-rail.tsx'

const context = (ratio: MotionAspectRatio, progress: number, reducedMotion = false): MotionRenderContextV1 => ({
  localTicks: Math.round(SANVERSE_TICKS_PER_SECOND * progress),
  durationTicks: SANVERSE_TICKS_PER_SECOND,
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: MOTION_REFERENCE_COMPOSITIONS[ratio],
  reducedMotion,
})

const render = (ratio: MotionAspectRatio, progress: number, reducedMotion = false): string => {
  const ctx = context(ratio, progress, reducedMotion)
  return renderToStaticMarkup(<MotionCompositionFrame composition={ctx.composition}><MotionComponentHost module={FrostedIconRailModule} props={DEFAULT_FROSTED_ICON_RAIL_PROPS} style={DEFAULT_FROSTED_ICON_RAIL_STYLE} context={ctx} /></MotionCompositionFrame>)
}

describe('owner-approved CH1 Frosted Icon Rail productization', () => {
  it('preserves the approved identity/defaults without entering the public catalog automatically', () => {
    expect(FrostedIconRailModule.definition.id).toBe('sanverse.icon-rail')
    expect(FrostedIconRailModule.definition.version).toBe(1)
    expect(DEFAULT_FROSTED_ICON_RAIL_PROPS).toEqual({ labels:['A','B','C'], glyphs:['◆','✦','∞'], direction:'horizontal' })
    expect(DEFAULT_FROSTED_ICON_RAIL_STYLE).toMatchObject({ positionPreset:'top-safe', scale:.92, accentColor:'#275EFE', surfaceColor:'#FFFFFF', radius:24, padding:20, spacing:12, blur:14, entranceStyle:'rise-soft', exitStyle:'fade-drop', motionIntensity:.72, stagger:.55 })
  })

  it('materializes valid semantic graph structure with C3/C4/C5 projections', () => {
    const scene = createFrostedIconRailScene(DEFAULT_FROSTED_ICON_RAIL_PROPS, DEFAULT_FROSTED_ICON_RAIL_STYLE, context('9:16', .42))
    expect(validateMotionScene(scene).ok).toBe(true)
    expect(validateCompositorReadiness(scene).ready).toBe(true)
    const layers = projectMotionLayers({ scene })
    expect(layers.layersById['rail.root']?.nodeName).toBe('Icon Rail')
    expect(layers.layersById['rail.item:0']?.parentNodeId).toBe('rail.items')
    const timeline = projectMotionDopeSheet(scene)
    expect(timeline.totalKeyframes).toBeGreaterThan(10)
    const curves = projectMotionCurves(scene)
    expect(curves.tracks.some((track) => track.nodeId === 'rail.root' && track.editable)).toBe(true)
    expect(curves.tracks.some((track) => track.nodeId === 'rail.item:0' && track.editable)).toBe(true)
    expect(curves.tracks.some((track) => track.nodeId === 'rail.item:0' && track.animationKind === 'motion' && !track.editable)).toBe(true)
  })

  it('makes the Motion Graph evaluate to the exact approved CH1 timing state at direct/random/backward seeks', () => {
    for (const progress of [0,.02,.08,.18,.33,.58,.84,.90,1]) {
      const ctx=context('9:16',progress)
      const expected=evaluateFrostedIconRailState(DEFAULT_FROSTED_ICON_RAIL_PROPS,DEFAULT_FROSTED_ICON_RAIL_STYLE,ctx)
      const scene=createFrostedIconRailScene(DEFAULT_FROSTED_ICON_RAIL_PROPS,DEFAULT_FROSTED_ICON_RAIL_STYLE,ctx)
      const resolved=evaluateScene(scene,ctx)
      const root=resolved.nodes['rail.root']!
      expect(root.opacity).toBeCloseTo(expected.opacity,8)
      expect(root.transform.positionX).toBeCloseTo(expected.positionX,8)
      expect(root.transform.positionY).toBeCloseTo(expected.positionY,8)
      expect(root.transform.scaleX).toBeCloseTo(expected.scale,8)
      expect(root.transform.scaleY).toBeCloseTo(expected.scale,8)
      expected.items.forEach((item,index)=>{
        const resolvedItem=resolved.nodes[`rail.item:${index}`]!
        expect(resolvedItem.opacity).toBeCloseTo(item.opacity,8)
        expect(resolvedItem.transform.positionY).toBeCloseTo(item.translateY,8)
        expect(resolvedItem.transform.scaleX).toBeCloseTo(item.scale,8)
      })
    }
    const a=render('9:16',.33)
    render('9:16',.91)
    render('9:16',.04)
    expect(render('9:16',.33)).toBe(a)
  })

  it('retains approved relative geometry across all four canonical ratios and reduced motion', () => {
    for (const ratio of ['16:9','9:16','1:1','4:5'] as const) {
      const ctx=context(ratio,.58)
      const layout=layoutFrostedIconRail(DEFAULT_FROSTED_ICON_RAIL_PROPS,DEFAULT_FROSTED_ICON_RAIL_STYLE,ctx)
      expect(layout.railWidth).toBeLessThan(ctx.composition.width)
      expect(layout.railHeight).toBeLessThan(ctx.composition.height)
      const markup=render(ratio,.58)
      expect(markup).toContain('data-motion-root="frosted-icon-rail"')
      expect(markup).toContain('data-semantic-id="rail.icon:2"')
    }
    const reduced=context('9:16',.58,true)
    const state=evaluateFrostedIconRailState(DEFAULT_FROSTED_ICON_RAIL_PROPS,DEFAULT_FROSTED_ICON_RAIL_STYLE,reduced)
    expect(state.items.every((item)=>item.translateY===0 && item.scale===1)).toBe(true)
  })

  it('exposes realistic AI/edit intents through typed creator/designer/advanced graph controls', () => {
    const scene=createFrostedIconRailScene(DEFAULT_FROSTED_ICON_RAIL_PROPS,DEFAULT_FROSTED_ICON_RAIL_STYLE,context('9:16',.5))
    const exposureIds=new Set(scene.exposures.map((exposure)=>exposure.id))
    expect(FROSTED_ICON_RAIL_AI_EDIT_PLAN.length).toBeGreaterThanOrEqual(6)
    for(const edit of FROSTED_ICON_RAIL_AI_EDIT_PLAN) expect(exposureIds.has(edit.exposureId)).toBe(true)
    expect(scene.exposures.some((exposure)=>exposure.level==='creator')).toBe(true)
    expect(scene.exposures.some((exposure)=>exposure.level==='designer')).toBe(true)
    expect(scene.exposures.some((exposure)=>exposure.level==='advanced')).toBe(true)
  })
})
