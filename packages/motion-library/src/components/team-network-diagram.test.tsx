import { describe, expect, it } from 'vitest'
import { evaluateScene, validateCompositorReadiness, validateMotionScene } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { RATIO_COMPOSITIONS, evaluateDeterminism, evaluateMarkupDeterminism, renderComponentMarkup, validateDefinition, validateFixture } from '@sanverse/motion-testing'
import {
  DEFAULT_TEAM_NETWORK_PROPS,
  DEFAULT_TEAM_NETWORK_STYLE,
  TEAM_NETWORK_DIAGRAM_DEFINITION,
  TeamNetworkDiagramModule,
  createTeamNetworkDiagramScene,
  deriveTeamNetworkLayout,
  evaluateTeamNetworkDiagramState,
  teamNetworkDiagramStyleFromPack,
  validateTeamNetworkDiagramFit,
  validateTeamNetworkDiagramProps,
} from './team-network-diagram.tsx'
import { TEAM_NETWORK_DIAGRAM_FIXTURES } from '../fixtures/team-network-diagram.ts'
import { CREATOR_ENERGETIC_STYLE, SANVERSE_CLEAN_STYLE } from '../style-packs.ts'

const durationTicks = SANVERSE_TICKS_PER_SECOND * 6
const context = (localTicks: number, ratio: keyof typeof RATIO_COMPOSITIONS = '16:9', reducedMotion = false) => ({ localTicks, durationTicks, ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition: RATIO_COMPOSITIONS[ratio], reducedMotion })
const at = (progress: number, ratio: keyof typeof RATIO_COMPOSITIONS = '16:9', reducedMotion = false) => context(Math.round(durationTicks * progress), ratio, reducedMotion)

describe('Team / Network Diagram contract', () => {
  it('declares valid metadata and fixtures', () => {
    expect(validateDefinition(TEAM_NETWORK_DIAGRAM_DEFINITION)).toEqual([])
    expect(TEAM_NETWORK_DIAGRAM_FIXTURES.length).toBeGreaterThanOrEqual(10)
    for (const fixture of TEAM_NETWORK_DIAGRAM_FIXTURES) expect(validateFixture(fixture)).toEqual([])
  })
  it('refuses duplicate/invalid node IDs, missing center and broken connections', () => {
    expect(validateTeamNetworkDiagramProps({ ...DEFAULT_TEAM_NETWORK_PROPS, nodes: [{ id: 'core', label: 'A', role: '' }, { id: 'core', label: 'B', role: '' }, { id: 'x', label: 'X', role: '' }] }).ok).toBe(false)
    expect(validateTeamNetworkDiagramProps({ ...DEFAULT_TEAM_NETWORK_PROPS, centerId: 'missing' }).ok).toBe(false)
    expect(validateTeamNetworkDiagramProps({ ...DEFAULT_TEAM_NETWORK_PROPS, connections: [{ from: 'core', to: 'missing' }, { from: 'core', to: 'core' }] }).ok).toBe(false)
  })
  it('refuses fewer than 3 or more than 8 nodes', () => {
    expect(validateTeamNetworkDiagramProps({ ...DEFAULT_TEAM_NETWORK_PROPS, nodes: DEFAULT_TEAM_NETWORK_PROPS.nodes.slice(0, 2) }).ok).toBe(false)
    const tooMany = [...DEFAULT_TEAM_NETWORK_PROPS.nodes, { id: 'a', label: 'A', role: '' }, { id: 'b', label: 'B', role: '' }, { id: 'c', label: 'C', role: '' }, { id: 'd', label: 'D', role: '' }]
    expect(validateTeamNetworkDiagramProps({ ...DEFAULT_TEAM_NETWORK_PROPS, nodes: tooMany }).ok).toBe(false)
  })
})

describe('Team / Network Diagram analytic responsive layout', () => {
  it.each(['16:9', '9:16', '1:1', '4:5'] as const)('%s fits every node inside the composition', (ratio) => {
    const fit = validateTeamNetworkDiagramFit(DEFAULT_TEAM_NETWORK_PROPS, at(0.55, ratio))
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    const { width, height } = RATIO_COMPOSITIONS[ratio]
    for (const position of fit.value.positions) {
      expect(position.x).toBeGreaterThan(0)
      expect(position.x).toBeLessThan(width)
      expect(position.y).toBeGreaterThan(0)
      expect(position.y).toBeLessThan(height)
    }
  })
  it('uses deterministic portrait geometry without a force simulation', () => {
    const first = deriveTeamNetworkLayout(DEFAULT_TEAM_NETWORK_PROPS, at(0.2, '9:16'))
    const second = deriveTeamNetworkLayout(DEFAULT_TEAM_NETWORK_PROPS, at(0.9, '9:16'))
    expect(second.positions).toEqual(first.positions)
    expect(first.kind).toBe('portrait')
  })
  it('uses landscape, portrait and square layout classes only from dimensions', () => {
    expect(deriveTeamNetworkLayout(DEFAULT_TEAM_NETWORK_PROPS, at(0.5, '16:9')).kind).toBe('landscape')
    expect(deriveTeamNetworkLayout(DEFAULT_TEAM_NETWORK_PROPS, at(0.5, '9:16')).kind).toBe('portrait')
    expect(deriveTeamNetworkLayout(DEFAULT_TEAM_NETWORK_PROPS, at(0.5, '1:1')).kind).toBe('square')
  })
})

describe('Team / Network Diagram exact seek and graph readiness', () => {
  it('returns identical state at repeated ticks after backward/random seeks', () => {
    const tick = Math.round(durationTicks * 0.36)
    const report = evaluateDeterminism((localTicks) => evaluateTeamNetworkDiagramState(DEFAULT_TEAM_NETWORK_PROPS, DEFAULT_TEAM_NETWORK_STYLE, context(localTicks)), [0, tick, durationTicks, Math.round(durationTicks * 0.11), tick, Math.round(durationTicks * 0.9), tick])
    expect(report.ok).toBe(true)
  })
  it('renders identical markup at repeated exact ticks', () => {
    const tick = Math.round(durationTicks * 0.36)
    expect(evaluateMarkupDeterminism(TeamNetworkDiagramModule, DEFAULT_TEAM_NETWORK_PROPS, DEFAULT_TEAM_NETWORK_STYLE, { durationTicks, ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition: RATIO_COMPOSITIONS['16:9'], reducedMotion: false }, [0, tick, durationTicks, tick]).ok).toBe(true)
  })
  it('reduced motion keeps geometry and semantics while revealing all edges/nodes directly', () => {
    const normal = evaluateTeamNetworkDiagramState(DEFAULT_TEAM_NETWORK_PROPS, DEFAULT_TEAM_NETWORK_STYLE, at(0.18))
    const reduced = evaluateTeamNetworkDiagramState(DEFAULT_TEAM_NETWORK_PROPS, DEFAULT_TEAM_NETWORK_STYLE, at(0.18, '16:9', true))
    expect(reduced.layout.positions).toEqual(normal.layout.positions)
    expect(reduced.nodeOpacities.every((value) => value === 1)).toBe(true)
    expect(reduced.edgeProgresses.every((value) => value === 1)).toBe(true)
  })
  it('creates a valid compositor-ready serializable graph with animated node/edge tracks', () => {
    const scene = createTeamNetworkDiagramScene(DEFAULT_TEAM_NETWORK_PROPS, DEFAULT_TEAM_NETWORK_STYLE, at(0.36))
    expect(validateMotionScene(scene).ok).toBe(true)
    expect(validateCompositorReadiness(scene).ready).toBe(true)
    const resolved = evaluateScene(scene, at(0.36))
    expect(Object.values(resolved.nodes).some((node) => node.type === 'path' && node.trimProgress > 0 && node.trimProgress < 1)).toBe(true)
    expect(JSON.parse(JSON.stringify(scene))).toMatchObject({ schemaVersion: 'sanverse.motion-scene/v1', componentId: 'sanverse.team-network-diagram' })
  })
  it('renders stable graph-addressable nodes and paths', () => {
    const markup = renderComponentMarkup(TeamNetworkDiagramModule, DEFAULT_TEAM_NETWORK_PROPS, DEFAULT_TEAM_NETWORK_STYLE, at(0.55))
    expect(markup).toContain('data-motion-root="team-network-diagram"')
    expect(markup).toContain('data-motion-node-id="team-network.node:core"')
    expect(markup).toContain('data-motion-node-id="team-network.edges"')
  })
  it('shares style packs without component duplication', () => {
    const clean = teamNetworkDiagramStyleFromPack(SANVERSE_CLEAN_STYLE)
    const energetic = teamNetworkDiagramStyleFromPack(CREATOR_ENERGETIC_STYLE)
    expect(clean.accentColor).not.toBe(energetic.accentColor)
    expect(clean.motionIntensity).toBeLessThan(energetic.motionIntensity)
  })
})
