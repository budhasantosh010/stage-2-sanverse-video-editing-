import { describe, expect, it } from 'vitest'
import { deriveTimelineTracks, evaluateScene, projectMotionDopeSheet, projectMotionLayers, validateCompositorReadiness, validateMotionScene } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { RATIO_COMPOSITIONS, renderComponentMarkup } from '@sanverse/motion-testing'
import { A20_PRODUCT_STORY_COMPONENT_IDS, FAMILY_COMPONENT_MODULES_BY_ID, FAMILY_PLACEMENT_INTENTS, familyComponentStyleFromPack } from './component-families.tsx'
import { INITIAL_MOTION_STYLE_PACKS } from '../style-packs.ts'

const durationTicks = (seconds: number) => Math.round(seconds * SANVERSE_TICKS_PER_SECOND)
const context = (seconds: number, progress: number, ratio: keyof typeof RATIO_COMPOSITIONS = '16:9', reducedMotion = false) => ({
  localTicks: Math.round(durationTicks(seconds) * progress),
  durationTicks: durationTicks(seconds),
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: RATIO_COMPOSITIONS[ratio],
  reducedMotion,
})
const modules = A20_PRODUCT_STORY_COMPONENT_IDS.map((id) => FAMILY_COMPONENT_MODULES_BY_ID[id]!)

const semanticText = (scene: ReturnType<(typeof modules)[number]['createScene']>, c: ReturnType<typeof context>) => Object.values(evaluateScene(scene, c).nodes)
  .filter((node) => node.type === 'text')
  .map((node) => node.type === 'text' ? node.text : '')

describe('MOTION-A20 product storytelling pack', () => {
  it('adds six distinct product-story components without duplicating existing headline/browser/lower-third jobs', () => {
    expect(modules).toHaveLength(6)
    expect(new Set(modules.map((module) => module.definition.id)).size).toBe(6)
    expect(A20_PRODUCT_STORY_COMPONENT_IDS).not.toContain('sanverse.kinetic-headline')
    expect(A20_PRODUCT_STORY_COMPONENT_IDS).not.toContain('sanverse.browser-demo')
    expect(A20_PRODUCT_STORY_COMPONENT_IDS).not.toContain('sanverse.lower-third-title')
    for (const module of modules) {
      expect(module.definition.minDurationTicks).toBe(durationTicks(1.5))
      expect(module.definition.maxDurationTicks).toBe(durationTicks(12))
      expect(module.definition.events.length).toBeGreaterThanOrEqual(5)
      expect(module.definition.capabilities?.keyframeReady).toBe(true)
      expect(module.defaultProps.placement).toBeTruthy()
      expect(module.defaultProps.safeOffset).toBeGreaterThanOrEqual(0)
    }
  })

  it('creates real C2 keyframe tracks that project through C3 Layers and C4 dope sheet', () => {
    for (const module of modules) {
      const c = context(5, 0)
      const scene = module.createScene(module.defaultProps, module.defaultStyle, c)
      expect(validateMotionScene(scene).ok, module.definition.id).toBe(true)
      expect(validateCompositorReadiness(scene).ready, module.definition.id).toBe(true)
      const tracks = deriveTimelineTracks(scene).filter((track) => track.animationKind === 'keyframes')
      expect(tracks.length, module.definition.id).toBeGreaterThanOrEqual(8)
      const layers = projectMotionLayers({ scene, resolvedScene: evaluateScene(scene, c) })
      const dopeSheet = projectMotionDopeSheet(scene)
      expect(layers.layersById[scene.rootNodeId], module.definition.id).toBeDefined()
      expect(dopeSheet.totalTracks, module.definition.id).toBe(tracks.length)
      expect(dopeSheet.totalKeyframes, module.definition.id).toBeGreaterThan(12)
    }
  })

  it.each([1.5, 2.5, 5, 10, 12])('is exact-seek deterministic at %ss', (seconds) => {
    for (const module of modules) {
      const scene = module.createScene(module.defaultProps, module.defaultStyle, context(seconds, 0))
      const expected = evaluateScene(scene, context(seconds, .57))
      evaluateScene(scene, context(seconds, .91))
      evaluateScene(scene, context(seconds, .12))
      evaluateScene(scene, context(seconds, .74))
      expect(evaluateScene(scene, context(seconds, .57)), module.definition.id).toEqual(expected)
    }
  })

  it('refuses durations outside the declared 1.5–12 second window', () => {
    for (const module of modules) {
      expect(() => module.createScene(module.defaultProps, module.defaultStyle, context(1.49, 0)), module.definition.id).toThrow(/duration is outside/)
      expect(() => module.createScene(module.defaultProps, module.defaultStyle, context(12.01, 0)), module.definition.id).toThrow(/duration is outside/)
    }
  })

  it('supports all semantic safe placements with bounded insets', () => {
    for (const module of modules) for (const placement of FAMILY_PLACEMENT_INTENTS) {
      const props = { ...module.defaultProps, placement, safeOffset: 84 }
      expect(module.validateProps(props).ok, `${module.definition.id}:${placement}`).toBe(true)
      expect(renderComponentMarkup(module, props, module.defaultStyle, context(5, .62)), `${module.definition.id}:${placement}`).toContain(`data-motion-module-id="${module.definition.id}"`)
    }
    for (const module of modules) {
      expect(module.validateProps({ ...module.defaultProps, placement: 'off-screen' }).ok, module.definition.id).toBe(false)
      expect(module.validateProps({ ...module.defaultProps, safeOffset: 241 }).ok, module.definition.id).toBe(false)
    }
  })

  it('renders every A20 component at all four ratios through all eight existing style packs', () => {
    for (const module of modules) for (const ratio of ['16:9', '9:16', '1:1', '4:5'] as const) for (const pack of INITIAL_MOTION_STYLE_PACKS) {
      const style = familyComponentStyleFromPack(pack)
      const c = context(5, .62, ratio)
      const scene = module.createScene(module.defaultProps, style, c)
      expect(validateCompositorReadiness(scene).ready, `${module.definition.id}:${ratio}:${pack.id}`).toBe(true)
      const markup = renderComponentMarkup(module, module.defaultProps, style, c)
      expect(markup, `${module.definition.id}:${ratio}:${pack.id}`).toContain(`data-motion-variant=`)
    }
  })

  it('reduced motion preserves semantic content while replacing authored entrance transforms with final constants', () => {
    for (const module of modules) {
      const normalScene = module.createScene(module.defaultProps, module.defaultStyle, context(5, 0, '9:16', false))
      const reducedScene = module.createScene(module.defaultProps, module.defaultStyle, context(5, 0, '9:16', true))
      expect(semanticText(reducedScene, context(5, 0, '9:16', true)), module.definition.id).toEqual(semanticText(normalScene, context(5, .62, '9:16', false)))
      const reducedTracks = deriveTimelineTracks(reducedScene).filter((track) => track.animationKind === 'keyframes')
      expect(reducedTracks, module.definition.id).toHaveLength(0)
    }
  })

  it('publishes product-story motion events that Plan B can align to transcript moments', () => {
    const eventNames = new Set(modules.flatMap((module) => module.definition.events.map((event) => event.name)))
    for (const required of ['message-1', 'composer-open', 'window-open', 'agent-working', 'comparison-ready', 'brand-lockup']) expect(eventNames.has(required), required).toBe(true)
  })
})
