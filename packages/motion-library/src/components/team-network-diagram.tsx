import type { CSSProperties } from 'react'
import type { MotionComponentRenderPropsV1, MotionRenderContextV1, MotionStylePackV1, MotionValidationResultV1 } from '@sanverse/motion-contract'
import type { MotionExposureV1, MotionGraphBackedComponentModuleV1, MotionSceneV1 } from '@sanverse/motion-graph'
import { constant, createMotionScene } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND, easeInCubic, easeOutCubic, normalizedProgress, sequenceProgress, staggerProgress } from '@sanverse/motion-primitives'
import { mergeMotionGraphNodeStyle, useMotionGraphPresentation } from '@sanverse/motion-native-runtime'
import { FULL_NATIVE_GRAPH_CAPABILITIES, graphGroup, graphPath, graphShape, graphText, responsiveGraphLayout } from '../graph-common.ts'
import { mConst, mEase, mMultiply, mNumber, mOneMinus, mProgress, mReduced, mSequence, mStagger } from '../graph-motion.ts'
import { SANVERSE_CLEAN_STYLE } from '../style-packs.ts'
import { isRecord, unknownFieldIssues, validationFailure, validationSuccess, valueIssue } from '../validation.ts'

export interface TeamNetworkNode {
  readonly id: string
  readonly label: string
  readonly role: string
}

export interface TeamNetworkConnection {
  readonly from: string
  readonly to: string
}

export interface TeamNetworkDiagramProps {
  readonly eyebrow: string
  readonly title: string
  readonly centerId: string
  readonly nodes: readonly TeamNetworkNode[]
  readonly connections: readonly TeamNetworkConnection[]
}

export interface TeamNetworkDiagramStyle {
  readonly textColor: string
  readonly mutedColor: string
  readonly accentColor: string
  readonly surfaceColor: string
  readonly fontFamily: string
  readonly titleWeight: number
  readonly nodeWeight: number
  readonly motionIntensity: number
}

export interface TeamNetworkPosition {
  readonly id: string
  readonly x: number
  readonly y: number
}

export interface TeamNetworkLayout {
  readonly kind: 'landscape' | 'portrait' | 'square'
  readonly nodeWidth: number
  readonly nodeHeight: number
  readonly centerWidth: number
  readonly centerHeight: number
  readonly titleTop: number
  readonly positions: readonly TeamNetworkPosition[]
}

export interface TeamNetworkDiagramState {
  readonly normalizedProgress: number
  readonly phase: 'enter' | 'hold' | 'exit' | 'ended'
  readonly layout: TeamNetworkLayout
  readonly nodeOpacities: readonly number[]
  readonly edgeProgresses: readonly number[]
}

export const DEFAULT_TEAM_NETWORK_PROPS: TeamNetworkDiagramProps = Object.freeze({
  eyebrow: 'TEAM MAP',
  title: 'One system, connected specialists',
  centerId: 'core',
  nodes: Object.freeze([
    Object.freeze({ id: 'core', label: 'Global knowledge', role: 'Core' }),
    Object.freeze({ id: 'research', label: 'Research', role: 'Agent' }),
    Object.freeze({ id: 'youtube', label: 'YouTube', role: 'Channel' }),
    Object.freeze({ id: 'linkedin', label: 'LinkedIn', role: 'Channel' }),
    Object.freeze({ id: 'iteration', label: 'Iteration', role: 'Loop' }),
  ]),
  connections: Object.freeze([
    Object.freeze({ from: 'core', to: 'research' }),
    Object.freeze({ from: 'core', to: 'youtube' }),
    Object.freeze({ from: 'core', to: 'linkedin' }),
    Object.freeze({ from: 'research', to: 'iteration' }),
    Object.freeze({ from: 'iteration', to: 'youtube' }),
    Object.freeze({ from: 'iteration', to: 'linkedin' }),
  ]),
})

export const teamNetworkDiagramStyleFromPack = (pack: MotionStylePackV1): TeamNetworkDiagramStyle => Object.freeze({
  textColor: pack.tokens.colors.text,
  mutedColor: pack.tokens.colors.textSecondary,
  accentColor: pack.tokens.colors.accent,
  surfaceColor: pack.tokens.colors.surface,
  fontFamily: pack.tokens.typography.bodyFont,
  titleWeight: pack.tokens.typography.headingWeight,
  nodeWeight: pack.tokens.typography.bodyWeight,
  motionIntensity: pack.tokens.motion.intensity,
})

export const DEFAULT_TEAM_NETWORK_STYLE = teamNetworkDiagramStyleFromPack(SANVERSE_CLEAN_STYLE)

const ID_RE = /^[a-z][a-z0-9_-]{0,31}$/u
const colorLike = (value: unknown): value is string => typeof value === 'string' && value.length >= 4 && value.length <= 64
const boundedString = (value: unknown, min: number, max: number): value is string => typeof value === 'string' && value.trim().length >= min && value.length <= max

export const validateTeamNetworkDiagramProps = (input: unknown): MotionValidationResultV1<TeamNetworkDiagramProps> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Team / Network Diagram props must be an object.'))
  const issues = [...unknownFieldIssues(input, ['eyebrow', 'title', 'centerId', 'nodes', 'connections'])]
  if (!boundedString(input.eyebrow, 0, 32)) issues.push(valueIssue('$.eyebrow', 'VALUE_INVALID', 'eyebrow is limited to 32 characters.'))
  if (!boundedString(input.title, 1, 72)) issues.push(valueIssue('$.title', 'VALUE_INVALID', 'title must contain 1–72 characters.'))
  if (typeof input.centerId !== 'string' || !ID_RE.test(input.centerId)) issues.push(valueIssue('$.centerId', 'VALUE_INVALID', 'centerId must be a stable lowercase identifier.'))
  if (!Array.isArray(input.nodes) || input.nodes.length < 3 || input.nodes.length > 8) issues.push(valueIssue('$.nodes', 'VALUE_INVALID', 'Team / Network Diagram requires 3–8 nodes.'))
  if (!Array.isArray(input.connections) || input.connections.length < 2 || input.connections.length > 16) issues.push(valueIssue('$.connections', 'VALUE_INVALID', 'Team / Network Diagram requires 2–16 connections.'))
  const ids = new Set<string>()
  if (Array.isArray(input.nodes)) input.nodes.forEach((raw, index) => {
    if (!isRecord(raw)) { issues.push(valueIssue(`$.nodes[${index}]`, 'TYPE_INVALID', 'Each node must be an object.')); return }
    if (typeof raw.id !== 'string' || !ID_RE.test(raw.id) || ids.has(raw.id)) issues.push(valueIssue(`$.nodes[${index}].id`, 'VALUE_INVALID', 'Node IDs must be unique stable lowercase identifiers.'))
    else ids.add(raw.id)
    if (!boundedString(raw.label, 1, 28)) issues.push(valueIssue(`$.nodes[${index}].label`, 'VALUE_INVALID', 'Node labels are limited to 28 characters.'))
    if (!boundedString(raw.role, 0, 20)) issues.push(valueIssue(`$.nodes[${index}].role`, 'VALUE_INVALID', 'Node roles are limited to 20 characters.'))
  })
  if (typeof input.centerId === 'string' && Array.isArray(input.nodes) && !ids.has(input.centerId)) issues.push(valueIssue('$.centerId', 'VALUE_INVALID', 'centerId must reference one of the nodes.'))
  const connectionKeys = new Set<string>()
  if (Array.isArray(input.connections)) input.connections.forEach((raw, index) => {
    if (!isRecord(raw) || typeof raw.from !== 'string' || typeof raw.to !== 'string') { issues.push(valueIssue(`$.connections[${index}]`, 'TYPE_INVALID', 'Each connection needs from and to IDs.')); return }
    const key = `${raw.from}->${raw.to}`
    if (!ids.has(raw.from) || !ids.has(raw.to)) issues.push(valueIssue(`$.connections[${index}]`, 'VALUE_INVALID', 'Connections must reference existing nodes.'))
    if (raw.from === raw.to) issues.push(valueIssue(`$.connections[${index}]`, 'VALUE_INVALID', 'Self-connections are not supported.'))
    if (connectionKeys.has(key)) issues.push(valueIssue(`$.connections[${index}]`, 'VALUE_INVALID', 'Duplicate connections are not supported.'))
    connectionKeys.add(key)
  })
  if (issues.length > 0) return validationFailure(...issues)
  return validationSuccess(Object.freeze({
    eyebrow: input.eyebrow as string,
    title: input.title as string,
    centerId: input.centerId as string,
    nodes: Object.freeze((input.nodes as TeamNetworkNode[]).map((node) => Object.freeze({ ...node }))),
    connections: Object.freeze((input.connections as TeamNetworkConnection[]).map((connection) => Object.freeze({ ...connection }))),
  }))
}

export const validateTeamNetworkDiagramStyle = (input: unknown): MotionValidationResultV1<TeamNetworkDiagramStyle> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$', 'TYPE_INVALID', 'Team / Network Diagram style must be an object.'))
  const issues = [...unknownFieldIssues(input, ['textColor', 'mutedColor', 'accentColor', 'surfaceColor', 'fontFamily', 'titleWeight', 'nodeWeight', 'motionIntensity'])]
  for (const key of ['textColor', 'mutedColor', 'accentColor', 'surfaceColor'] as const) if (!colorLike(input[key])) issues.push(valueIssue(`$.${key}`, 'VALUE_INVALID', `${key} must be a bounded non-empty string.`))
  if (typeof input.fontFamily !== 'string' || input.fontFamily.trim().length === 0 || input.fontFamily.length > 512) issues.push(valueIssue('$.fontFamily', 'VALUE_INVALID', 'fontFamily must be a bounded non-empty font stack.'))
  for (const key of ['titleWeight', 'nodeWeight'] as const) if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < 100 || input[key] > 1000) issues.push(valueIssue(`$.${key}`, 'VALUE_INVALID', `${key} must be inside [100,1000].`))
  if (typeof input.motionIntensity !== 'number' || !Number.isFinite(input.motionIntensity) || input.motionIntensity < 0 || input.motionIntensity > 1) issues.push(valueIssue('$.motionIntensity', 'VALUE_INVALID', 'motionIntensity must be inside [0,1].'))
  if (issues.length > 0) return validationFailure(...issues)
  return validationSuccess(Object.freeze(input as unknown as TeamNetworkDiagramStyle))
}

const validateContext = (context: MotionRenderContextV1) => {
  if (!Number.isSafeInteger(context.localTicks) || context.localTicks < 0 || context.localTicks > context.durationTicks) throw new RangeError('localTicks must be an exact tick inside the component duration.')
  if (!Number.isSafeInteger(context.durationTicks) || context.durationTicks <= 0) throw new RangeError('durationTicks must be a positive safe integer.')
  if (context.ticksPerSecond !== SANVERSE_TICKS_PER_SECOND) throw new RangeError('Team / Network Diagram requires the canonical Sanverse tick authority.')
}

export const deriveTeamNetworkLayout = (props: TeamNetworkDiagramProps, context: MotionRenderContextV1): TeamNetworkLayout => {
  validateContext(context)
  const { width, height } = context.composition
  const ratio = width / height
  const kind: TeamNetworkLayout['kind'] = ratio > 1.18 ? 'landscape' : ratio < 0.82 ? 'portrait' : 'square'
  const short = Math.min(width, height)
  const nodeWidth = Math.round(Math.max(150, Math.min(260, kind === 'portrait' ? width * 0.28 : short * 0.22)))
  const nodeHeight = Math.round(Math.max(78, Math.min(118, short * 0.105)))
  const centerWidth = Math.round(nodeWidth * 1.15)
  const centerHeight = Math.round(nodeHeight * 1.08)
  const titleTop = Math.round(height * 0.095)
  const centerX = width / 2
  const centerY = kind === 'portrait' ? height * 0.51 : height * 0.54
  const others = props.nodes.filter((node) => node.id !== props.centerId)
  const positions = new Map<string, TeamNetworkPosition>()
  positions.set(props.centerId, Object.freeze({ id: props.centerId, x: centerX, y: centerY }))
  if (kind === 'portrait') {
    const usableTop = height * 0.28
    const usableBottom = height * 0.78
    const count = others.length
    others.forEach((node, index) => {
      const row = count === 1 ? 0.5 : index / Math.max(1, count - 1)
      const side = index % 2 === 0 ? -1 : 1
      positions.set(node.id, Object.freeze({ id: node.id, x: centerX + side * width * 0.25, y: usableTop + (usableBottom - usableTop) * row }))
    })
  } else {
    const rx = kind === 'landscape' ? width * 0.31 : width * 0.30
    const ry = kind === 'landscape' ? height * 0.26 : height * 0.29
    const count = others.length
    others.forEach((node, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count
      positions.set(node.id, Object.freeze({ id: node.id, x: centerX + Math.cos(angle) * rx, y: centerY + Math.sin(angle) * ry }))
    })
  }
  const ordered = props.nodes.map((node) => positions.get(node.id)!).filter(Boolean)
  for (const position of ordered) {
    const w = position.id === props.centerId ? centerWidth : nodeWidth
    const h = position.id === props.centerId ? centerHeight : nodeHeight
    if (position.x - w / 2 < width * 0.035 || position.x + w / 2 > width * 0.965 || position.y - h / 2 < titleTop + short * 0.08 || position.y + h / 2 > height * 0.94) {
      throw new RangeError('CONTENT_IMPOSSIBLE: analytic network nodes cannot fit this composition at readable sizes.')
    }
  }
  return Object.freeze({ kind, nodeWidth, nodeHeight, centerWidth, centerHeight, titleTop, positions: Object.freeze(ordered) })
}

export const validateTeamNetworkDiagramFit = (props: TeamNetworkDiagramProps, context: MotionRenderContextV1): MotionValidationResultV1<TeamNetworkLayout> => {
  try { return validationSuccess(deriveTeamNetworkLayout(props, context)) }
  catch (error) { return validationFailure(valueIssue('$', 'CONTENT_IMPOSSIBLE', error instanceof Error ? error.message.replace(/^CONTENT_IMPOSSIBLE:\s*/u, '') : 'Network cannot fit this composition.')) }
}

const edgeId = (connection: TeamNetworkConnection, index: number) => `team-network.edge:${connection.from}:${connection.to}:${index + 1}`
const nodeGroupId = (id: string) => `team-network.node:${id}`

export const createTeamNetworkDiagramScene = (props: TeamNetworkDiagramProps, style: TeamNetworkDiagramStyle, context: MotionRenderContextV1): MotionSceneV1 => {
  const layout = deriveTeamNetworkLayout(props, context)
  const rootId = 'team-network.root'
  const headerId = 'team-network.header'
  const eyebrowId = 'team-network.eyebrow'
  const titleId = 'team-network.title'
  const edgesId = 'team-network.edges'
  const nodesId = 'team-network.nodes'
  const nodeIds = props.nodes.map((node) => nodeGroupId(node.id))
  const edgeIds = props.connections.map(edgeId)
  const root = graphGroup(rootId, 'Team / Network Diagram', null, [headerId, edgesId, nodesId])
  const header = graphGroup(headerId, 'Header', rootId, [eyebrowId, titleId])
  const eyebrow = graphText({ id: eyebrowId, name: 'Eyebrow', parentId: headerId, text: props.eyebrow, color: style.accentColor, fontFamily: style.fontFamily, fontSize: Math.round(Math.min(context.composition.width, context.composition.height) * 0.021), fontWeight: 800, textAlign: 'center' })
  const title = graphText({ id: titleId, name: 'Title', parentId: headerId, text: props.title, color: style.textColor, fontFamily: style.fontFamily, fontSize: Math.round(Math.min(context.composition.width, context.composition.height) * 0.048), fontWeight: style.titleWeight, textAlign: 'center' })
  const edges = graphGroup(edgesId, 'Connections', rootId, edgeIds)
  const positionById = new Map(layout.positions.map((position) => [position.id, position]))
  const edgeNodes = Object.fromEntries(props.connections.map((connection, index) => {
    const from = positionById.get(connection.from)!
    const to = positionById.get(connection.to)!
    const base = graphPath({ id: edgeIds[index]!, name: `${connection.from} → ${connection.to}`, parentId: edgesId, pathData: `M ${from.x} ${from.y} L ${to.x} ${to.y}`, fillColor: 'transparent', strokeColor: `${style.accentColor}88`, strokeWidth: Math.max(2, Math.round(Math.min(context.composition.width, context.composition.height) * 0.0025)) })
    const progress = mReduced(mConst(1), mEase('ease-out-cubic', mStagger(mSequence(0.10, 0.50, mProgress()), index, props.connections.length, 0.55)))
    return [base.id, Object.freeze({ ...base, trimProgress: mNumber(progress), opacity: mNumber(mMultiply(progress, mOneMinus(mEase('ease-in-cubic', mSequence(0.84, 1, mProgress()))))) })]
  }))
  const nodesGroup = graphGroup(nodesId, 'Nodes', rootId, nodeIds)
  const nodeRecords: Record<string, ReturnType<typeof graphGroup> | ReturnType<typeof graphShape> | ReturnType<typeof graphText>> = {}
  props.nodes.forEach((node, index) => {
    const groupId = nodeGroupId(node.id)
    const surfaceId = `${groupId}.surface`
    const labelId = `${groupId}.label`
    const roleId = `${groupId}.role`
    const position = positionById.get(node.id)!
    const isCenter = node.id === props.centerId
    const width = isCenter ? layout.centerWidth : layout.nodeWidth
    const height = isCenter ? layout.centerHeight : layout.nodeHeight
    const groupBase = graphGroup(groupId, node.label, nodesId, [surfaceId, labelId, roleId])
    const reveal = mReduced(mConst(1), mEase('ease-out-cubic', mStagger(mSequence(0.08, 0.46, mProgress()), index, props.nodes.length, 0.52)))
    const group = Object.freeze({ ...groupBase, opacity: mNumber(mMultiply(reveal, mOneMinus(mEase('ease-in-cubic', mSequence(0.84, 1, mProgress()))))), transform: Object.freeze({ ...groupBase.transform, positionX: constant(position.x - width / 2), positionY: constant(position.y - height / 2), scaleX: mNumber(mReduced(mConst(1), mMultiply(mConst(0.94), mOneMinus(mMultiply(mConst(-0.063829787), reveal))))), scaleY: mNumber(mReduced(mConst(1), mMultiply(mConst(0.94), mOneMinus(mMultiply(mConst(-0.063829787), reveal))))) }) })
    const surface = graphShape({ id: surfaceId, name: `${node.label} Surface`, parentId: groupId, width, height, fillColor: isCenter ? `${style.accentColor}16` : style.surfaceColor, strokeColor: isCenter ? style.accentColor : `${style.textColor}26`, strokeWidth: isCenter ? 3 : 2, radius: Math.round(height * 0.25) })
    const label = graphText({ id: labelId, name: `${node.label} Label`, parentId: groupId, text: node.label, color: style.textColor, fontFamily: style.fontFamily, fontSize: Math.round(height * 0.23), fontWeight: isCenter ? style.titleWeight : style.nodeWeight, textAlign: 'center' })
    const role = graphText({ id: roleId, name: `${node.label} Role`, parentId: groupId, text: node.role, color: isCenter ? style.accentColor : style.mutedColor, fontFamily: style.fontFamily, fontSize: Math.round(height * 0.145), fontWeight: 700, textAlign: 'center' })
    nodeRecords[group.id] = group
    nodeRecords[surface.id] = surface
    nodeRecords[label.id] = label
    nodeRecords[role.id] = role
  })
  const exposures: MotionExposureV1[] = [
    { id: 'team-network.eyebrow', label: 'Eyebrow', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'eyebrow' }, editor: { type: 'text' }, keyframeable: false },
    { id: 'team-network.title', label: 'Title', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'title' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: 'team-network.nodes', label: 'Nodes', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'nodes' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: 'team-network.connections', label: 'Connections', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'connections' }, editor: { type: 'textarea' }, keyframeable: false },
    { id: 'team-network.center', label: 'Center node ID', group: 'Content', level: 'creator', target: { kind: 'component', propertyId: 'centerId' }, editor: { type: 'text' }, keyframeable: false },
    { id: 'team-network.text-color', label: 'Text color', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'textColor' }, editor: { type: 'color' }, keyframeable: false },
    { id: 'team-network.accent-color', label: 'Accent color', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'accentColor' }, editor: { type: 'color' }, keyframeable: false },
    { id: 'team-network.position-x', label: 'Position X', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'transform.positionX' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: -500, maximum: 500, step: 1 } },
    { id: 'team-network.position-y', label: 'Position Y', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'transform.positionY' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: -500, maximum: 500, step: 1 } },
    { id: 'team-network.opacity', label: 'Overall opacity', group: 'Transform', level: 'designer', target: { kind: 'node', nodeId: rootId, property: 'opacity' }, editor: { type: 'slider' }, keyframeable: true, constraints: { minimum: 0, maximum: 1, step: 0.01 } },
    { id: 'team-network.parts', label: 'Network parts', group: 'Parts', level: 'advanced', target: { kind: 'part', semanticPartId: 'nodes', property: 'opacity' }, editor: { type: 'readonly' }, keyframeable: true },
  ]
  return createMotionScene({
    componentId: 'sanverse.team-network-diagram', componentVersion: 1, rootNodeId: rootId,
    nodes: Object.freeze({ [root.id]: root, [header.id]: header, [eyebrow.id]: eyebrow, [title.id]: title, [edges.id]: edges, ...edgeNodes, [nodesGroup.id]: nodesGroup, ...nodeRecords }),
    semanticParts: Object.freeze([
      { id: 'header', label: 'Header', role: 'primary-text', nodeIds: Object.freeze([headerId, eyebrowId, titleId]) },
      { id: 'connections', label: 'Connections', role: 'decoration', nodeIds: Object.freeze([edgesId, ...edgeIds]) },
      { id: 'nodes', label: 'Nodes', role: 'content-group', nodeIds: Object.freeze([nodesId, ...Object.keys(nodeRecords)]) },
      { id: 'centerNode', label: 'Center Node', role: 'accent', nodeIds: Object.freeze([nodeGroupId(props.centerId)]) },
    ]),
    exposures: Object.freeze(exposures), layout: responsiveGraphLayout(), supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5']),
  })
}

export const evaluateTeamNetworkDiagramState = (props: TeamNetworkDiagramProps, style: TeamNetworkDiagramStyle, context: MotionRenderContextV1): TeamNetworkDiagramState => {
  validateContext(context)
  const propsValidation = validateTeamNetworkDiagramProps(props)
  if (!propsValidation.ok) throw new RangeError(propsValidation.issues[0]?.message ?? 'Invalid Team / Network Diagram props.')
  const styleValidation = validateTeamNetworkDiagramStyle(style)
  if (!styleValidation.ok) throw new RangeError(styleValidation.issues[0]?.message ?? 'Invalid Team / Network Diagram style.')
  const p = normalizedProgress(context.localTicks, context.durationTicks)
  const exitFade = easeInCubic(sequenceProgress(p, 0.84, 1))
  const nodeWindow = sequenceProgress(p, 0.08, 0.46)
  const edgeWindow = sequenceProgress(p, 0.10, 0.50)
  return Object.freeze({
    normalizedProgress: p,
    phase: p < 0.55 ? 'enter' : p < 0.84 ? 'hold' : p < 1 ? 'exit' : 'ended',
    layout: deriveTeamNetworkLayout(props, context),
    nodeOpacities: Object.freeze(props.nodes.map((_, index) => (context.reducedMotion ? 1 : easeOutCubic(staggerProgress({ progress: nodeWindow, index, count: props.nodes.length, overlap: 0.52 }))) * (1 - exitFade))),
    edgeProgresses: Object.freeze(props.connections.map((_, index) => context.reducedMotion ? 1 : easeOutCubic(staggerProgress({ progress: edgeWindow, index, count: props.connections.length, overlap: 0.55 })))),
  })
}

export function TeamNetworkDiagram({ props, style, context }: MotionComponentRenderPropsV1<TeamNetworkDiagramProps, TeamNetworkDiagramStyle>) {
  const state = evaluateTeamNetworkDiagramState(props, style, context)
  const graph = useMotionGraphPresentation()
  const graphStyle = (id: string, base: CSSProperties): CSSProperties => mergeMotionGraphNodeStyle(base, graph.scene?.nodes[id] ?? null, graph.selectedNodeId === id)
  const { width, height } = context.composition
  const positionById = new Map(state.layout.positions.map((position) => [position.id, position]))
  return (
    <div data-motion-root="team-network-diagram" data-motion-layout={state.layout.kind} data-motion-node-id="team-network.root" style={graphStyle('team-network.root', { position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: style.fontFamily, color: style.textColor })}>
      <div data-motion-node-id="team-network.header" style={graphStyle('team-network.header', { position: 'absolute', top: state.layout.titleTop, left: '8%', right: '8%', textAlign: 'center', zIndex: 3 })}>
        {props.eyebrow.trim() ? <div data-motion-node-id="team-network.eyebrow" style={graphStyle('team-network.eyebrow', { color: style.accentColor, fontSize: Math.round(Math.min(width, height) * 0.021), fontWeight: 800, letterSpacing: '.12em' })}>{props.eyebrow}</div> : null}
        <div data-motion-node-id="team-network.title" style={graphStyle('team-network.title', { marginTop: 10, color: style.textColor, fontSize: Math.round(Math.min(width, height) * 0.048), fontWeight: style.titleWeight, letterSpacing: '-.035em' })}>{props.title}</div>
      </div>
      <svg data-motion-node-id="team-network.edges" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={graphStyle('team-network.edges', { position: 'absolute', inset: 0, overflow: 'visible' })}>
        {props.connections.map((connection, index) => {
          const from = positionById.get(connection.from)!
          const to = positionById.get(connection.to)!
          const id = edgeId(connection, index)
          const node = graph.scene?.nodes[id]
          const path = node?.type === 'path' ? node : null
          return <path key={id} data-motion-node-id={id} d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} fill="none" stroke={path?.strokeColor ?? `${style.accentColor}88`} strokeWidth={path?.strokeWidth ?? 3} strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - (path?.trimProgress ?? state.edgeProgresses[index]!)} style={graphStyle(id, {})} />
        })}
      </svg>
      <div data-motion-node-id="team-network.nodes" style={graphStyle('team-network.nodes', { position: 'absolute', inset: 0, zIndex: 2 })}>
        {props.nodes.map((node) => {
          const groupId = nodeGroupId(node.id)
          const surfaceId = `${groupId}.surface`
          const labelId = `${groupId}.label`
          const roleId = `${groupId}.role`
          const isCenter = node.id === props.centerId
          const nodeWidth = isCenter ? state.layout.centerWidth : state.layout.nodeWidth
          const nodeHeight = isCenter ? state.layout.centerHeight : state.layout.nodeHeight
          const surface = graph.scene?.nodes[surfaceId]
          const shape = surface?.type === 'shape' ? surface : null
          return <div key={node.id} data-motion-node-id={groupId} style={graphStyle(groupId, { position: 'absolute', width: nodeWidth, height: nodeHeight, transformOrigin: '50% 50%' })}>
            <div data-motion-node-id={surfaceId} style={graphStyle(surfaceId, { position: 'absolute', inset: 0, borderRadius: shape?.radius ?? Math.round(nodeHeight * 0.25), borderStyle: 'solid', borderWidth: shape?.strokeWidth ?? (isCenter ? 3 : 2), borderColor: shape?.strokeColor ?? (isCenter ? style.accentColor : `${style.textColor}26`), background: shape?.fillColor ?? (isCenter ? `${style.accentColor}16` : style.surfaceColor), boxShadow: isCenter ? `0 0 ${Math.round(nodeHeight * 0.6)}px ${style.accentColor}18` : '0 18px 42px rgba(0,0,0,.22)' })} />
            <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'grid', placeContent: 'center', textAlign: 'center', padding: '10px 14px' }}>
              <div data-motion-node-id={labelId} style={graphStyle(labelId, { color: style.textColor, fontSize: Math.round(nodeHeight * 0.23), lineHeight: 1.08, fontWeight: isCenter ? style.titleWeight : style.nodeWeight, letterSpacing: '-.02em' })}>{node.label}</div>
              {node.role.trim() ? <div data-motion-node-id={roleId} style={graphStyle(roleId, { marginTop: 7, color: isCenter ? style.accentColor : style.mutedColor, fontSize: Math.round(nodeHeight * 0.145), fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' })}>{node.role}</div> : null}
            </div>
          </div>
        })}
      </div>
    </div>
  )
}

export const TEAM_NETWORK_DIAGRAM_DEFINITION = Object.freeze({
  id: 'sanverse.team-network-diagram', version: 1, name: 'Team / Network Diagram', purpose: 'Show a central team, system or idea connected to specialists, channels or dependent nodes.', category: 'diagram', performanceClass: 'light',
  supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5'] as const),
  minDurationTicks: SANVERSE_TICKS_PER_SECOND * 2, defaultDurationTicks: SANVERSE_TICKS_PER_SECOND * 6, maxDurationTicks: SANVERSE_TICKS_PER_SECOND * 18,
  events: Object.freeze([{ name: 'enter-start', normalizedTime: 0 }, { name: 'nodes-start', normalizedTime: 0.08 }, { name: 'connections-start', normalizedTime: 0.10 }, { name: 'settled', normalizedTime: 0.55 }, { name: 'exit-start', normalizedTime: 0.84 }]),
  contentLimits: Object.freeze([{ field: 'title', description: 'Primary diagram title.', minimum: 1, maximum: 72, unit: 'characters' as const }, { field: 'nodes', description: 'Network nodes.', minimum: 3, maximum: 8, unit: 'items' as const }, { field: 'connections', description: 'Directed network relationships.', minimum: 2, maximum: 16, unit: 'items' as const }]),
  capabilities: FULL_NATIVE_GRAPH_CAPABILITIES,
} as const)

export const TeamNetworkDiagramModule: MotionGraphBackedComponentModuleV1<TeamNetworkDiagramProps, TeamNetworkDiagramStyle> = Object.freeze({
  definition: TEAM_NETWORK_DIAGRAM_DEFINITION,
  defaultProps: DEFAULT_TEAM_NETWORK_PROPS,
  defaultStyle: DEFAULT_TEAM_NETWORK_STYLE,
  validateProps: validateTeamNetworkDiagramProps,
  validateStyle: validateTeamNetworkDiagramStyle,
  Component: TeamNetworkDiagram,
  createScene: createTeamNetworkDiagramScene,
})
