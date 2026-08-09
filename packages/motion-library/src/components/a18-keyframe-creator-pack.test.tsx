import { describe, expect, it } from 'vitest'
import { deriveTimelineTracks, evaluateScene, validateCompositorReadiness, validateMotionScene } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { RATIO_COMPOSITIONS, renderComponentMarkup } from '@sanverse/motion-testing'
import { A18_KEYFRAME_CREATOR_COMPONENT_IDS, FAMILY_COMPONENT_MODULES_BY_ID, familyComponentStyleFromPack } from './component-families.tsx'
import { INITIAL_MOTION_STYLE_PACKS } from '../style-packs.ts'

const durations = [.75, 1, 1.5, 2, 3, 5] as const
const durationTicks = (seconds: number) => Math.round(seconds * SANVERSE_TICKS_PER_SECOND)
const context = (seconds: number, localProgress: number, ratio: keyof typeof RATIO_COMPOSITIONS = '16:9', reducedMotion = false) => ({
  localTicks: Math.round(durationTicks(seconds) * localProgress),
  durationTicks: durationTicks(seconds),
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: RATIO_COMPOSITIONS[ratio],
  reducedMotion,
})
const modules = A18_KEYFRAME_CREATOR_COMPONENT_IDS.map((id) => FAMILY_COMPONENT_MODULES_BY_ID[id]!)

describe('MOTION-A18 keyframe-native creator pack', () => {
  it('contains exactly nine selected distinct modules with short-form duration contracts', () => {
    expect(modules).toHaveLength(9)
    expect(new Set(modules.map((module) => module.definition.id)).size).toBe(9)
    for (const module of modules) {
      expect(module).toBeDefined()
      expect(module.definition.minDurationTicks).toBe(durationTicks(.75))
      expect(module.definition.defaultDurationTicks).toBeGreaterThanOrEqual(durationTicks(1.8))
      expect(module.definition.defaultDurationTicks).toBeLessThanOrEqual(durationTicks(2.4))
      expect(module.definition.maxDurationTicks).toBe(durationTicks(8))
      expect(module.definition.events.length).toBeGreaterThanOrEqual(4)
      expect(module.definition.capabilities?.keyframeReady).toBe(true)
      expect(module.definition.capabilities?.semanticParts).toBe(true)
    }
  })

  it('uses real C2 keyframe tracks in every normal default graph', () => {
    for (const module of modules) {
      const scene = module.createScene(module.defaultProps, module.defaultStyle, context(2, 0, '16:9', false))
      const tracks = deriveTimelineTracks(scene).filter((track) => track.animationKind === 'keyframes')
      expect(tracks.length, module.definition.id).toBeGreaterThanOrEqual(8)
      expect(tracks.some((track) => track.property === 'opacity'), module.definition.id).toBe(true)
      expect(tracks.some((track) => track.property === 'transform.positionY' || track.property === 'transform.scaleX'), module.definition.id).toBe(true)
      expect(tracks.flatMap((track) => track.keyframes).every((keyframe) => Number.isSafeInteger(keyframe.tick)), module.definition.id).toBe(true)
    }
  })

  it.each(durations)('supports exact deterministic authored motion at %s seconds', (seconds) => {
    for (const module of modules) {
      const createContext = (progress: number) => context(seconds, progress)
      const scene = module.createScene(module.defaultProps, module.defaultStyle, createContext(0))
      expect(validateMotionScene(scene).ok, `${module.definition.id} ${seconds}s`).toBe(true)
      const first = evaluateScene(scene, createContext(.56))
      evaluateScene(scene, createContext(.08))
      evaluateScene(scene, createContext(.91))
      evaluateScene(scene, createContext(.27))
      expect(evaluateScene(scene, createContext(.56)), `${module.definition.id} ${seconds}s`).toEqual(first)
    }
  })

  it('refuses durations below 0.75 seconds and above the declared maximum', () => {
    for (const module of modules) {
      expect(() => module.createScene(module.defaultProps, module.defaultStyle, context(.74, 0))).toThrow(/duration is outside/)
      expect(() => module.createScene(module.defaultProps, module.defaultStyle, context(8.01, 0))).toThrow(/duration is outside/)
    }
  })

  it.each(['16:9', '9:16', '1:1', '4:5'] as const)('is graph-valid, compositor-ready and renderable at %s', (ratio) => {
    for (const module of modules) {
      const c = context(2, .56, ratio)
      const scene = module.createScene(module.defaultProps, module.defaultStyle, c)
      expect(validateMotionScene(scene).ok, `${module.definition.id} ${ratio}`).toBe(true)
      expect(validateCompositorReadiness(scene).ready, `${module.definition.id} ${ratio}`).toBe(true)
      const markup = renderComponentMarkup(module, module.defaultProps, module.defaultStyle, c)
      expect(markup, `${module.definition.id} ${ratio}`).toContain(`data-motion-module-id="${module.definition.id}"`)
    }
  })

  it('renders every A18 module mechanically through all eight shared style packs', () => {
    for (const module of modules) for (const pack of INITIAL_MOTION_STYLE_PACKS) {
      const style = familyComponentStyleFromPack(pack)
      expect(module.validateStyle(style).ok, `${module.definition.id} ${pack.id}`).toBe(true)
      const c = context(2, .56, '4:5')
      expect(validateCompositorReadiness(module.createScene(module.defaultProps, style, c)).ready, `${module.definition.id} ${pack.id}`).toBe(true)
      expect(renderComponentMarkup(module, module.defaultProps, style, c), `${module.definition.id} ${pack.id}`).toContain(`data-motion-module-id="${module.definition.id}"`)
    }
  })

  it('reduced motion removes authored transforms while preserving all semantic text', () => {
    for (const module of modules) {
      const normalScene = module.createScene(module.defaultProps, module.defaultStyle, context(2, 0, '9:16', false))
      const reducedScene = module.createScene(module.defaultProps, module.defaultStyle, context(2, 0, '9:16', true))
      const normalText = Object.values(evaluateScene(normalScene, context(2, .56, '9:16', false)).nodes).filter((node) => node.type === 'text').map((node) => node.type === 'text' ? node.text : '')
      const reducedResolved = evaluateScene(reducedScene, context(2, 0, '9:16', true))
      const reducedText = Object.values(reducedResolved.nodes).filter((node) => node.type === 'text').map((node) => node.type === 'text' ? node.text : '')
      expect(reducedText, module.definition.id).toEqual(normalText)
      for (const node of Object.values(reducedResolved.nodes)) {
        expect(node.transform.positionX, module.definition.id).toBe(0)
        expect(node.transform.positionY, module.definition.id).toBe(0)
        expect(node.transform.scaleX, module.definition.id).toBe(1)
        expect(node.transform.scaleY, module.definition.id).toBe(1)
      }
    }
  })

  it('preserves Creator content, Designer controls, Advanced parts and Level-4 graph readiness', () => {
    for (const module of modules) {
      const scene = module.createScene(module.defaultProps, module.defaultStyle, context(2, 0))
      expect(scene.exposures.some((exposure) => exposure.level === 'creator' && exposure.target.kind === 'component'), module.definition.id).toBe(true)
      expect(scene.exposures.some((exposure) => exposure.level === 'designer' && exposure.target.kind === 'node'), module.definition.id).toBe(true)
      expect(scene.exposures.some((exposure) => exposure.level === 'advanced' && exposure.target.kind === 'part'), module.definition.id).toBe(true)
      expect(scene.semanticParts.length, module.definition.id).toBeGreaterThanOrEqual(4)
      expect(validateCompositorReadiness(scene).ready, module.definition.id).toBe(true)
    }
  })

  it('accepts representative text stress without mutating user content', () => {
    const stressCases = [
      { title: 'GO', value: '9', items: ['GO'] },
      { title: 'Make it clear now', value: '10,000×', items: ['repeat repeat', 'why?', 'こんにちは', 'مرحبا'] },
      { title: 'Line one\nLine two', value: 'WOW!', items: ['duplicate', 'duplicate', 'punctuation?!', '42%'] },
      { title: 'SUPERCALIFRAGILISTICEXPIALIDOCIOUS', value: 'LONGWORD', items: ['one-word'] },
    ]
    for (const module of modules) for (const stress of stressCases) {
      const props = { ...module.defaultProps, title: stress.title, value: stress.value, items: Object.freeze(stress.items) }
      const validation = module.validateProps(props)
      expect(validation.ok, `${module.definition.id}: ${stress.title}`).toBe(true)
      if (!validation.ok) continue
      const scene = module.createScene(validation.value, module.defaultStyle, context(2, 0, '9:16'))
      const resolved = evaluateScene(scene, context(2, .56, '9:16'))
      const text = Object.values(resolved.nodes).filter((node) => node.type === 'text').map((node) => node.type === 'text' ? node.text : '')
      expect(text).toContain(stress.title)
      expect(text).toContain(stress.value)
      for (const item of stress.items) expect(text).toContain(item)
    }
  })

  it('still refuses impossible over-limit content instead of silently truncating it', () => {
    for (const module of modules) {
      expect(module.validateProps({ ...module.defaultProps, title: 'X'.repeat(97) }).ok, module.definition.id).toBe(false)
      expect(module.validateProps({ ...module.defaultProps, items: Array.from({ length: 7 }, (_, index) => `Item ${index}`) }).ok, module.definition.id).toBe(false)
    }
  })
})
