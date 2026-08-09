import { describe, expect, it } from 'vitest'
import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import {
  applyMotionOperation,
  createMotionAuthoringMetadata,
  evaluateScene,
  projectMotionLayers,
  setMotionNodeLocked,
  validateCompositorReadiness,
  validateMotionScene,
} from '@sanverse/motion-graph'
import type { MotionGroupNodeV1 } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { RATIO_COMPOSITIONS, renderComponentMarkup } from '@sanverse/motion-testing'
import { INITIAL_MOTION_STYLE_PACKS } from '../style-packs.ts'
import { familyComponentStyleFromPack, FAMILY_COMPONENT_MODULES_BY_ID } from './component-families.tsx'
import type { FamilyComponentProps } from './component-families.tsx'
import { A19_HIERARCHY_COMPONENT_IDS, A19_HIERARCHY_CONFIGS } from './a19-hierarchy-explainers.tsx'

const context = (durationTicks: number, localTicks: number, ratio: keyof typeof RATIO_COMPOSITIONS = '16:9', reducedMotion = false): MotionRenderContextV1 => ({
  durationTicks,
  localTicks,
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: RATIO_COMPOSITIONS[ratio],
  reducedMotion,
})

const moduleFor = (id: (typeof A19_HIERARCHY_COMPONENT_IDS)[number]) => {
  const module = FAMILY_COMPONENT_MODULES_BY_ID[id]
  if (!module) throw new Error(`Missing A19 module: ${id}`)
  return module
}

const configFor = (id: (typeof A19_HIERARCHY_COMPONENT_IDS)[number]) => {
  const config = A19_HIERARCHY_CONFIGS.find((candidate) => candidate.id === id)
  if (!config) throw new Error(`Missing A19 config: ${id}`)
  return config
}

describe('MOTION-A19 hierarchy-heavy explainer pack', () => {
  it('registers exactly eight distinct hierarchy-heavy scenarios', () => {
    expect(A19_HIERARCHY_COMPONENT_IDS).toHaveLength(8)
    expect(new Set(A19_HIERARCHY_COMPONENT_IDS).size).toBe(8)
    for (const id of A19_HIERARCHY_COMPONENT_IDS) expect(FAMILY_COMPONENT_MODULES_BY_ID[id]?.definition.id).toBe(id)
    expect(A19_HIERARCHY_CONFIGS.map((config) => config.variant)).toEqual([
      'decision-tree', 'swimlane', 'journey-map', 'priority-matrix', 'value-chain', 'layer-stack', 'ecosystem-map', 'dependency-map',
    ])
  })

  it('creates valid compositor-ready nested scenes at all four reference ratios', () => {
    for (const id of A19_HIERARCHY_COMPONENT_IDS) {
      const module = moduleFor(id)
      for (const [ratio, composition] of Object.entries(RATIO_COMPOSITIONS)) {
        const durationTicks = module.definition.defaultDurationTicks
        const ctx = { durationTicks, localTicks: Math.round(durationTicks * .56), ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition, reducedMotion: false } as const
        const scene = module.createScene(module.defaultProps, module.defaultStyle, ctx)
        expect(validateMotionScene(scene).ok, `${id} ${ratio}`).toBe(true)
        expect(validateCompositorReadiness(scene).ready, `${id} ${ratio}`).toBe(true)
        const resolved = evaluateScene(scene, ctx)
        const projection = projectMotionLayers({ scene, resolvedScene: resolved, authoringMetadata: createMotionAuthoringMetadata() })
        expect(Object.keys(projection.layersById)).toHaveLength(Object.keys(scene.nodes).length)
        expect(Math.max(...Object.values(projection.layersById).map((layer) => layer.depth)), `${id} ${ratio}`).toBeGreaterThanOrEqual(3)
        expect(Object.values(projection.layersById).some((layer) => layer.displayName.includes('—')), `${id} ${ratio}`).toBe(true)
      }
    }
  })

  it('uses stable data-derived node IDs rather than array positions', () => {
    const module = moduleFor('sanverse.decision-tree')
    const durationTicks = module.definition.defaultDurationTicks
    const original = module.defaultProps
    const reordered: FamilyComponentProps = Object.freeze({ ...original, items: Object.freeze([...original.items].reverse()) })
    const first = module.createScene(original, module.defaultStyle, context(durationTicks, 0))
    const second = module.createScene(reordered, module.defaultStyle, context(durationTicks, 0))
    for (const stable of ['root', 'repeat', 'automate', 'review', 'manual']) {
      expect(first.nodes[`a19.decision-tree.node:${stable}`], stable).toBeDefined()
      expect(second.nodes[`a19.decision-tree.node:${stable}`], stable).toBeDefined()
    }
    expect(Object.keys(first.nodes).some((id) => /(?:item|node):\d+$/u.test(id))).toBe(false)
  })

  it('authors C2 exact-tick tracks and remains deterministic across direct/backward/random seeks', () => {
    for (const id of A19_HIERARCHY_COMPONENT_IDS) {
      const module = moduleFor(id)
      const durationTicks = module.definition.defaultDurationTicks
      const scene = module.createScene(module.defaultProps, module.defaultStyle, context(durationTicks, 0))
      expect(Object.values(scene.nodes).some((node) => node.opacity.kind === 'keyframes'), id).toBe(true)
      const ticks = [0, Math.round(durationTicks * .18), Math.round(durationTicks * .67), Math.round(durationTicks * .31), Math.round(durationTicks * .67), durationTicks]
      const states = ticks.map((localTicks) => evaluateScene(scene, context(durationTicks, localTicks)))
      expect(states[2], id).toEqual(states[4])
    }
  })

  it('reduces motion by replacing authored entrance tracks with final constants while preserving text', () => {
    for (const id of A19_HIERARCHY_COMPONENT_IDS) {
      const module = moduleFor(id)
      const durationTicks = module.definition.defaultDurationTicks
      const normalScene = module.createScene(module.defaultProps, module.defaultStyle, context(durationTicks, 0, '9:16', false))
      const reducedScene = module.createScene(module.defaultProps, module.defaultStyle, context(durationTicks, 0, '9:16', true))
      expect(Object.values(normalScene.nodes).some((node) => node.opacity.kind === 'keyframes'), id).toBe(true)
      expect(Object.values(reducedScene.nodes).every((node) => node.opacity.kind === 'constant'), id).toBe(true)
      const normal = evaluateScene(normalScene, context(durationTicks, Math.round(durationTicks * .56), '9:16', false))
      const reduced = evaluateScene(reducedScene, context(durationTicks, Math.round(durationTicks * .56), '9:16', true))
      const text = (scene: typeof normal) => Object.values(scene.nodes).filter((node) => node.type === 'text').map((node) => node.type === 'text' ? node.text : '')
      expect(text(reduced), id).toEqual(text(normal))
    }
  })

  it('renders all eight scenarios through all eight style packs at all four ratios', () => {
    for (const id of A19_HIERARCHY_COMPONENT_IDS) {
      const module = moduleFor(id)
      for (const pack of INITIAL_MOTION_STYLE_PACKS) {
        const style = familyComponentStyleFromPack(pack)
        expect(module.validateStyle(style).ok, `${id} ${pack.id}`).toBe(true)
        for (const ratio of ['16:9', '9:16', '1:1', '4:5'] as const) {
          const durationTicks = module.definition.defaultDurationTicks
          const markup = renderComponentMarkup(module, module.defaultProps, style, context(durationTicks, Math.round(durationTicks * .56), ratio))
          expect(markup, `${id} ${pack.id} ${ratio}`).toContain(`data-motion-module-id="${id}"`)
          expect(markup, `${id} ${pack.id} ${ratio}`).toContain('data-motion-node-id=')
        }
      }
    }
  })

  it('enforces bounded short durations at the scene boundary', () => {
    for (const id of A19_HIERARCHY_COMPONENT_IDS) {
      const module = moduleFor(id)
      const minimum = module.definition.minDurationTicks
      const maximum = module.definition.maxDurationTicks
      expect(() => module.createScene(module.defaultProps, module.defaultStyle, context(minimum, 0)), `${id} min`).not.toThrow()
      expect(() => module.createScene(module.defaultProps, module.defaultStyle, context(maximum, maximum)), `${id} max`).not.toThrow()
      expect(() => module.createScene(module.defaultProps, module.defaultStyle, context(minimum - 1, 0)), `${id} under`).toThrow(RangeError)
      expect(() => module.createScene(module.defaultProps, module.defaultStyle, context(maximum + 1, 0)), `${id} over`).toThrow(RangeError)
    }
  })

  it('refuses malformed IDs, invalid references, invalid active IDs and excessive density', () => {
    const decision = moduleFor('sanverse.decision-tree')
    expect(decision.validateProps({ ...decision.defaultProps, items: ['root|question|One?|none|', 'root|result|Duplicate|none|', 'x|result|Done|root|YES'] }).ok).toBe(false)
    expect(decision.validateProps({ ...decision.defaultProps, value: 'does-not-exist' }).ok).toBe(false)
    expect(decision.validateProps({ ...decision.defaultProps, value: '', items: ['a|question|A?|b|YES', 'b|decision|B?|a|YES', 'c|result|Done|b|YES'] }).ok).toBe(false)

    const dependency = moduleFor('sanverse.dependency-map')
    expect(dependency.validateProps({ ...dependency.defaultProps, items: [...dependency.defaultProps.items.slice(0, -1), 'publish|Publish|missing'] }).ok).toBe(false)
    expect(dependency.validateProps({ ...dependency.defaultProps, value: '', items: ['a|A|b', 'b|B|a', 'c|C|a'] }).ok).toBe(false)

    const priority = moduleFor('sanverse.priority-matrix')
    expect(priority.validateProps({ ...priority.defaultProps, items: priority.defaultProps.items.slice(0, 3) }).ok).toBe(false)

    const journey = moduleFor('sanverse.journey-map')
    const tooDense = Array.from({ length: 13 }, (_, index) => `stage-${index}|Stage ${index}|Moment ${index}|Metric ${index}`)
    expect(journey.validateProps({ ...journey.defaultProps, items: tooDense }).ok).toBe(false)
  })

  it('supports a bounded dense swimlane scene with stable nested step IDs', () => {
    const module = moduleFor('sanverse.swimlane-process')
    const items = Array.from({ length: 5 }, (_, laneIndex) => {
      const lane = `lane-${laneIndex + 1}`
      const steps = Array.from({ length: 5 }, (_, stepIndex) => `${lane}-step-${stepIndex + 1}:Step ${stepIndex + 1}`).join(',')
      return `${lane}|Lane ${laneIndex + 1}|${steps}`
    })
    const props: FamilyComponentProps = Object.freeze({ ...module.defaultProps, value: 'lane-3', items: Object.freeze(items) })
    expect(module.validateProps(props).ok).toBe(true)
    const durationTicks = module.definition.defaultDurationTicks
    const scene = module.createScene(props, module.defaultStyle, context(durationTicks, Math.round(durationTicks * .56), '9:16'))
    expect(validateMotionScene(scene).ok).toBe(true)
    expect(scene.nodes['a19.swimlane-process.lane:lane-3.step:lane-3-step-5']).toBeDefined()
    expect(Object.keys(scene.nodes).length).toBeGreaterThan(100)
  })

  it('routes hierarchy edits through the C3 operation API and honors authoring locks', () => {
    const module = moduleFor('sanverse.decision-tree')
    const durationTicks = module.definition.defaultDurationTicks
    const scene = module.createScene(module.defaultProps, module.defaultStyle, context(durationTicks, Math.round(durationTicks * .56)))
    const target = 'a19.decision-tree.node:automate'
    const renamed = applyMotionOperation(scene, { operationId: 'a19:rename', type: 'rename-node', nodeId: target, name: 'Automate Path' })
    expect(renamed.ok).toBe(true)
    if (!renamed.ok) throw new Error(renamed.error.message)
    expect(renamed.scene.nodes[target]?.name).toBe('Automate Path')

    const hidden = applyMotionOperation(renamed.scene, { operationId: 'a19:eye', type: 'set-node-enabled', nodeId: target, enabled: false })
    expect(hidden.ok).toBe(true)
    if (!hidden.ok) throw new Error(hidden.error.message)
    expect(hidden.scene.nodes[target]?.enabled).toBe(false)

    const grouped = applyMotionOperation(scene, { operationId: 'a19:group', type: 'group-nodes', nodeIds: ['a19.decision-tree.node:automate', 'a19.decision-tree.node:review'], groupId: 'a19.decision-tree.branch-results', groupName: 'Branch Results' })
    expect(grouped.ok).toBe(true)
    if (!grouped.ok) throw new Error(grouped.error.message)
    expect((grouped.scene.nodes['a19.decision-tree.branch-results'] as MotionGroupNodeV1).childIds).toEqual(['a19.decision-tree.node:automate', 'a19.decision-tree.node:review'])

    const metadata = setMotionNodeLocked(createMotionAuthoringMetadata(), scene, 'a19.decision-tree.body', true)
    expect(applyMotionOperation(scene, { operationId: 'a19:locked', type: 'rename-node', nodeId: target, name: 'Blocked' }, { authoringMetadata: metadata })).toMatchObject({ ok: false, error: { code: 'LOCKED' } })
    expect(applyMotionOperation(scene, { operationId: 'a19:locked-eye', type: 'set-node-enabled', nodeId: target, enabled: false }, { authoringMetadata: metadata }).ok).toBe(true)
  })

  it('keeps A19 scenario defaults within their declared density and duration contracts', () => {
    for (const config of A19_HIERARCHY_CONFIGS) {
      const module = moduleFor(config.id)
      expect(module.defaultProps.items.length).toBeGreaterThanOrEqual(2)
      expect(module.defaultProps.items.length).toBeLessThanOrEqual(12)
      expect(module.definition.defaultDurationTicks).toBeGreaterThanOrEqual(module.definition.minDurationTicks)
      expect(module.definition.defaultDurationTicks).toBeLessThanOrEqual(module.definition.maxDurationTicks)
      expect(configFor(config.id).purpose).not.toMatch(/generic|placeholder/iu)
    }
  })
})
