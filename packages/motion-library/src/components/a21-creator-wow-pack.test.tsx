import { describe, expect, it } from 'vitest'
import { deriveTimelineTracks, evaluateScene, projectMotionCurves, projectMotionDopeSheet, projectMotionLayers, validateCompositorReadiness, validateMotionScene } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { RATIO_COMPOSITIONS, renderComponentMarkup } from '@sanverse/motion-testing'
import { A21_CREATOR_WOW_COMPONENT_IDS, FAMILY_COMPONENT_MODULES_BY_ID, familyComponentStyleFromPack } from './component-families.tsx'
import { INITIAL_MOTION_STYLE_PACKS } from '../style-packs.ts'

const ticks = (seconds: number) => Math.round(seconds * SANVERSE_TICKS_PER_SECOND)
const context = (seconds: number, progress: number, ratio: keyof typeof RATIO_COMPOSITIONS = '16:9', reducedMotion = false) => ({
  localTicks: Math.round(ticks(seconds) * progress),
  durationTicks: ticks(seconds),
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: RATIO_COMPOSITIONS[ratio],
  reducedMotion,
})
const modules = A21_CREATOR_WOW_COMPONENT_IDS.map((id) => FAMILY_COMPONENT_MODULES_BY_ID[id]!)

const semanticText = (scene: ReturnType<(typeof modules)[number]['createScene']>, c: ReturnType<typeof context>) => Object.values(evaluateScene(scene, c).nodes)
  .filter((node) => node.type === 'text')
  .map((node) => node.type === 'text' ? node.text : '')

describe('MOTION-A21 creator utility + advanced visual pack', () => {
  it('adds six distinct jobs after the 83-component audit instead of aliases for polls, roadmaps or browser callouts', () => {
    expect(modules).toHaveLength(6)
    expect(new Set(modules.map((module) => module.definition.id)).size).toBe(6)
    expect(A21_CREATOR_WOW_COMPONENT_IDS).not.toContain('sanverse.poll-vote-result')
    expect(A21_CREATOR_WOW_COMPONENT_IDS).not.toContain('sanverse.journey-map')
    expect(A21_CREATOR_WOW_COMPONENT_IDS).not.toContain('sanverse.browser-demo')
    expect(A21_CREATOR_WOW_COMPONENT_IDS).not.toContain('sanverse.cursor-callout')
    for (const module of modules) {
      expect(module.definition.minDurationTicks, module.definition.id).toBe(ticks(1))
      expect(module.definition.maxDurationTicks, module.definition.id).toBe(ticks(10))
      expect(module.definition.events.length, module.definition.id).toBeGreaterThanOrEqual(5)
      expect(module.definition.capabilities?.keyframeReady, module.definition.id).toBe(true)
    }
  })

  it('is graph-native and projects every new component through C3, C4 and editable C5 numeric curves', () => {
    for (const module of modules) {
      const c = context(4, 0)
      const scene = module.createScene(module.defaultProps, module.defaultStyle, c)
      expect(validateMotionScene(scene).ok, module.definition.id).toBe(true)
      expect(validateCompositorReadiness(scene).ready, module.definition.id).toBe(true)
      const keyed = deriveTimelineTracks(scene).filter((track) => track.animationKind === 'keyframes')
      expect(keyed.length, module.definition.id).toBeGreaterThanOrEqual(8)
      expect(projectMotionLayers({ scene, resolvedScene: evaluateScene(scene, c) }).layersById[scene.rootNodeId], module.definition.id).toBeDefined()
      expect(projectMotionDopeSheet(scene).totalKeyframes, module.definition.id).toBeGreaterThan(12)
      expect(projectMotionCurves(scene).tracks.filter((track) => track.editable).length, module.definition.id).toBeGreaterThanOrEqual(4)
    }
  })

  it.each([1, 1.5, 3, 5, 10])('is exact-seek deterministic at %ss', (seconds) => {
    for (const module of modules) {
      const scene = module.createScene(module.defaultProps, module.defaultStyle, context(seconds, 0))
      const expected = evaluateScene(scene, context(seconds, .57))
      evaluateScene(scene, context(seconds, .91))
      evaluateScene(scene, context(seconds, .11))
      evaluateScene(scene, context(seconds, .73))
      expect(evaluateScene(scene, context(seconds, .57)), module.definition.id).toEqual(expected)
    }
  })

  it('refuses durations outside the shared 1–10 second creator authoring window', () => {
    for (const module of modules) {
      expect(() => module.createScene(module.defaultProps, module.defaultStyle, context(.99, 0)), module.definition.id).toThrow(/duration is outside/)
      expect(() => module.createScene(module.defaultProps, module.defaultStyle, context(10.01, 0)), module.definition.id).toThrow(/duration is outside/)
    }
  })

  it('renders all six through all four ratios and all eight existing style packs', () => {
    for (const module of modules) for (const ratio of ['16:9', '9:16', '1:1', '4:5'] as const) for (const pack of INITIAL_MOTION_STYLE_PACKS) {
      const style = familyComponentStyleFromPack(pack)
      const c = context(4, .62, ratio)
      const scene = module.createScene(module.defaultProps, style, c)
      expect(validateCompositorReadiness(scene).ready, `${module.definition.id}:${ratio}:${pack.id}`).toBe(true)
      const markup = renderComponentMarkup(module, module.defaultProps, style, c)
      expect(markup, `${module.definition.id}:${ratio}:${pack.id}`).toContain(`data-motion-module-id=\"${module.definition.id}\"`)
    }
  })

  it('preserves semantic content in reduced motion while removing authored entrance keyframes', () => {
    for (const module of modules) {
      const normal = module.createScene(module.defaultProps, module.defaultStyle, context(4, 0, '9:16', false))
      const reduced = module.createScene(module.defaultProps, module.defaultStyle, context(4, 0, '9:16', true))
      expect(semanticText(reduced, context(4, 0, '9:16', true)), module.definition.id).toEqual(semanticText(normal, context(4, .62, '9:16', false)))
      expect(deriveTimelineTracks(reduced).filter((track) => track.animationKind === 'keyframes'), module.definition.id).toHaveLength(0)
      expect(projectMotionCurves(reduced).tracks.filter((track) => track.editable), module.definition.id).toHaveLength(0)
    }
  })

  it('survives maximum valid text density and fails closed beyond the shared content bounds', () => {
    const longTitle = 'T'.repeat(96)
    const longItem = 'I'.repeat(72)
    for (const module of modules) {
      const dense = { ...module.defaultProps, title: longTitle, subtitle: 'S'.repeat(140), value: 'V'.repeat(48), items: Array.from({ length: 6 }, () => longItem) }
      expect(module.validateProps(dense).ok, module.definition.id).toBe(true)
      expect(() => module.createScene(dense, module.defaultStyle, context(4, .6, '9:16')), module.definition.id).not.toThrow()
      expect(renderComponentMarkup(module, dense, module.defaultStyle, context(4, .6, '9:16')), module.definition.id).toContain(longTitle)
      expect(module.validateProps({ ...module.defaultProps, title: 'X'.repeat(97) }).ok, module.definition.id).toBe(false)
      expect(module.validateProps({ ...module.defaultProps, items: ['X'.repeat(73)] }).ok, module.definition.id).toBe(false)
    }
  })

  it('keeps original/generic fixtures free of copied commercial brands and publishes useful semantic events', () => {
    const serialized = JSON.stringify(modules.map((module) => module.defaultProps)).toLowerCase()
    for (const brand of ['apple', 'google', 'microsoft', 'notion', 'slack', 'figma']) expect(serialized).not.toContain(brand)
    const events = new Set(modules.flatMap((module) => module.definition.events.map((event) => event.name)))
    for (const required of ['trend-revealed', 'breakdown-ready', 'intersection', 'comparison-ready', 'diff-ready', 'success']) expect(events.has(required), required).toBe(true)
  })
})
