import type { MotionFixtureV1 } from '@sanverse/motion-contract'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import type { TeamNetworkDiagramProps, TeamNetworkDiagramStyle } from '../components/team-network-diagram.tsx'
import { DEFAULT_TEAM_NETWORK_PROPS, teamNetworkDiagramStyleFromPack } from '../components/team-network-diagram.tsx'
import { MOTION_REFERENCE_COMPOSITIONS } from '../reference-compositions.ts'
import { CREATOR_ENERGETIC_STYLE, SANVERSE_CLEAN_STYLE } from '../style-packs.ts'

const clean = teamNetworkDiagramStyleFromPack(SANVERSE_CLEAN_STYLE)
const energetic = teamNetworkDiagramStyleFromPack(CREATOR_ENERGETIC_STYLE)
const duration = SANVERSE_TICKS_PER_SECOND * 6
const samples = Object.freeze([0, Math.round(duration * 0.18), Math.round(duration * 0.55), Math.round(duration * 0.9)])

const maxProps: TeamNetworkDiagramProps = Object.freeze({
  eyebrow: 'ORCHESTRATION', title: 'Eight specialists around one shared brain', centerId: 'core',
  nodes: Object.freeze([
    Object.freeze({ id: 'core', label: 'Shared brain', role: 'Core' }), Object.freeze({ id: 'research', label: 'Research', role: 'Agent' }), Object.freeze({ id: 'scripts', label: 'Scripts', role: 'Agent' }), Object.freeze({ id: 'youtube', label: 'YouTube', role: 'Channel' }), Object.freeze({ id: 'linkedin', label: 'LinkedIn', role: 'Channel' }), Object.freeze({ id: 'shorts', label: 'Shorts', role: 'Channel' }), Object.freeze({ id: 'analytics', label: 'Analytics', role: 'Signal' }), Object.freeze({ id: 'iteration', label: 'Iteration', role: 'Loop' }),
  ]),
  connections: Object.freeze([
    Object.freeze({ from: 'core', to: 'research' }), Object.freeze({ from: 'core', to: 'scripts' }), Object.freeze({ from: 'core', to: 'youtube' }), Object.freeze({ from: 'core', to: 'linkedin' }), Object.freeze({ from: 'core', to: 'shorts' }), Object.freeze({ from: 'research', to: 'analytics' }), Object.freeze({ from: 'analytics', to: 'iteration' }), Object.freeze({ from: 'iteration', to: 'scripts' }),
  ]),
})

const fixture = (id: string, name: string, props: TeamNetworkDiagramProps, style: TeamNetworkDiagramStyle, ratio: keyof typeof MOTION_REFERENCE_COMPOSITIONS = '16:9', reducedMotion = false): MotionFixtureV1<TeamNetworkDiagramProps, TeamNetworkDiagramStyle> => Object.freeze({
  id, name, componentId: 'sanverse.team-network-diagram', props, style, composition: MOTION_REFERENCE_COMPOSITIONS[ratio], durationTicks: duration, sampleTicks: samples, reducedMotion, background: 'black',
})

export const TEAM_NETWORK_DIAGRAM_FIXTURES = Object.freeze([
  fixture('team-network-default', 'Default network', DEFAULT_TEAM_NETWORK_PROPS, clean),
  fixture('team-network-landscape', 'Landscape', DEFAULT_TEAM_NETWORK_PROPS, clean, '16:9'),
  fixture('team-network-portrait', 'Portrait', DEFAULT_TEAM_NETWORK_PROPS, clean, '9:16'),
  fixture('team-network-square', 'Square', DEFAULT_TEAM_NETWORK_PROPS, clean, '1:1'),
  fixture('team-network-four-five', '4:5', DEFAULT_TEAM_NETWORK_PROPS, clean, '4:5'),
  fixture('team-network-max-landscape', 'Eight nodes landscape', maxProps, clean, '16:9'),
  fixture('team-network-max-portrait', 'Eight nodes portrait', maxProps, clean, '9:16'),
  fixture('team-network-clean', 'Sanverse Clean', DEFAULT_TEAM_NETWORK_PROPS, clean),
  fixture('team-network-energetic', 'Creator Energetic', DEFAULT_TEAM_NETWORK_PROPS, energetic),
  fixture('team-network-reduced', 'Reduced motion', DEFAULT_TEAM_NETWORK_PROPS, clean, '16:9', true),
  fixture('team-network-unicode', 'Unicode labels', { ...DEFAULT_TEAM_NETWORK_PROPS, eyebrow: 'ネットワーク', title: 'Equipo conectado · فريق', nodes: DEFAULT_TEAM_NETWORK_PROPS.nodes.map((node, index) => ({ ...node, label: index === 0 ? '中心 Core' : node.label })) }, clean),
])
