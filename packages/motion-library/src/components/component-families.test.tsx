import { describe, expect, it } from 'vitest'
import { evaluateScene, validateCompositorReadiness, validateMotionScene } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { RATIO_COMPOSITIONS, renderComponentMarkup, validateDefinition, validateFixture } from '@sanverse/motion-testing'
import { FAMILY_COMPONENT_MODULES, FAMILY_VARIANT_CONFIGS, familyComponentStyleFromPack } from './component-families.tsx'
import { CREATOR_ENERGETIC_STYLE, INITIAL_MOTION_STYLE_PACKS, SANVERSE_CLEAN_STYLE } from '../style-packs.ts'
import { FAMILY_COMPONENT_FIXTURES } from '../fixtures/component-families.ts'

const durationTicks = SANVERSE_TICKS_PER_SECOND * 4
const context = (localTicks: number, ratio: keyof typeof RATIO_COMPOSITIONS = '16:9', reducedMotion = false) => ({ localTicks, durationTicks, ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition: RATIO_COMPOSITIONS[ratio], reducedMotion })
const NEW_COMPONENT_IDS = Object.freeze([
  'sanverse.comment-highlight',
  'sanverse.client-proof-strip',
  'sanverse.social-proof-stack',
  'sanverse.myth-fact',
  'sanverse.problem-solution',
  'sanverse.source-citation',
  'sanverse.browser-demo',
  'sanverse.chat-thread',
  'sanverse.dashboard-snapshot',
  'sanverse.search-results',
  'sanverse.upload-status',
  'sanverse.cursor-callout',
] as const)

describe('horizontal family catalog', () => {
  it('contains 72 distinct complete family modules with the intended category distribution', () => {
    expect(FAMILY_COMPONENT_MODULES).toHaveLength(72)
    const ids = FAMILY_COMPONENT_MODULES.map((module) => module.definition.id)
    expect(new Set(ids).size).toBe(72)
    const families = FAMILY_VARIANT_CONFIGS.reduce<Record<string, number>>((counts, config) => ({ ...counts, [config.family]: (counts[config.family] ?? 0) + 1 }), {})
    expect(families).toEqual({ title: 14, value: 11, list: 12, status: 8, diagram: 13, quote: 8, cta: 6 })
  })

  it('adds exactly the 12 selected uncovered communication scenarios without duplicate IDs', () => {
    const ids = new Set(FAMILY_COMPONENT_MODULES.map((module) => module.definition.id))
    for (const id of NEW_COMPONENT_IDS) expect(ids.has(id), id).toBe(true)
    expect(NEW_COMPONENT_IDS).toHaveLength(12)
  })

  it('validates every definition, default props and default style', () => {
    for (const module of FAMILY_COMPONENT_MODULES) {
      expect(validateDefinition(module.definition), module.definition.id).toEqual([])
      expect(module.validateProps(module.defaultProps).ok, module.definition.id).toBe(true)
      expect(module.validateStyle(module.defaultStyle).ok, module.definition.id).toBe(true)
    }
  })

  it('publishes one stable first-class fixture per horizontal module', () => {
    expect(FAMILY_COMPONENT_FIXTURES).toHaveLength(72)
    expect(new Set(FAMILY_COMPONENT_FIXTURES.map((fixture) => fixture.componentId)).size).toBe(72)
    for (const fixture of FAMILY_COMPONENT_FIXTURES) expect(validateFixture(fixture), fixture.id).toEqual([])
  })

  it('refuses over-limit content instead of silently clipping it', () => {
    const module = FAMILY_COMPONENT_MODULES[0]!
    expect(module.validateProps({ ...module.defaultProps, title: 'X'.repeat(97) }).ok).toBe(false)
    expect(module.validateProps({ ...module.defaultProps, items: Array.from({ length: 7 }, (_, index) => `Item ${index + 1}`) }).ok).toBe(false)
  })

  it.each(['16:9', '9:16', '1:1', '4:5'] as const)('renders every module at %s without a component-specific runtime', (ratio) => {
    for (const module of FAMILY_COMPONENT_MODULES) {
      const markup = renderComponentMarkup(module, module.defaultProps, module.defaultStyle, context(Math.round(durationTicks * 0.56), ratio))
      expect(markup, `${module.definition.id} ${ratio}`).toContain('data-motion-root="family-component"')
      expect(markup, `${module.definition.id} ${ratio}`).toContain(`data-motion-module-id="${module.definition.id}"`)
    }
  })

  it('creates compositor-ready serializable graph scenes for every module and ratio', () => {
    for (const module of FAMILY_COMPONENT_MODULES) for (const ratio of ['16:9', '9:16', '1:1', '4:5'] as const) {
      const scene = module.createScene(module.defaultProps, module.defaultStyle, context(0, ratio))
      expect(validateMotionScene(scene).ok, `${module.definition.id} ${ratio}`).toBe(true)
      expect(validateCompositorReadiness(scene).ready, `${module.definition.id} ${ratio}`).toBe(true)
      const parsed = JSON.parse(JSON.stringify(scene))
      expect(parsed.componentId).toBe(module.definition.id)
    }
  })

  it('is exact-tick deterministic under repeated backward/random seeks for every module', () => {
    const ticks = [0, Math.round(durationTicks * .18), Math.round(durationTicks * .56), Math.round(durationTicks * .91), Math.round(durationTicks * .23), Math.round(durationTicks * .56)]
    for (const module of FAMILY_COMPONENT_MODULES) {
      const scene = module.createScene(module.defaultProps, module.defaultStyle, context(0))
      const resolved = ticks.map((tick) => evaluateScene(scene, context(tick)))
      expect(resolved[2], module.definition.id).toEqual(resolved[5])
    }
  })

  it('evaluates every graph in reduced motion without changing semantic text', () => {
    for (const module of FAMILY_COMPONENT_MODULES) {
      const scene = module.createScene(module.defaultProps, module.defaultStyle, context(0, '9:16', true))
      const normal = evaluateScene(scene, context(Math.round(durationTicks * .18), '9:16', false))
      const reduced = evaluateScene(scene, context(Math.round(durationTicks * .18), '9:16', true))
      const normalText = Object.values(normal.nodes).filter((node) => node.type === 'text').map((node) => node.type === 'text' ? node.text : '')
      const reducedText = Object.values(reduced.nodes).filter((node) => node.type === 'text').map((node) => node.type === 'text' ? node.text : '')
      expect(reducedText, module.definition.id).toEqual(normalText)
    }
  })

  it('renders every new component through all eight shared style packs without module duplication', () => {
    const modules = FAMILY_COMPONENT_MODULES.filter((module) => NEW_COMPONENT_IDS.includes(module.definition.id as (typeof NEW_COMPONENT_IDS)[number]))
    expect(modules).toHaveLength(12)
    for (const module of modules) for (const pack of INITIAL_MOTION_STYLE_PACKS) {
      const style = familyComponentStyleFromPack(pack)
      expect(module.validateStyle(style).ok, `${module.definition.id} ${pack.id}`).toBe(true)
      const markup = renderComponentMarkup(module, module.defaultProps, style, context(Math.round(durationTicks * .56), '4:5'))
      expect(markup, `${module.definition.id} ${pack.id}`).toContain(`data-motion-module-id="${module.definition.id}"`)
      const scene = module.createScene(module.defaultProps, style, context(Math.round(durationTicks * .56), '4:5'))
      expect(validateCompositorReadiness(scene).ready, `${module.definition.id} ${pack.id}`).toBe(true)
    }
  })

  it('shares style packs instead of duplicating component modules', () => {
    const clean = familyComponentStyleFromPack(SANVERSE_CLEAN_STYLE)
    const energetic = familyComponentStyleFromPack(CREATOR_ENERGETIC_STYLE)
    expect(clean.accentColor).not.toBe(energetic.accentColor)
    expect(clean.motionIntensity).toBeLessThan(energetic.motionIntensity)
    expect(FAMILY_COMPONENT_MODULES.every((module) => module.defaultStyle === FAMILY_COMPONENT_MODULES[0]!.defaultStyle)).toBe(true)
  })
})
