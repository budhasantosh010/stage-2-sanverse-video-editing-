import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MotionAspectRatio, MotionRenderContextV1 } from '@sanverse/motion-contract'
import { projectMotionCurves, projectMotionDopeSheet, projectMotionLayers, validateCompositorReadiness, validateMotionScene } from '@sanverse/motion-graph'
import { MotionComponentHost, MotionCompositionFrame } from '@sanverse/motion-native-runtime'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { MOTION_REFERENCE_COMPOSITIONS } from '../reference-compositions.ts'
import {
  CH1_APPROVED_STAGED_MODULES_BY_ID,
  ProgressiveChoiceStackModule,
  KineticPhraseModule,
  ExplainerBoardModule,
  MilestoneStageModule,
  FeatureMatrixModule,
  MediaCutawayModule,
  StatBurstModule,
  FloatingValueCloudModule,
  CtaPillModule,
} from './ch1-approved-components.tsx'

const modules = Object.freeze([
  ProgressiveChoiceStackModule,
  KineticPhraseModule,
  ExplainerBoardModule,
  MilestoneStageModule,
  FeatureMatrixModule,
  MediaCutawayModule,
  StatBurstModule,
  FloatingValueCloudModule,
  CtaPillModule,
])

const context = (ratio: MotionAspectRatio, durationTicks: number, progress: number, reducedMotion = false): MotionRenderContextV1 => ({
  localTicks: Math.round(durationTicks * progress),
  durationTicks,
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: MOTION_REFERENCE_COMPOSITIONS[ratio],
  reducedMotion,
})

const renderModule = (module: any, ratio: MotionAspectRatio, progress: number, reducedMotion = false): string => {
  const ctx=context(ratio,module.definition.defaultDurationTicks,progress,reducedMotion)
  return renderToStaticMarkup(<MotionCompositionFrame composition={ctx.composition}><MotionComponentHost module={module} props={module.defaultProps} style={module.defaultStyle} context={ctx} /></MotionCompositionFrame>)
}

describe('owner-approved CH1 Components 02–10 Sanverse productization',()=>{
  it('publishes nine distinct staged modules without duplicate IDs',()=>{
    expect(modules).toHaveLength(9)
    expect(Object.keys(CH1_APPROVED_STAGED_MODULES_BY_ID)).toHaveLength(9)
    expect(new Set(modules.map(module=>module.definition.id)).size).toBe(9)
    expect(modules.map(module=>module.definition.id)).toEqual([
      'sanverse.progressive-choice-stack','sanverse.kinetic-phrase','sanverse.explainer-board','sanverse.milestone-stage','sanverse.feature-matrix','sanverse.media-cutaway','sanverse.stat-burst','sanverse.floating-value-cloud','sanverse.cta-pill',
    ])
  })

  it('creates valid compositor-ready scenes with C3/C4/C5 authority for every component and ratio',()=>{
    for(const module of modules) for(const ratio of ['16:9','9:16','1:1','4:5'] as const){
      const ctx=context(ratio,module.definition.defaultDurationTicks,.58)
      const scene=module.createScene(module.defaultProps as never,module.defaultStyle as never,ctx)
      expect(validateMotionScene(scene),`${module.definition.id} ${ratio}`).toMatchObject({ok:true})
      expect(validateCompositorReadiness(scene).ready,`${module.definition.id} ${ratio}`).toBe(true)
      const layers=projectMotionLayers({scene})
      expect(layers.preorderNodeIds.length,`${module.definition.id} ${ratio} layers`).toBeGreaterThanOrEqual(4)
      const timeline=projectMotionDopeSheet(scene)
      expect(timeline.totalKeyframes,`${module.definition.id} ${ratio} keys`).toBeGreaterThanOrEqual(4)
      const curves=projectMotionCurves(scene)
      expect(curves.tracks.some(track=>track.editable),`${module.definition.id} ${ratio} editable curves`).toBe(true)
      expect(scene.exposures.some(exposure=>exposure.level==='creator')).toBe(true)
      expect(scene.exposures.some(exposure=>exposure.level==='designer')).toBe(true)
      expect(scene.exposures.some(exposure=>exposure.level==='advanced')).toBe(true)
    }
  })

  it('is deterministic under repeated/random/backward direct seeks',()=>{
    for(const module of modules){
      const before=renderModule(module,'9:16',.33)
      renderModule(module,'9:16',.91)
      renderModule(module,'9:16',.04)
      expect(renderModule(module,'9:16',.33),module.definition.id).toBe(before)
    }
  })

  it('renders approved semantic roots at canonical poster time in every ratio and reduced motion',()=>{
    for(const module of modules) for(const ratio of ['16:9','9:16','1:1','4:5'] as const){
      const markup=renderModule(module,ratio,.58)
      expect(markup).toContain(`data-motion-component-id="${module.definition.id}"`)
      expect(markup).toContain('data-semantic-id="component.background"')
      expect(markup).toContain('data-semantic-id=')
      const reduced=renderModule(module,ratio,.58,true)
      expect(reduced).toContain(`data-motion-component-id="${module.definition.id}"`)
    }
  })
})
