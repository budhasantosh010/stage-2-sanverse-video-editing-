import { describe, expect, it } from 'vitest'
import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import { deriveLayerTree, deriveNodeEffectRelationships, deriveTimelineTracks, evaluateScene, validateCompositorReadiness, validateMotionScene } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { MOTION_REFERENCE_COMPOSITIONS } from './reference-compositions.ts'
import {
  DEFAULT_KINETIC_HEADLINE_PROPS,
  DEFAULT_KINETIC_HEADLINE_STYLE,
  createKineticHeadlineScene,
  evaluateKineticHeadlineState,
  tokenizeHeadline,
} from './index.ts'
import { stableWordNodeIds } from './graph-common.ts'
import { DEFAULT_CHECKLIST_CARD_PROPS, DEFAULT_CHECKLIST_CARD_STYLE, createChecklistCardScene, evaluateChecklistCardState } from './components/checklist-card.tsx'
import { DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, createCostValueCardScene, evaluateCostValueCardState } from './components/cost-value-card.tsx'
import { DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, createTimerStatusPillScene, evaluateTimerStatusPillState } from './components/timer-status-pill.tsx'

const context = (localTicks: number, durationSeconds: number, reducedMotion = false): MotionRenderContextV1 => ({
  localTicks,
  durationTicks: durationSeconds * SANVERSE_TICKS_PER_SECOND,
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: MOTION_REFERENCE_COMPOSITIONS['16:9'],
  reducedMotion,
})

const roundTrip = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const allScenes = () => [
  createKineticHeadlineScene(DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, context(Math.round(3 * SANVERSE_TICKS_PER_SECOND * 0.3), 3)),
  createChecklistCardScene(DEFAULT_CHECKLIST_CARD_PROPS, DEFAULT_CHECKLIST_CARD_STYLE, context(Math.round(5 * SANVERSE_TICKS_PER_SECOND * 0.62), 5)),
  createCostValueCardScene(DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, context(Math.round(5 * SANVERSE_TICKS_PER_SECOND * 0.6), 5)),
  createTimerStatusPillScene(DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, context(Math.round(5 * SANVERSE_TICKS_PER_SECOND * 0.42), 5)),
] as const

describe('first-party compositor readiness', () => {
  it('all four migrated scenes validate and cover every editable visual node semantically', () => {
    for (const scene of allScenes()) {
      expect(validateMotionScene(scene)).toMatchObject({ ok: true })
      expect(validateCompositorReadiness(scene)).toMatchObject({ ready: true })
    }
  })

  it('all four scenes serialize, parse, validate and resolve equivalently', () => {
    for (const scene of allScenes()) {
      const parsed = roundTrip(scene)
      expect(validateMotionScene(parsed)).toMatchObject({ ok: true })
      const ctx = context(Math.round(5 * SANVERSE_TICKS_PER_SECOND * 0.42), 5)
      const sceneContext = scene.componentId === 'sanverse.kinetic-headline' ? context(Math.round(3 * SANVERSE_TICKS_PER_SECOND * 0.42), 3) : ctx
      expect(evaluateScene(parsed, sceneContext)).toEqual(evaluateScene(scene, sceneContext))
    }
  })

  it('layer, node/effect and timeline projections all come from the same scene and every component exposes animation tracks', () => {
    for (const scene of allScenes()) {
      expect(deriveLayerTree(scene).nodeId).toBe(scene.rootNodeId)
      expect(deriveNodeEffectRelationships(scene)).toHaveLength(Object.keys(scene.nodes).length)
      expect(deriveTimelineTracks(scene).length).toBeGreaterThan(0)
    }
  })

  it('repeated and backward seeks resolve identically for every migrated scene', () => {
    for (const scene of allScenes()) {
      const durationSeconds = scene.componentId === 'sanverse.kinetic-headline' ? 3 : 5
      const ticks = [0, 0.1, 0.25, 0.5, 0.75, 1, 0.25, 0, 0.75].map((progress) => Math.round(durationSeconds * SANVERSE_TICKS_PER_SECOND * progress))
      const frames = ticks.map((tick) => evaluateScene(scene, context(tick, durationSeconds)))
      expect(frames[2]).toEqual(frames[6])
      expect(frames[0]).toEqual(frames[7])
      expect(frames[4]).toEqual(frames[8])
    }
  })
})

describe('graph values match the existing exact-state regression oracles', () => {
  it('Headline graph matches panel and word motion at representative ticks', () => {
    const words = tokenizeHeadline(DEFAULT_KINETIC_HEADLINE_PROPS.text)
    const ids = stableWordNodeIds('kinetic-headline', words)
    for (const progress of [0.12, 0.3, 0.9]) {
      const ctx = context(Math.round(3 * SANVERSE_TICKS_PER_SECOND * progress), 3)
      const state = evaluateKineticHeadlineState(DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, ctx)
      const resolved = evaluateScene(createKineticHeadlineScene(DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, ctx), ctx)
      expect(resolved.nodes['kinetic-headline.background']!.opacity).toBeCloseTo(state.panelOpacity, 10)
      state.words.forEach((word, index) => {
        const node = resolved.nodes[ids[index]!]!
        expect(node.opacity).toBeCloseTo(word.opacity, 10)
        expect(node.transform.positionY).toBeCloseTo(word.translateY, 10)
        expect(node.transform.scaleX).toBeCloseTo(word.scale, 10)
      })
    }
  })

  it('Checklist graph matches panel/title/row/check/progress motion', () => {
    for (const progress of [0.18, 0.62, 0.9]) {
      const ctx = context(Math.round(5 * SANVERSE_TICKS_PER_SECOND * progress), 5)
      const state = evaluateChecklistCardState(DEFAULT_CHECKLIST_CARD_PROPS, DEFAULT_CHECKLIST_CARD_STYLE, ctx)
      const resolved = evaluateScene(createChecklistCardScene(DEFAULT_CHECKLIST_CARD_PROPS, DEFAULT_CHECKLIST_CARD_STYLE, ctx), ctx)
      expect(resolved.nodes['checklist.surface']!.opacity).toBeCloseTo(state.panelOpacity, 10)
      expect(resolved.nodes['checklist.title-group']!.opacity).toBeCloseTo(state.titleOpacity, 10)
      expect(resolved.nodes['checklist.title-group']!.transform.positionY).toBeCloseTo(state.titleTranslateY, 10)
      expect(resolved.nodes['checklist.progress-fill']!.transform.scaleX).toBeCloseTo(state.progressReveal, 10)
      DEFAULT_CHECKLIST_CARD_PROPS.items.forEach((item, index) => {
        const row = resolved.nodes[`checklist.row:${item.id}`]!
        const checkmark = resolved.nodes[`checklist.row:${item.id}.checkmark`]
        expect(row.opacity).toBeCloseTo(state.rows[index]!.opacity, 10)
        expect(row.transform.positionX).toBeCloseTo(state.rows[index]!.translateX, 10)
        if (checkmark?.type === 'path') expect(checkmark.trimProgress).toBeCloseTo(state.rows[index]!.checkProgress, 10)
      })
    }
  })

  it('Cost graph matches motion and animated metric strings', () => {
    for (const progress of [0.2, 0.6, 0.9]) {
      const ctx = context(Math.round(5 * SANVERSE_TICKS_PER_SECOND * progress), 5)
      const state = evaluateCostValueCardState(DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, ctx)
      const resolved = evaluateScene(createCostValueCardScene(DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, ctx), ctx)
      expect(resolved.nodes['cost-card.surface']!.opacity).toBeCloseTo(state.panelOpacity, 10)
      expect(resolved.nodes['cost-card.cost']!.opacity).toBeCloseTo(state.costOpacity, 10)
      expect(resolved.nodes['cost-card.value']!.opacity).toBeCloseTo(state.valueOpacity, 10)
      expect(resolved.nodes['cost-card.direction-indicator']!.opacity).toBeCloseTo(state.arrowOpacity, 10)
      const costText = resolved.nodes['cost-card.cost.number']
      const valueText = resolved.nodes['cost-card.value.number']
      expect(costText?.type === 'text' ? costText.text : null).toBe(`$${state.displayedCostValue >= 1000 ? `${Number((state.displayedCostValue / 1000).toFixed(1))}K` : state.displayedCostValue}`)
      expect(valueText?.type === 'text').toBe(true)
    }
  })

  it('Timer graph matches exact clock, ring, surface and live-dot state including reduced motion', () => {
    for (const [progress, reducedMotion] of [[0.15, false], [0.42, false], [0.9, false], [0.15, true]] as const) {
      const ctx = context(Math.round(5 * SANVERSE_TICKS_PER_SECOND * progress), 5, reducedMotion)
      const state = evaluateTimerStatusPillState(DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, ctx)
      const resolved = evaluateScene(createTimerStatusPillScene(DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, ctx), ctx)
      const surface = resolved.nodes['timer.surface']!
      const ring = resolved.nodes['timer.progress.ring']
      const dot = resolved.nodes['timer.status.dot']!
      const clock = resolved.nodes['timer.timeValue']
      expect(surface.opacity).toBeCloseTo(state.opacity, 10)
      expect(surface.transform.positionY).toBeCloseTo(state.translateY, 10)
      expect(surface.transform.scaleX).toBeCloseTo(state.scale, 10)
      expect(ring?.type === 'path' ? ring.trimProgress : null).toBeCloseTo(state.progressRing, 10)
      expect(dot.opacity).toBeCloseTo(state.statusDotOpacity, 10)
      expect(dot.transform.scaleX).toBeCloseTo(state.statusDotScale, 10)
      expect(clock?.type === 'text' ? clock.text : null).toBe(state.displayedClock)
    }
  })
})
