import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, ReactNode } from 'react'
import type { MotionAspectRatio, MotionExposureLevel, MotionStylePackV1 } from '@sanverse/motion-contract'
import { applyMotionOperations, constant, createDefaultEffect, createDefaultMask, createMotionAuthoringMetadata, createMotionKeyframeSelection, createMotionSelectionState, evaluateScene, projectMotionLayers, selectMotionNode, selectMotionNodeRange, selectionFallbackAfterDelete, setMotionNodeLocked, toggleMotionNodeSelection } from '@sanverse/motion-graph'
import type { MotionAuthoringMetadataV1, MotionExposureV1, MotionGraphOperationV1, MotionKeyframeSelectionStateV1, MotionNodePropertyNameV1, MotionPropertyPrimitiveV1, MotionSceneV1, MotionSelectionStateV1, ResolvedMotionNodeV1 } from '@sanverse/motion-graph'
import {
  CHECKLIST_CARD_DEFINITION,
  ChecklistCardModule,
  DEFAULT_TEAM_NETWORK_PROPS,
  COST_VALUE_CARD_DEFINITION,
  C2_COST_CARD_KEYFRAME_PROOF_OPERATIONS,
  C2_COST_CARD_PROOF_DURATION_TICKS,
  CostValueCardModule,
  CREATOR_ENERGETIC_STYLE,
  INITIAL_MOTION_STYLE_PACKS,
  FAMILY_COMPONENT_MODULES_BY_ID,
  KINETIC_HEADLINE_DEFINITION,
  KineticHeadlineModule,
  MOTION_COMPONENT_CATALOG,
  MOTION_REFERENCE_COMPOSITIONS,
  SANVERSE_CLEAN_STYLE,
  TIMER_STATUS_PILL_DEFINITION,
  TimerStatusPillModule,
  TEAM_NETWORK_DIAGRAM_DEFINITION,
  TeamNetworkDiagramModule,
  checklistCardStyleFromPack,
  costValueCardStyleFromPack,
  evaluateChecklistCardState,
  evaluateCostValueCardState,
  evaluateKineticHeadlineState,
  evaluateTimerStatusPillState,
  evaluateTeamNetworkDiagramState,
  evaluateFamilyComponentState,
  familyComponentStyleFromPack,
  kineticHeadlineStyleFromPack,
  timerStatusPillStyleFromPack,
  teamNetworkDiagramStyleFromPack,
  tokenizeHeadline,
  validateChecklistCardFit,
  validateCostValueCardFit,
  validateKineticHeadlineFit,
  validateTimerStatusPillFit,
  validateTeamNetworkDiagramFit,
} from '@sanverse/motion-library'
import type {
  ChecklistCardProps,
  ChecklistCardStyle,
  CostValueCardProps,
  CostValueCardStyle,
  KineticHeadlineProps,
  KineticHeadlineStyle,
  TimerStatusPillProps,
  TimerStatusPillStyle,
  TeamNetworkDiagramProps,
  TeamNetworkDiagramStyle,
  FamilyComponentProps,
  FamilyComponentStyle,
} from '@sanverse/motion-library'
import {
  MotionCenterGuides,
  MotionComponentHost,
  MotionCompositionFrame,
  MotionDebugBounds,
  MotionGridOverlay,
  MotionSafeArea,
  MotionSelectionOverlay,
} from '@sanverse/motion-native-runtime'
import { SANVERSE_TICKS_PER_SECOND, frameForTicks } from '@sanverse/motion-primitives'
import { PLAYBACK_SPEEDS, advancePlaybackTicks, clampExactTick, resolveInitialTick, stepFrame } from './transport.ts'
import type { PlaybackSpeed } from './transport.ts'
import { GraphInspector, previewOperatedScene } from './GraphInspector.tsx'
import { KeyframeTimeline } from './KeyframeTimeline.tsx'
import { OperationPlayground } from './OperationPlayground.tsx'
import { LayerPanel } from './LayerPanel.tsx'
import type { LayerDropIntent } from './LayerPanel.tsx'
import { CompositorInspector } from './CompositorInspector.tsx'
import { AnimationDopeSheet } from './AnimationDopeSheet.tsx'
import { MotionCurveEditor } from './MotionCurveEditor.tsx'
import { createCompositorHistory, pushCompositorHistory, redoCompositorHistory, undoCompositorHistory } from './compositor-history.ts'
import type { MotionLabCompositorSnapshotV1 } from './compositor-history.ts'

const ratioOrder: readonly MotionAspectRatio[] = ['16:9', '9:16', '1:1', '4:5']
const backgroundOptions = ['black', 'white', 'neutral', 'busy'] as const
type PreviewBackground = (typeof backgroundOptions)[number]

type MotionLabComponentId = `sanverse.${string}`

const initialSearch = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
const requestedComponent = initialSearch.get('component')
const requestedComponentId = requestedComponent ? (requestedComponent.startsWith('sanverse.') ? requestedComponent : `sanverse.${requestedComponent}`) as MotionLabComponentId : null
const initialComponentId: MotionLabComponentId = requestedComponentId && MOTION_COMPONENT_CATALOG.some((component) => component.id === requestedComponentId)
  ? requestedComponentId
  : 'sanverse.kinetic-headline'
const initialDefinition = MOTION_COMPONENT_CATALOG.find((component) => component.id === initialComponentId) ?? KINETIC_HEADLINE_DEFINITION
const initialC2CostProof = initialSearch.get('proof') === 'c2-cost' && initialComponentId === 'sanverse.cost-value-card'
const initialDurationSeconds = initialC2CostProof ? C2_COST_CARD_PROOF_DURATION_TICKS / SANVERSE_TICKS_PER_SECOND : Math.max(1, Math.round(initialDefinition.defaultDurationTicks / SANVERSE_TICKS_PER_SECOND))
const initialGraphOperations: readonly MotionGraphOperationV1[] = initialC2CostProof ? C2_COST_CARD_KEYFRAME_PROOF_OPERATIONS : Object.freeze([])
const initialSelectedGraphNodeId = initialSearch.get('node') || null
const initialRatio = ((): MotionAspectRatio => {
  const value = initialSearch.get('ratio')
  return ratioOrder.includes(value as MotionAspectRatio) ? value as MotionAspectRatio : '16:9'
})()
const initialBackground = ((): PreviewBackground => {
  const value = initialSearch.get('background')
  return backgroundOptions.includes(value as PreviewBackground) ? value as PreviewBackground : 'black'
})()
const initialReducedMotion = initialSearch.get('reduced') === '1'
const styleSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')
const requestedStyle = initialSearch.get('style')
const initialStylePackId = INITIAL_MOTION_STYLE_PACKS.find((pack) => requestedStyle && (
  pack.id === requestedStyle || pack.id.endsWith(`.${requestedStyle}`) || styleSlug(pack.name) === requestedStyle || (requestedStyle === 'energetic' && pack.id === CREATOR_ENERGETIC_STYLE.id)
))?.id ?? SANVERSE_CLEAN_STYLE.id
const initialText = initialSearch.get('text') ?? 'Build videos 10× faster'
const initialEmphasisText = initialSearch.get('emphasis') ?? '2'
const initialEmphasisTreatment: NonNullable<KineticHeadlineProps['emphasisTreatment']> = initialSearch.get('treatment') === 'highlight-box' ? 'highlight-box' : 'accent-text'
const initialMaxLines = ((): KineticHeadlineProps['maxLines'] => {
  const value = Number(initialSearch.get('maxLines'))
  return value === 1 || value === 2 || value === 3 ? value : 2
})()
const initialExactTick = resolveInitialTick(
  initialSearch.get('tick'),
  SANVERSE_TICKS_PER_SECOND * initialDurationSeconds,
  initialComponentId === 'sanverse.checklist-card'
    ? 0.62
    : initialComponentId === 'sanverse.cost-value-card'
      ? 0.60
      : initialComponentId === 'sanverse.timer-status-pill'
        ? 0.76
        : initialComponentId === 'sanverse.team-network-diagram'
          ? 0.55
          : FAMILY_COMPONENT_MODULES_BY_ID[initialComponentId]
            ? 0.56
            : 0.30,
)

const DEFAULT_CHECKLIST_ROWS = [
  'Hook is clear in the first five seconds',
  'Visual changes support the point',
  'Call to action matches the viewer intent',
] as const
const MAX_CHECKLIST_ROWS = [
  'Hook earns attention immediately',
  'Voice is clear and balanced',
  'Captions are readable and timed',
  'Visuals support each main idea',
  'Pacing keeps the explanation moving',
  'Final call to action is specific',
] as const
const checklistPreset = initialSearch.get('checklist')
const initialChecklistRows = checklistPreset === 'max'
  ? MAX_CHECKLIST_ROWS
  : checklistPreset === 'invalid'
    ? ["X".repeat(72)]
    : DEFAULT_CHECKLIST_ROWS
const initialChecklistCompleted = checklistPreset === 'max' ? 4 : checklistPreset === 'invalid' ? 0 : 2
const timerPreset = initialSearch.get('timer')
const initialTimerLabel = timerPreset === 'invalid' ? 'X'.repeat(33) : timerPreset === 'max' ? 'LONG SESSION' : 'RECORDING WINDOW'
const initialTimerMode: TimerStatusPillProps['mode'] = timerPreset === 'countup' ? 'countup' : 'countdown'
const initialTimerSeconds = timerPreset === 'max' ? 359_999 : 90
const initialTimerShowHours = timerPreset === 'max'
const initialFamilyModule = FAMILY_COMPONENT_MODULES_BY_ID[initialComponentId] ?? FAMILY_COMPONENT_MODULES_BY_ID['sanverse.section-title']!
const initialCreativePlacementId = initialSearch.get('creativePlacement')
const initialFamilyProps: FamilyComponentProps = initialCreativePlacementId ? Object.freeze({
  ...initialFamilyModule.defaultProps,
  ...(initialSearch.get('storyTitle') ? { title: initialSearch.get('storyTitle')! } : {}),
  ...(initialSearch.get('storySubtitle') ? { subtitle: initialSearch.get('storySubtitle')! } : {}),
  ...(initialSearch.get('storyItems') ? { items: Object.freeze(initialSearch.get('storyItems')!.split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean)) } : {}),
  ...(initialSearch.get('storyValue') ? { value: initialSearch.get('storyValue')! } : {}),
  ...(initialSearch.get('storyPlacement') ? { placement: initialSearch.get('storyPlacement') as FamilyComponentProps['placement'] } : {}),
}) : initialFamilyModule.defaultProps
const networkPreset = initialSearch.get('network')
const initialNetworkProps: TeamNetworkDiagramProps = networkPreset === 'invalid'
  ? { ...DEFAULT_TEAM_NETWORK_PROPS, nodes: DEFAULT_TEAM_NETWORK_PROPS.nodes.map((node, index) => index === 0 ? { ...node, label: 'X'.repeat(29) } : node) }
  : DEFAULT_TEAM_NETWORK_PROPS
const networkNodesToText = (nodes: readonly TeamNetworkDiagramProps['nodes'][number][]) => nodes.map((node) => `${node.id}|${node.label}|${node.role}`).join('\n')
const networkConnectionsToText = (connections: readonly TeamNetworkDiagramProps['connections'][number][]) => connections.map((connection) => `${connection.from}>${connection.to}`).join('\n')
const parseNetworkNodesText = (value: string): TeamNetworkDiagramProps['nodes'] => Object.freeze(value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).map((line) => {
  const [id = '', label = '', role = ''] = line.split('|').map((piece) => piece.trim())
  return Object.freeze({ id, label, role })
}))
const parseNetworkConnectionsText = (value: string): TeamNetworkDiagramProps['connections'] => Object.freeze(value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).map((line) => {
  const [from = '', to = ''] = line.split('>').map((piece) => piece.trim())
  return Object.freeze({ from, to })
}))

const previewBackgroundStyle = (background: PreviewBackground): CSSProperties => {
  if (background === 'white') return { background: '#f4f4f1' }
  if (background === 'neutral') return { background: '#777' }
  if (background === 'busy') {
    return {
      backgroundColor: '#252525',
      backgroundImage:
        'radial-gradient(circle at 18% 22%, rgba(255,95,82,.72) 0 8%, transparent 9%), radial-gradient(circle at 76% 28%, rgba(85,185,255,.72) 0 12%, transparent 13%), linear-gradient(135deg, #161616 0 22%, #343434 22% 42%, #181818 42% 64%, #4b4b4b 64% 78%, #202020 78%)',
    }
  }
  return { background: '#050505' }
}

const stylePackById = (id: string): MotionStylePackV1 =>
  INITIAL_MOTION_STYLE_PACKS.find((pack) => pack.id === id) ?? SANVERSE_CLEAN_STYLE

const COMMON_LAB_EXPOSURES: readonly MotionExposureV1[] = Object.freeze([
  { id: 'common.style-pack', label: 'Style pack', group: 'Style', level: 'creator', target: { kind: 'component', propertyId: 'stylePackId' }, editor: { type: 'select', options: Object.freeze(INITIAL_MOTION_STYLE_PACKS.map((pack) => Object.freeze({ label: pack.name, value: pack.id }))) }, keyframeable: false },
  { id: 'common.duration', label: 'Duration', group: 'Motion', level: 'creator', target: { kind: 'component', propertyId: 'durationSeconds' }, editor: { type: 'slider' }, keyframeable: false, constraints: { minimum: 1, maximum: 30, step: 1 } },
  { id: 'common.reduced-motion', label: 'Reduced motion', group: 'Motion', level: 'designer', target: { kind: 'component', propertyId: 'reducedMotion' }, editor: { type: 'toggle' }, keyframeable: false },
])

const parseEmphasisIndices = (value: string): readonly number[] => {
  if (!value.trim()) return []
  const parsed = value
    .split(',')
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece) => Number(piece))
  if (parsed.some((value) => !Number.isSafeInteger(value))) return []
  return Object.freeze([...new Set(parsed)])
}

const nodeSupportsProperty = (node: ResolvedMotionNodeV1, property: MotionNodePropertyNameV1): boolean => {
  if (property === 'visible' || property === 'opacity' || property.startsWith('transform.')) return true
  if (node.type === 'text') return property.startsWith('text.')
  if (node.type === 'shape') return property.startsWith('shape.')
  if (node.type === 'path') return property.startsWith('path.')
  return node.type === 'image' && property === 'image.opacity'
}

const resolvedNodeProperty = (node: ResolvedMotionNodeV1, property: MotionNodePropertyNameV1): MotionPropertyPrimitiveV1 | null => {
  if (property === 'visible') return node.visible
  if (property === 'opacity') return node.opacity
  if (property === 'transform.positionX') return node.transform.positionX
  if (property === 'transform.positionY') return node.transform.positionY
  if (property === 'transform.scaleX') return node.transform.scaleX
  if (property === 'transform.scaleY') return node.transform.scaleY
  if (property === 'transform.rotationDeg') return node.transform.rotationDeg
  if (property === 'transform.anchorX') return node.transform.anchorX
  if (property === 'transform.anchorY') return node.transform.anchorY
  if (node.type === 'text') {
    if (property === 'text.text') return node.text
    if (property === 'text.fillColor') return node.fillColor
    if (property === 'text.fontSize') return node.fontSize
    if (property === 'text.fontWeight') return node.fontWeight
  }
  if (node.type === 'shape') {
    if (property === 'shape.fillColor') return node.fillColor
    if (property === 'shape.strokeColor') return node.strokeColor
    if (property === 'shape.strokeWidth') return node.strokeWidth
    if (property === 'shape.radius') return node.radius
  }
  if (node.type === 'path') {
    if (property === 'path.fillColor') return node.fillColor
    if (property === 'path.strokeColor') return node.strokeColor
    if (property === 'path.strokeWidth') return node.strokeWidth
    if (property === 'path.trimProgress') return node.trimProgress
  }
  if (node.type === 'image' && property === 'image.opacity') return node.imageOpacity
  return null
}

const operationIdentity = (operation: MotionGraphOperationV1): string | null => {
  if (operation.type === 'set-property' || operation.type === 'reset-property') return `property:${operation.target.nodeId}:${operation.target.property}`
  if (operation.type === 'set-node-enabled') return `node-enabled:${operation.nodeId}`
  if (operation.type === 'set-effect-property') return `effect-property:${operation.nodeId}:${operation.effectId}:${operation.parameter}`
  if (operation.type === 'set-effect-enabled') return `effect-enabled:${operation.nodeId}:${operation.effectId}`
  if (operation.type === 'set-mask-property') return `mask-property:${operation.nodeId}:${operation.maskId}:${operation.property}`
  if (operation.type === 'set-blend-mode') return `blend:${operation.nodeId}`
  if (operation.type === 'reorder-effect') return `effect-order:${operation.nodeId}:${operation.effectId}`
  if (operation.type === 'reorder-mask') return `mask-order:${operation.nodeId}:${operation.maskId}`
  if (operation.type === 'reorder-node') return `node-order:${operation.nodeId}`
  return null
}

function Toggle({ checked, onChange, children }: Readonly<{ checked: boolean; onChange: (checked: boolean) => void; children: string }>) {
  return (
    <label className="motion-lab__toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

function FieldLabel({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="motion-lab__field-label">{children}</span>
}

export function MotionLabApp() {
  const [selectedComponentId, setSelectedComponentId] = useState<MotionLabComponentId>(initialComponentId)
  const [componentSearch, setComponentSearch] = useState('')
  const [ratio, setRatio] = useState<MotionAspectRatio>(initialRatio)
  const composition = MOTION_REFERENCE_COMPOSITIONS[ratio]
  const [durationSeconds, setDurationSeconds] = useState(initialDurationSeconds)
  const durationTicks = durationSeconds * SANVERSE_TICKS_PER_SECOND
  const [localTicks, setLocalTicks] = useState(initialExactTick)
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion)
  const [background, setBackground] = useState<PreviewBackground>(initialBackground)
  const [exposureLevel, setExposureLevel] = useState<MotionExposureLevel>(initialSearch.get('level') === 'advanced' || initialSearch.get('level') === 'compositor' ? 'advanced' : initialSearch.get('level') === 'designer' ? 'designer' : 'creator')
  const [compositorMode, setCompositorMode] = useState(initialSearch.get('level') === 'compositor')
  const [keyframeSelection, setKeyframeSelection] = useState<MotionKeyframeSelectionStateV1>(() => createMotionKeyframeSelection())
  const [selectedAnimationTrackId, setSelectedAnimationTrackId] = useState<string | null>(null)
  const [animationPanelMode, setAnimationPanelMode] = useState<'timeline' | 'curves'>(initialSearch.get('panel') === 'curves' || initialSearch.get('c5') === '1' ? 'curves' : 'timeline')
  const [graphOperations, setGraphOperations] = useState<readonly MotionGraphOperationV1[]>(initialGraphOperations)
  const [graphOperationError, setGraphOperationError] = useState<string | null>(null)
  const graphOperationCounterRef = useRef(1)
  const nextGraphOperationId = (kind: string): string => `lab:${kind}:${graphOperationCounterRef.current++}`
  const [authoringMetadata, setAuthoringMetadata] = useState<MotionAuthoringMetadataV1>(() => createMotionAuthoringMetadata())
  const [selection, setSelection] = useState<MotionSelectionStateV1>(() => selectMotionNode(initialSelectedGraphNodeId))
  const selectedGraphNodeId = selection.primaryNodeId
  const setSelectedGraphNodeId = (nodeId: string | null) => setSelection(selectMotionNode(nodeId))
  const [compositorHistory, setCompositorHistory] = useState(() => createCompositorHistory(50))
  const [inspectorFocus, setInspectorFocus] = useState<'effects' | 'masks' | 'animation' | null>(null)

  const [text, setText] = useState(initialText)
  const [emphasisText, setEmphasisText] = useState(initialEmphasisText)
  const [emphasisTreatment, setEmphasisTreatment] = useState<NonNullable<KineticHeadlineProps['emphasisTreatment']>>(initialEmphasisTreatment)
  const [alignment, setAlignment] = useState<KineticHeadlineProps['alignment']>('center')
  const [maxLines, setMaxLines] = useState<KineticHeadlineProps['maxLines']>(initialMaxLines)

  const [checklistEyebrow, setChecklistEyebrow] = useState('LAUNCH CHECKLIST')
  const [checklistTitle, setChecklistTitle] = useState(initialSearch.get('checklist') === 'max' ? 'Six checks before export' : 'Ready before you publish')
  const [checklistRowsText, setChecklistRowsText] = useState(initialChecklistRows.join('\n'))
  const [checklistCompleted, setChecklistCompleted] = useState(initialChecklistCompleted)
  const [checklistFooter, setChecklistFooter] = useState(initialSearch.get('checklist') === 'max' ? '4 of 6 ready' : '2 of 3 ready')

  const [comparisonEyebrow, setComparisonEyebrow] = useState('COST VS VALUE')
  const [comparisonTitle, setComparisonTitle] = useState('What one month buys you')
  const [costLabel, setCostLabel] = useState('Manual editing cost')
  const [costValue, setCostValue] = useState(2_400)
  const [costPrefix, setCostPrefix] = useState('$')
  const [costSuffix, setCostSuffix] = useState('')
  const [costNote, setCostNote] = useState('Time + repetitive work')
  const [valueLabel, setValueLabel] = useState('Workflow value created')
  const [valueValue, setValueValue] = useState(24_000)
  const [valuePrefix, setValuePrefix] = useState('$')
  const [valueSuffix, setValueSuffix] = useState('')
  const [valueNote, setValueNote] = useState('More output from the same month')
  const [comparisonFooter, setComparisonFooter] = useState('10× more value from the workflow')

  const [timerLabel, setTimerLabel] = useState(initialTimerLabel)
  const [timerStatus, setTimerStatus] = useState('LIVE')
  const [timerCaption, setTimerCaption] = useState('Time left for this section')
  const [timerMode, setTimerMode] = useState<TimerStatusPillProps['mode']>(initialTimerMode)
  const [timerTotalSeconds, setTimerTotalSeconds] = useState(initialTimerSeconds)
  const [timerAlwaysShowHours, setTimerAlwaysShowHours] = useState(initialTimerShowHours)

  const [networkEyebrow, setNetworkEyebrow] = useState(initialNetworkProps.eyebrow)
  const [networkTitle, setNetworkTitle] = useState(initialNetworkProps.title)
  const [networkCenterId, setNetworkCenterId] = useState(initialNetworkProps.centerId)
  const [networkNodesText, setNetworkNodesText] = useState(networkNodesToText(initialNetworkProps.nodes))
  const [networkConnectionsText, setNetworkConnectionsText] = useState(networkConnectionsToText(initialNetworkProps.connections))
  const [familyProps, setFamilyProps] = useState<FamilyComponentProps>(initialFamilyProps)

  const [stylePackId, setStylePackId] = useState(initialStylePackId)
  const selectedStylePack = stylePackById(stylePackId)
  const [accentColor, setAccentColor] = useState(selectedStylePack.tokens.colors.accent)
  const [textColor, setTextColor] = useState(selectedStylePack.tokens.colors.text)
  const [costColor, setCostColor] = useState(costValueCardStyleFromPack(selectedStylePack).costColor)
  const [motionIntensity, setMotionIntensity] = useState(selectedStylePack.tokens.motion.intensity)
  const [softPanel, setSoftPanel] = useState(true)

  const [safeArea, setSafeArea] = useState(false)
  const [bounds, setBounds] = useState(false)
  const [centerGuides, setCenterGuides] = useState(false)
  const [grid, setGrid] = useState(false)

  const previewHostRef = useRef<HTMLDivElement>(null)
  const [previewHostSize, setPreviewHostSize] = useState({ width: 900, height: 620 })
  const playbackAnchorRef = useRef({ wallMilliseconds: 0, ticks: 0 })

  useEffect(() => {
    const host = previewHostRef.current
    if (!host) return
    const update = () => setPreviewHostSize({ width: host.clientWidth, height: host.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setLocalTicks((ticks) => Math.min(ticks, durationTicks))
  }, [durationTicks])

  useEffect(() => {
    if (!playing) return
    playbackAnchorRef.current = { wallMilliseconds: performance.now(), ticks: localTicks }
  }, [speed, loop, durationTicks])

  useEffect(() => {
    if (!playing) return
    let animationFrame = 0
    const animate = (now: number) => {
      const advanced = advancePlaybackTicks({
        anchorTicks: playbackAnchorRef.current.ticks,
        elapsedMilliseconds: now - playbackAnchorRef.current.wallMilliseconds,
        speed,
        durationTicks,
        loop,
      })
      setLocalTicks(advanced.ticks)
      if (advanced.ended) {
        setPlaying(false)
        return
      }
      animationFrame = requestAnimationFrame(animate)
    }
    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [playing, speed, loop, durationTicks])

  const headlineProps: KineticHeadlineProps = useMemo(
    () => ({ text, emphasisIndices: parseEmphasisIndices(emphasisText), alignment, maxLines, emphasisTreatment }),
    [text, emphasisText, alignment, maxLines, emphasisTreatment],
  )

  const checklistLabels = useMemo(
    () => checklistRowsText.split(/\r?\n/u).map((label) => label.trim()).filter(Boolean),
    [checklistRowsText],
  )
  const checklistProps: ChecklistCardProps = useMemo(
    () => ({
      eyebrow: checklistEyebrow,
      title: checklistTitle,
      items: checklistLabels.map((label, index) => ({
        id: `item_${index + 1}`,
        label,
        state: index < checklistCompleted ? 'complete' as const : 'pending' as const,
      })),
      footer: checklistFooter,
    }),
    [checklistEyebrow, checklistTitle, checklistLabels, checklistCompleted, checklistFooter],
  )

  const costValueProps: CostValueCardProps = useMemo(
    () => ({
      eyebrow: comparisonEyebrow,
      title: comparisonTitle,
      cost: { label: costLabel, value: costValue, prefix: costPrefix, suffix: costSuffix, note: costNote },
      value: { label: valueLabel, value: valueValue, prefix: valuePrefix, suffix: valueSuffix, note: valueNote },
      footer: comparisonFooter,
    }),
    [comparisonEyebrow, comparisonTitle, costLabel, costValue, costPrefix, costSuffix, costNote, valueLabel, valueValue, valuePrefix, valueSuffix, valueNote, comparisonFooter],
  )

  const timerProps: TimerStatusPillProps = useMemo(
    () => ({
      label: timerLabel,
      status: timerStatus,
      caption: timerCaption,
      mode: timerMode,
      totalSeconds: timerTotalSeconds,
      alwaysShowHours: timerAlwaysShowHours,
    }),
    [timerLabel, timerStatus, timerCaption, timerMode, timerTotalSeconds, timerAlwaysShowHours],
  )

  const teamNetworkProps: TeamNetworkDiagramProps = useMemo(() => ({
    eyebrow: networkEyebrow,
    title: networkTitle,
    centerId: networkCenterId,
    nodes: parseNetworkNodesText(networkNodesText),
    connections: parseNetworkConnectionsText(networkConnectionsText),
  }), [networkEyebrow, networkTitle, networkCenterId, networkNodesText, networkConnectionsText])

  const context = {
    localTicks,
    durationTicks,
    ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
    composition,
    reducedMotion,
  } as const

  const headlineBaseStyle = useMemo(() => kineticHeadlineStyleFromPack(selectedStylePack), [selectedStylePack])
  const headlineStyle: KineticHeadlineStyle = useMemo(
    () => ({
      ...headlineBaseStyle,
      accentColor,
      textColor,
      motionIntensity,
      background: softPanel ? 'soft-panel' : 'none',
    }),
    [headlineBaseStyle, accentColor, textColor, motionIntensity, softPanel],
  )
  const checklistBaseStyle = useMemo(() => checklistCardStyleFromPack(selectedStylePack), [selectedStylePack])
  const checklistStyle: ChecklistCardStyle = useMemo(
    () => ({
      ...checklistBaseStyle,
      accentColor,
      textColor,
      motionIntensity,
    }),
    [checklistBaseStyle, accentColor, textColor, motionIntensity],
  )
  const costValueBaseStyle = useMemo(() => costValueCardStyleFromPack(selectedStylePack), [selectedStylePack])
  const costValueStyle: CostValueCardStyle = useMemo(
    () => ({
      ...costValueBaseStyle,
      accentColor,
      textColor,
      costColor,
      motionIntensity,
    }),
    [costValueBaseStyle, accentColor, textColor, costColor, motionIntensity],
  )
  const timerBaseStyle = useMemo(() => timerStatusPillStyleFromPack(selectedStylePack), [selectedStylePack])
  const timerStyle: TimerStatusPillStyle = useMemo(
    () => ({
      ...timerBaseStyle,
      accentColor,
      textColor,
      motionIntensity,
    }),
    [timerBaseStyle, accentColor, textColor, motionIntensity],
  )
  const teamNetworkBaseStyle = useMemo(() => teamNetworkDiagramStyleFromPack(selectedStylePack), [selectedStylePack])
  const teamNetworkStyle: TeamNetworkDiagramStyle = useMemo(() => ({
    ...teamNetworkBaseStyle,
    accentColor,
    textColor,
    motionIntensity,
  }), [teamNetworkBaseStyle, accentColor, textColor, motionIntensity])
  const familyBaseStyle = useMemo(() => familyComponentStyleFromPack(selectedStylePack), [selectedStylePack])
  const familyStyle: FamilyComponentStyle = useMemo(() => ({ ...familyBaseStyle, accentColor, textColor, motionIntensity }), [familyBaseStyle, accentColor, textColor, motionIntensity])

  const headlinePropsValidation = KineticHeadlineModule.validateProps(headlineProps)
  const headlineStyleValidation = KineticHeadlineModule.validateStyle(headlineStyle)
  const validatedHeadlineProps = headlinePropsValidation.ok ? headlinePropsValidation.value : null
  const validatedHeadlineStyle = headlineStyleValidation.ok ? headlineStyleValidation.value : null
  const headlineFitValidation = validatedHeadlineProps ? validateKineticHeadlineFit(validatedHeadlineProps, context) : null
  const headlineRenderable = validatedHeadlineProps !== null && validatedHeadlineStyle !== null && headlineFitValidation?.ok === true
  const headlineState = headlineRenderable
    ? evaluateKineticHeadlineState(validatedHeadlineProps, validatedHeadlineStyle, context)
    : null

  const checklistPropsValidation = ChecklistCardModule.validateProps(checklistProps)
  const checklistStyleValidation = ChecklistCardModule.validateStyle(checklistStyle)
  const validatedChecklistProps = checklistPropsValidation.ok ? checklistPropsValidation.value : null
  const validatedChecklistStyle = checklistStyleValidation.ok ? checklistStyleValidation.value : null
  const checklistFitValidation = validatedChecklistProps ? validateChecklistCardFit(validatedChecklistProps, context) : null
  const checklistRenderable = validatedChecklistProps !== null && validatedChecklistStyle !== null && checklistFitValidation?.ok === true
  const checklistState = checklistRenderable
    ? evaluateChecklistCardState(validatedChecklistProps, validatedChecklistStyle, context)
    : null

  const costValuePropsValidation = CostValueCardModule.validateProps(costValueProps)
  const costValueStyleValidation = CostValueCardModule.validateStyle(costValueStyle)
  const validatedCostValueProps = costValuePropsValidation.ok ? costValuePropsValidation.value : null
  const validatedCostValueStyle = costValueStyleValidation.ok ? costValueStyleValidation.value : null
  const costValueFitValidation = validatedCostValueProps ? validateCostValueCardFit(validatedCostValueProps, context) : null
  const costValueRenderable = validatedCostValueProps !== null && validatedCostValueStyle !== null && costValueFitValidation?.ok === true
  const costValueState = costValueRenderable
    ? evaluateCostValueCardState(validatedCostValueProps, validatedCostValueStyle, context)
    : null

  const timerPropsValidation = TimerStatusPillModule.validateProps(timerProps)
  const timerStyleValidation = TimerStatusPillModule.validateStyle(timerStyle)
  const validatedTimerProps = timerPropsValidation.ok ? timerPropsValidation.value : null
  const validatedTimerStyle = timerStyleValidation.ok ? timerStyleValidation.value : null
  const timerFitValidation = validatedTimerProps ? validateTimerStatusPillFit(validatedTimerProps, context) : null
  const timerRenderable = validatedTimerProps !== null && validatedTimerStyle !== null && timerFitValidation?.ok === true
  const timerState = timerRenderable
    ? evaluateTimerStatusPillState(validatedTimerProps, validatedTimerStyle, context)
    : null

  const teamNetworkPropsValidation = TeamNetworkDiagramModule.validateProps(teamNetworkProps)
  const teamNetworkStyleValidation = TeamNetworkDiagramModule.validateStyle(teamNetworkStyle)
  const validatedTeamNetworkProps = teamNetworkPropsValidation.ok ? teamNetworkPropsValidation.value : null
  const validatedTeamNetworkStyle = teamNetworkStyleValidation.ok ? teamNetworkStyleValidation.value : null
  const teamNetworkFitValidation = validatedTeamNetworkProps ? validateTeamNetworkDiagramFit(validatedTeamNetworkProps, context) : null
  const teamNetworkRenderable = validatedTeamNetworkProps !== null && validatedTeamNetworkStyle !== null && teamNetworkFitValidation?.ok === true
  const teamNetworkState = teamNetworkRenderable
    ? evaluateTeamNetworkDiagramState(validatedTeamNetworkProps, validatedTeamNetworkStyle, context)
    : null

  const familyModule = FAMILY_COMPONENT_MODULES_BY_ID[selectedComponentId] ?? null
  const familyPropsValidation = familyModule ? familyModule.validateProps(familyProps) : null
  const familyStyleValidation = familyModule ? familyModule.validateStyle(familyStyle) : null
  const validatedFamilyProps = familyPropsValidation?.ok ? familyPropsValidation.value : null
  const validatedFamilyStyle = familyStyleValidation?.ok ? familyStyleValidation.value : null
  const familyRenderable = familyModule !== null && validatedFamilyProps !== null && validatedFamilyStyle !== null
  const familyState = familyRenderable ? evaluateFamilyComponentState(validatedFamilyProps, context) : null

  const isHeadline = selectedComponentId === 'sanverse.kinetic-headline'
  const isChecklist = selectedComponentId === 'sanverse.checklist-card'
  const isCostValue = selectedComponentId === 'sanverse.cost-value-card'
  const isTimer = selectedComponentId === 'sanverse.timer-status-pill'
  const isTeamNetwork = selectedComponentId === 'sanverse.team-network-diagram'
  const isFamily = familyModule !== null
  const currentDefinition = familyModule?.definition ?? (isHeadline
    ? KINETIC_HEADLINE_DEFINITION
    : isChecklist
      ? CHECKLIST_CARD_DEFINITION
      : isCostValue
        ? COST_VALUE_CARD_DEFINITION
        : isTimer
          ? TIMER_STATUS_PILL_DEFINITION
          : TEAM_NETWORK_DIAGRAM_DEFINITION)
  const minimumDurationSeconds = Math.ceil(currentDefinition.minDurationTicks / SANVERSE_TICKS_PER_SECOND)
  const maximumDurationSeconds = Math.floor(currentDefinition.maxDurationTicks / SANVERSE_TICKS_PER_SECOND)
  const renderable = isFamily ? familyRenderable : isHeadline ? headlineRenderable : isChecklist ? checklistRenderable : isCostValue ? costValueRenderable : isTimer ? timerRenderable : teamNetworkRenderable
  const currentPhase = isFamily ? familyState?.phase : isHeadline ? headlineState?.phase : isChecklist ? checklistState?.phase : isCostValue ? costValueState?.phase : isTimer ? timerState?.phase : teamNetworkState?.phase
  const currentFitLabel = isFamily
    ? familyState ? `${familyState.layout} / ${familyProps.items.length} supporting items` : 'refused'
    : isHeadline
      ? headlineState ? `${headlineState.layout.fontSize}px / ${headlineState.layout.lines.length} line${headlineState.layout.lines.length === 1 ? '' : 's'}` : 'refused'
    : isChecklist
      ? checklistState ? `${checklistState.layout.cardWidth}×${checklistState.layout.cardHeight}px / ${checklistState.layout.items.length} rows` : 'refused'
      : isCostValue
        ? costValueState ? `${costValueState.layout.kind} / ${costValueState.layout.cardWidth}×${costValueState.layout.cardHeight}px` : 'refused'
        : isTimer
          ? timerState ? `${timerState.layout.kind} / ${timerState.displayedClock} / ${timerState.layout.pillWidth}×${timerState.layout.pillHeight}px` : 'refused'
          : teamNetworkState ? `${teamNetworkState.layout.kind} / ${teamNetworkProps.nodes.length} nodes / ${teamNetworkProps.connections.length} connections` : 'refused'
  const currentIssues = isFamily
    ? [
        ...(familyPropsValidation && !familyPropsValidation.ok ? familyPropsValidation.issues : []),
        ...(familyStyleValidation && !familyStyleValidation.ok ? familyStyleValidation.issues : []),
      ]
    : isHeadline
      ? [
        ...(headlinePropsValidation.ok ? [] : headlinePropsValidation.issues),
        ...(headlineStyleValidation.ok ? [] : headlineStyleValidation.issues),
        ...(headlineFitValidation === null || headlineFitValidation.ok ? [] : headlineFitValidation.issues),
      ]
    : isChecklist
      ? [
          ...(checklistPropsValidation.ok ? [] : checklistPropsValidation.issues),
          ...(checklistStyleValidation.ok ? [] : checklistStyleValidation.issues),
          ...(checklistFitValidation === null || checklistFitValidation.ok ? [] : checklistFitValidation.issues),
        ]
      : isCostValue
        ? [
            ...(costValuePropsValidation.ok ? [] : costValuePropsValidation.issues),
            ...(costValueStyleValidation.ok ? [] : costValueStyleValidation.issues),
            ...(costValueFitValidation === null || costValueFitValidation.ok ? [] : costValueFitValidation.issues),
          ]
        : isTimer
          ? [
              ...(timerPropsValidation.ok ? [] : timerPropsValidation.issues),
              ...(timerStyleValidation.ok ? [] : timerStyleValidation.issues),
              ...(timerFitValidation === null || timerFitValidation.ok ? [] : timerFitValidation.issues),
            ]
          : [
              ...(teamNetworkPropsValidation.ok ? [] : teamNetworkPropsValidation.issues),
              ...(teamNetworkStyleValidation.ok ? [] : teamNetworkStyleValidation.issues),
              ...(teamNetworkFitValidation === null || teamNetworkFitValidation.ok ? [] : teamNetworkFitValidation.issues),
            ]

  const baseGraphScene: MotionSceneV1 | null = isFamily && familyRenderable && familyModule && validatedFamilyProps && validatedFamilyStyle
    ? familyModule.createScene(validatedFamilyProps, validatedFamilyStyle, context)
    : isHeadline && headlineRenderable && validatedHeadlineProps && validatedHeadlineStyle
      ? KineticHeadlineModule.createScene(validatedHeadlineProps, validatedHeadlineStyle, context)
    : isChecklist && checklistRenderable && validatedChecklistProps && validatedChecklistStyle
      ? ChecklistCardModule.createScene(validatedChecklistProps, validatedChecklistStyle, context)
      : isCostValue && costValueRenderable && validatedCostValueProps && validatedCostValueStyle
        ? CostValueCardModule.createScene(validatedCostValueProps, validatedCostValueStyle, context)
        : isTimer && timerRenderable && validatedTimerProps && validatedTimerStyle
          ? TimerStatusPillModule.createScene(validatedTimerProps, validatedTimerStyle, context)
          : isTeamNetwork && teamNetworkRenderable && validatedTeamNetworkProps && validatedTeamNetworkStyle
            ? TeamNetworkDiagramModule.createScene(validatedTeamNetworkProps, validatedTeamNetworkStyle, context)
            : null
  const operatedGraphPreview = baseGraphScene ? previewOperatedScene(baseGraphScene, graphOperations, durationTicks) : null
  const currentGraphScene = operatedGraphPreview?.scene ?? null
  const applicableGraphOperations = operatedGraphPreview?.operations ?? []
  const resolvedGraphScene = currentGraphScene ? evaluateScene(currentGraphScene, context) : null
  const layerProjection = currentGraphScene ? projectMotionLayers({ scene: currentGraphScene, resolvedScene: resolvedGraphScene, authoringMetadata }) : null
  const selectionOverlayLabels = layerProjection ? Object.freeze(Object.fromEntries(layerProjection.preorderNodeIds.map((nodeId) => [nodeId, layerProjection.layersById[nodeId]!.displayName]))) : Object.freeze({})
  const selectionOverlayDescendants = layerProjection ? Object.freeze(Object.fromEntries(layerProjection.preorderNodeIds.map((nodeId) => {
    const collect = (id: string): string[] => {
      const layer = layerProjection.layersById[id]
      if (!layer) return []
      return layer.childNodeIds.length === 0 ? [id] : layer.childNodeIds.flatMap(collect)
    }
    return [nodeId, Object.freeze(collect(nodeId))]
  }))) : Object.freeze({})
  const graphExposures: readonly MotionExposureV1[] = currentGraphScene
    ? Object.freeze([
        ...COMMON_LAB_EXPOSURES.map((exposure) => exposure.id === 'common.duration' ? Object.freeze({ ...exposure, constraints: { minimum: minimumDurationSeconds, maximum: maximumDurationSeconds, step: 1 } }) : exposure),
        ...currentGraphScene.exposures,
      ])
    : Object.freeze([])

  const displayScale = Math.max(
    0.05,
    Math.min(
      (Math.max(160, previewHostSize.width) - 56) / composition.width,
      (Math.max(160, previewHostSize.height) - 56) / composition.height,
      1,
    ),
  )
  const currentFrame = frameForTicks(localTicks, composition)
  const progress = localTicks / durationTicks

  const seek = (ticks: number) => {
    const next = clampExactTick(ticks, durationTicks)
    setLocalTicks(next)
    if (playing) playbackAnchorRef.current = { wallMilliseconds: performance.now(), ticks: next }
  }

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    const startingTicks = localTicks >= durationTicks ? 0 : localTicks
    setLocalTicks(startingTicks)
    playbackAnchorRef.current = { wallMilliseconds: performance.now(), ticks: startingTicks }
    setPlaying(true)
  }

  const restart = () => {
    setLocalTicks(0)
    if (playing) playbackAnchorRef.current = { wallMilliseconds: performance.now(), ticks: 0 }
  }

  const applyStylePack = (id: string) => {
    const pack = stylePackById(id)
    setStylePackId(pack.id)
    setAccentColor(pack.tokens.colors.accent)
    setTextColor(pack.tokens.colors.text)
    setCostColor(costValueCardStyleFromPack(pack).costColor)
    setMotionIntensity(pack.tokens.motion.intensity)
  }

  const changeStylePack = (event: ChangeEvent<HTMLSelectElement>) => applyStylePack(event.target.value)

  const visibleCatalog = useMemo(() => {
    const query = componentSearch.trim().toLowerCase()
    if (!query) return MOTION_COMPONENT_CATALOG
    return MOTION_COMPONENT_CATALOG.filter((component) => [component.id, component.name, component.purpose, component.category].some((value) => value.toLowerCase().includes(query)))
  }, [componentSearch])

  const selectComponent = (componentId: MotionLabComponentId) => {
    setPlaying(false)
    setSelectedComponentId(componentId)
    const nextDefinition = MOTION_COMPONENT_CATALOG.find((component) => component.id === componentId) ?? KINETIC_HEADLINE_DEFINITION
    const nextDurationSeconds = Math.max(1, Math.round(nextDefinition.defaultDurationTicks / SANVERSE_TICKS_PER_SECOND))
    const nextProgress = componentId === 'sanverse.checklist-card'
      ? 0.62
      : componentId === 'sanverse.cost-value-card'
        ? 0.60
        : componentId === 'sanverse.timer-status-pill'
          ? 0.76
          : componentId === 'sanverse.team-network-diagram'
            ? 0.55
            : FAMILY_COMPONENT_MODULES_BY_ID[componentId]
              ? 0.56
              : 0.30
    const nextFamilyModule = FAMILY_COMPONENT_MODULES_BY_ID[componentId]
    if (nextFamilyModule) setFamilyProps(nextFamilyModule.defaultProps)
    setDurationSeconds(nextDurationSeconds)
    setLocalTicks(Math.round(nextDurationSeconds * SANVERSE_TICKS_PER_SECOND * nextProgress))
    setGraphOperations([])
    setGraphOperationError(null)
    setAuthoringMetadata(createMotionAuthoringMetadata())
    setSelection(createMotionSelectionState())
    setKeyframeSelection(createMotionKeyframeSelection())
    setSelectedAnimationTrackId(null)
    setCompositorHistory(createCompositorHistory(50))
    setInspectorFocus(null)
  }

  const compositorSnapshot = (): MotionLabCompositorSnapshotV1 => Object.freeze({ graphOperations, authoringMetadata, selection })
  const restoreCompositorSnapshot = (snapshot: MotionLabCompositorSnapshotV1) => {
    setGraphOperations(snapshot.graphOperations)
    setAuthoringMetadata(snapshot.authoringMetadata)
    setSelection(snapshot.selection)
    setGraphOperationError(null)
  }
  const recordCompositorHistory = () => setCompositorHistory((history) => pushCompositorHistory(history, compositorSnapshot()))

  const appendGraphOperations = (operations: readonly MotionGraphOperationV1[], recordHistory = true): boolean => {
    if (operations.length === 0 || !currentGraphScene) return false
    const preview = applyMotionOperations(currentGraphScene, operations, { durationTicks, authoringMetadata })
    if (!preview.ok) {
      setGraphOperationError(`${preview.error.code}: ${preview.error.message}`)
      return false
    }
    let next = [...graphOperations]
    for (const operation of operations) {
      const identity = operationIdentity(operation)
      if (identity) next = next.filter((candidate) => operationIdentity(candidate) !== identity)
      next.push(operation)
    }
    if (recordHistory) recordCompositorHistory()
    setGraphOperationError(null)
    setGraphOperations(Object.freeze(next))
    return true
  }

  const undoCompositor = () => {
    const result = undoCompositorHistory(compositorHistory, compositorSnapshot())
    if (!result.snapshot) return
    setCompositorHistory(result.history)
    restoreCompositorSnapshot(result.snapshot)
  }
  const redoCompositor = () => {
    const result = redoCompositorHistory(compositorHistory, compositorSnapshot())
    if (!result.snapshot) return
    setCompositorHistory(result.history)
    restoreCompositorSnapshot(result.snapshot)
  }
  const resetCompositor = () => {
    if (graphOperations.length === 0 && authoringMetadata.lockedNodeIds.length === 0 && selection.selectedNodeIds.length === 0) return
    recordCompositorHistory()
    setGraphOperations(Object.freeze([]))
    setAuthoringMetadata(createMotionAuthoringMetadata())
    setSelection(createMotionSelectionState())
    setKeyframeSelection(createMotionKeyframeSelection())
    setSelectedAnimationTrackId(null)
    setGraphOperationError(null)
  }

  const selectLayerNode = (nodeId: string, modifiers: Readonly<{ toggle: boolean; range: boolean; visibleNodeIds: readonly string[] }>) => {
    setSelection((current) => modifiers.range ? selectMotionNodeRange(current, nodeId, modifiers.visibleNodeIds) : modifiers.toggle ? toggleMotionNodeSelection(current, nodeId) : selectMotionNode(nodeId))
  }
  const toggleLayerLock = (nodeId: string) => {
    if (!currentGraphScene?.nodes[nodeId]) return
    recordCompositorHistory()
    const directlyLocked = authoringMetadata.lockedNodeIds.includes(nodeId)
    setAuthoringMetadata(setMotionNodeLocked(authoringMetadata, currentGraphScene, nodeId, !directlyLocked))
  }
  const toggleLayerEnabled = (nodeId: string) => {
    const layer = layerProjection?.layersById[nodeId]
    if (!layer) return
    appendGraphOperations([{ operationId: nextGraphOperationId('layer-enabled'), type: 'set-node-enabled', nodeId, enabled: !layer.enabled }])
  }
  const toggleSelectedLayersEnabled = (nodeIds: readonly string[]) => {
    if (!layerProjection || nodeIds.length === 0) return
    const nextEnabled = nodeIds.some((nodeId) => layerProjection.layersById[nodeId]?.enabled === false)
    appendGraphOperations(nodeIds.map((nodeId): MotionGraphOperationV1 => ({ operationId: nextGraphOperationId('layer-enabled-bulk'), type: 'set-node-enabled', nodeId, enabled: nextEnabled })))
  }
  const toggleSelectedLayersLocked = (nodeIds: readonly string[]) => {
    if (!currentGraphScene || nodeIds.length === 0) return
    recordCompositorHistory()
    const shouldLock = nodeIds.some((nodeId) => !authoringMetadata.lockedNodeIds.includes(nodeId))
    let next = authoringMetadata
    for (const nodeId of nodeIds) if (currentGraphScene.nodes[nodeId]) next = setMotionNodeLocked(next, currentGraphScene, nodeId, shouldLock)
    setAuthoringMetadata(next)
  }
  const addLayerEffect = (nodeId: string) => appendGraphOperations([{ operationId: nextGraphOperationId('layer-add-effect'), type: 'add-effect', nodeId, effect: createDefaultEffect(`lab-layer-glow:${graphOperationCounterRef.current}`, 'glow') }])
  const addLayerMask = (nodeId: string) => appendGraphOperations([{ operationId: nextGraphOperationId('layer-add-mask'), type: 'add-mask', nodeId, mask: createDefaultMask(`lab-layer-mask:${graphOperationCounterRef.current}`, 'rounded-rectangle') }])
  const renameLayer = (nodeId: string, name: string) => appendGraphOperations([{ operationId: nextGraphOperationId('layer-rename'), type: 'rename-node', nodeId, name }])
  const duplicateLayers = (nodeIds: readonly string[]) => {
    if (!currentGraphScene || nodeIds.length === 0) return
    const selected = new Set(nodeIds)
    const topLevel = nodeIds.filter((nodeId) => {
      let parent = currentGraphScene.nodes[nodeId]?.parentId ?? null
      while (parent) { if (selected.has(parent)) return false; parent = currentGraphScene.nodes[parent]?.parentId ?? null }
      return true
    })
    const nonce = graphOperationCounterRef.current
    const duplicates = topLevel.map((nodeId, index) => `${nodeId}::copy:${nonce + index}`)
    const operations = topLevel.map((nodeId, index): MotionGraphOperationV1 => ({ operationId: nextGraphOperationId('layer-duplicate'), type: 'duplicate-node', nodeId, duplicateId: duplicates[index]! }))
    if (appendGraphOperations(operations)) setSelection(createMotionSelectionState(duplicates, duplicates.at(-1) ?? null, duplicates[0] ?? null))
  }
  const duplicateLayer = (nodeId: string) => duplicateLayers([nodeId])
  const deleteLayers = (nodeIds: readonly string[]) => {
    if (!currentGraphScene || nodeIds.length === 0) return
    const selected = new Set(nodeIds)
    const topLevel = nodeIds.filter((nodeId) => {
      let parent = currentGraphScene.nodes[nodeId]?.parentId ?? null
      while (parent) { if (selected.has(parent)) return false; parent = currentGraphScene.nodes[parent]?.parentId ?? null }
      return true
    })
    const operations = topLevel.map((nodeId): MotionGraphOperationV1 => ({ operationId: nextGraphOperationId('layer-delete'), type: 'remove-node', nodeId, mode: 'subtree' }))
    const preview = applyMotionOperations(currentGraphScene, operations, { durationTicks, authoringMetadata })
    if (!preview.ok) { setGraphOperationError(`${preview.error.code}: ${preview.error.message}`); return }
    const previousPrimary = selection.primaryNodeId
    if (appendGraphOperations(operations)) setSelection(selectMotionNode(selectionFallbackAfterDelete(currentGraphScene, preview.scene, topLevel, previousPrimary)))
  }
  const groupLayers = (nodeIds: readonly string[]) => {
    if (!currentGraphScene || nodeIds.length === 0) return
    const groupId = `lab-group:${graphOperationCounterRef.current}`
    if (appendGraphOperations([{ operationId: nextGraphOperationId('layer-group'), type: 'group-nodes', nodeIds, groupId, groupName: 'Group' }])) setSelection(selectMotionNode(groupId))
  }
  const ungroupLayer = (groupId: string) => {
    const group = currentGraphScene?.nodes[groupId]
    if (!group || group.type !== 'group') return
    const childIds = [...group.childIds]
    const parentId = group.parentId
    if (appendGraphOperations([{ operationId: nextGraphOperationId('layer-ungroup'), type: 'ungroup-nodes', groupId }])) setSelection(createMotionSelectionState(childIds, childIds.at(-1) ?? parentId, childIds[0] ?? parentId))
  }
  const moveLayer = (nodeId: string, direction: -1 | 1) => {
    if (!currentGraphScene) return
    const node = currentGraphScene.nodes[nodeId]
    const parent = node?.parentId ? currentGraphScene.nodes[node.parentId] : null
    if (!node || !parent || parent.type !== 'group') return
    const index = parent.childIds.indexOf(nodeId)
    const nextIndex = Math.max(0, Math.min(parent.childIds.length - 1, index + direction))
    if (nextIndex !== index) appendGraphOperations([{ operationId: nextGraphOperationId('layer-reorder'), type: 'reorder-node', nodeId, index: nextIndex }])
  }
  const dropLayer = (sourceNodeId: string, targetNodeId: string, intent: LayerDropIntent) => {
    if (!currentGraphScene || sourceNodeId === targetNodeId) return
    const source = currentGraphScene.nodes[sourceNodeId]
    const target = currentGraphScene.nodes[targetNodeId]
    if (!source || !target || sourceNodeId === currentGraphScene.rootNodeId) return
    if (intent === 'inside') {
      if (target.type !== 'group') return
      appendGraphOperations([{ operationId: nextGraphOperationId('layer-reparent'), type: 'reparent-node', nodeId: sourceNodeId, parentId: targetNodeId, index: target.childIds.length }])
      return
    }
    const parentId = target.parentId
    const parent = parentId ? currentGraphScene.nodes[parentId] : null
    if (!parentId || !parent || parent.type !== 'group') return
    let targetIndex = parent.childIds.indexOf(targetNodeId) + (intent === 'after' ? 1 : 0)
    if (source.parentId === parentId) {
      const sourceIndex = parent.childIds.indexOf(sourceNodeId)
      if (sourceIndex >= 0 && sourceIndex < targetIndex) targetIndex -= 1
      targetIndex = Math.max(0, Math.min(parent.childIds.length - 1, targetIndex))
      appendGraphOperations([{ operationId: nextGraphOperationId('layer-reorder'), type: 'reorder-node', nodeId: sourceNodeId, index: targetIndex }])
    } else {
      targetIndex = Math.max(0, Math.min(parent.childIds.length, targetIndex))
      appendGraphOperations([{ operationId: nextGraphOperationId('layer-reparent'), type: 'reparent-node', nodeId: sourceNodeId, parentId, index: targetIndex }])
    }
  }
  const focusInspectorSection = (section: 'effects' | 'masks' | 'animation') => {
    setExposureLevel('advanced')
    setCompositorMode(true)
    setInspectorFocus(section)
  }

  useEffect(() => {
    if (!inspectorFocus) return
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-inspector-section="${inspectorFocus}"]`)?.scrollIntoView({ block: 'nearest' })
      setInspectorFocus(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [inspectorFocus])

  useEffect(() => {
    if (!compositorMode) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editingText = target?.matches('input,textarea,select,[contenteditable="true"]') ?? false
      if (event.key === 'Escape') {
        if (editingText) return
        event.preventDefault()
        setSelection(createMotionSelectionState())
        return
      }
      if (editingText) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selection.selectedNodeIds.length) { event.preventDefault(); deleteLayers(selection.selectedNodeIds) }
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        if (selection.selectedNodeIds.length) { event.preventDefault(); duplicateLayers(selection.selectedNodeIds) }
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
        if (selection.selectedNodeIds.length) { event.preventDefault(); groupLayers(selection.selectedNodeIds) }
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redoCompositor(); else undoCompositor()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [compositorMode, selection, graphOperations, authoringMetadata, compositorHistory, currentGraphScene, layerProjection, durationTicks])

  const componentExposureValue = (propertyId: string): MotionPropertyPrimitiveV1 | null => {
    if (propertyId === 'stylePackId') return stylePackId
    if (propertyId === 'durationSeconds') return durationSeconds
    if (propertyId === 'reducedMotion') return reducedMotion
    if (propertyId === 'textColor') return textColor
    if (propertyId === 'accentColor') return accentColor
    if (propertyId === 'costColor') return costColor
    if (propertyId === 'motionIntensity') return motionIntensity
    if (isFamily) {
      if (propertyId === 'eyebrow') return familyProps.eyebrow
      if (propertyId === 'title') return familyProps.title
      if (propertyId === 'subtitle') return familyProps.subtitle
      if (propertyId === 'value') return familyProps.value
      if (propertyId === 'items') return familyProps.items.join('\n')
      if (propertyId === 'placement') return familyProps.placement ?? 'center'
      if (propertyId === 'safeOffset') return familyProps.safeOffset ?? 64
    }
    if (isHeadline) {
      if (propertyId === 'text') return text
      if (propertyId === 'emphasisIndices') return emphasisText
      if (propertyId === 'emphasisTreatment') return emphasisTreatment
      if (propertyId === 'alignment') return alignment
      if (propertyId === 'maxLines') return maxLines
      if (propertyId === 'background') return softPanel ? 'soft-panel' : 'none'
    }
    if (isChecklist) {
      if (propertyId === 'eyebrow') return checklistEyebrow
      if (propertyId === 'title') return checklistTitle
      if (propertyId === 'items') return checklistRowsText
      if (propertyId === 'completedCount') return Math.min(checklistCompleted, checklistLabels.length)
      if (propertyId === 'footer') return checklistFooter
    }
    if (isCostValue) {
      if (propertyId === 'eyebrow') return comparisonEyebrow
      if (propertyId === 'title') return comparisonTitle
      if (propertyId === 'cost.label') return costLabel
      if (propertyId === 'cost.value') return costValue
      if (propertyId === 'cost.prefix') return costPrefix
      if (propertyId === 'cost.suffix') return costSuffix
      if (propertyId === 'cost.note') return costNote
      if (propertyId === 'value.label') return valueLabel
      if (propertyId === 'value.value') return valueValue
      if (propertyId === 'value.prefix') return valuePrefix
      if (propertyId === 'value.suffix') return valueSuffix
      if (propertyId === 'value.note') return valueNote
      if (propertyId === 'footer') return comparisonFooter
    }
    if (isTimer) {
      if (propertyId === 'label') return timerLabel
      if (propertyId === 'status') return timerStatus
      if (propertyId === 'caption') return timerCaption
      if (propertyId === 'mode') return timerMode
      if (propertyId === 'totalSeconds') return timerTotalSeconds
      if (propertyId === 'alwaysShowHours') return timerAlwaysShowHours
    }
    if (isTeamNetwork) {
      if (propertyId === 'eyebrow') return networkEyebrow
      if (propertyId === 'title') return networkTitle
      if (propertyId === 'centerId') return networkCenterId
      if (propertyId === 'nodes') return networkNodesText
      if (propertyId === 'connections') return networkConnectionsText
    }
    return null
  }

  const writeComponentExposure = (propertyId: string, value: MotionPropertyPrimitiveV1) => {
    if (propertyId === 'stylePackId') { applyStylePack(String(value)); return }
    if (propertyId === 'durationSeconds') { setDurationSeconds(Number(value)); return }
    if (propertyId === 'reducedMotion') { setReducedMotion(Boolean(value)); return }
    if (propertyId === 'textColor') { setTextColor(String(value)); return }
    if (propertyId === 'accentColor') { setAccentColor(String(value)); return }
    if (propertyId === 'costColor') { setCostColor(String(value)); return }
    if (propertyId === 'motionIntensity') { setMotionIntensity(Number(value)); return }
    if (isFamily) {
      if (propertyId === 'eyebrow') { setFamilyProps((current) => ({ ...current, eyebrow: String(value) })); return }
      if (propertyId === 'title') { setFamilyProps((current) => ({ ...current, title: String(value) })); return }
      if (propertyId === 'subtitle') { setFamilyProps((current) => ({ ...current, subtitle: String(value) })); return }
      if (propertyId === 'value') { setFamilyProps((current) => ({ ...current, value: String(value) })); return }
      if (propertyId === 'items') { setFamilyProps((current) => ({ ...current, items: Object.freeze(String(value).split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean)) })); return }
      if (propertyId === 'placement') { setFamilyProps((current) => ({ ...current, placement: String(value) as FamilyComponentProps['placement'] })); return }
      if (propertyId === 'safeOffset') { setFamilyProps((current) => ({ ...current, safeOffset: Number(value) })); return }
    }
    if (isHeadline) {
      if (propertyId === 'text') { setText(String(value)); return }
      if (propertyId === 'emphasisIndices') { setEmphasisText(String(value)); return }
      if (propertyId === 'emphasisTreatment') { setEmphasisTreatment(String(value) as NonNullable<KineticHeadlineProps['emphasisTreatment']>); return }
      if (propertyId === 'alignment') { setAlignment(String(value) as KineticHeadlineProps['alignment']); return }
      if (propertyId === 'maxLines') { setMaxLines(Number(value) as KineticHeadlineProps['maxLines']); return }
      if (propertyId === 'background') { setSoftPanel(value === 'soft-panel'); return }
    }
    if (isChecklist) {
      if (propertyId === 'eyebrow') { setChecklistEyebrow(String(value)); return }
      if (propertyId === 'title') { setChecklistTitle(String(value)); return }
      if (propertyId === 'items') { setChecklistRowsText(String(value)); return }
      if (propertyId === 'completedCount') { setChecklistCompleted(Number(value)); return }
      if (propertyId === 'footer') { setChecklistFooter(String(value)); return }
    }
    if (isCostValue) {
      if (propertyId === 'eyebrow') { setComparisonEyebrow(String(value)); return }
      if (propertyId === 'title') { setComparisonTitle(String(value)); return }
      if (propertyId === 'cost.label') { setCostLabel(String(value)); return }
      if (propertyId === 'cost.value') { setCostValue(Number(value)); return }
      if (propertyId === 'cost.prefix') { setCostPrefix(String(value)); return }
      if (propertyId === 'cost.suffix') { setCostSuffix(String(value)); return }
      if (propertyId === 'cost.note') { setCostNote(String(value)); return }
      if (propertyId === 'value.label') { setValueLabel(String(value)); return }
      if (propertyId === 'value.value') { setValueValue(Number(value)); return }
      if (propertyId === 'value.prefix') { setValuePrefix(String(value)); return }
      if (propertyId === 'value.suffix') { setValueSuffix(String(value)); return }
      if (propertyId === 'value.note') { setValueNote(String(value)); return }
      if (propertyId === 'footer') { setComparisonFooter(String(value)); return }
    }
    if (isTimer) {
      if (propertyId === 'label') { setTimerLabel(String(value)); return }
      if (propertyId === 'status') { setTimerStatus(String(value)); return }
      if (propertyId === 'caption') { setTimerCaption(String(value)); return }
      if (propertyId === 'mode') { setTimerMode(String(value) as TimerStatusPillProps['mode']); return }
      if (propertyId === 'totalSeconds') { setTimerTotalSeconds(Number(value)); return }
      if (propertyId === 'alwaysShowHours') { setTimerAlwaysShowHours(Boolean(value)); return }
    }
    if (isTeamNetwork) {
      if (propertyId === 'eyebrow') { setNetworkEyebrow(String(value)); return }
      if (propertyId === 'title') { setNetworkTitle(String(value)); return }
      if (propertyId === 'centerId') { setNetworkCenterId(String(value)); return }
      if (propertyId === 'nodes') { setNetworkNodesText(String(value)); return }
      if (propertyId === 'connections') { setNetworkConnectionsText(String(value)); return }
    }
  }

  const readExposure = (exposure: MotionExposureV1) => {
    if (exposure.target.kind === 'component') return { value: componentExposureValue(exposure.target.propertyId) }
    if (!resolvedGraphScene) return { value: null }
    if (exposure.target.kind === 'node') {
      const node = resolvedGraphScene.nodes[exposure.target.nodeId]
      return { value: node && nodeSupportsProperty(node, exposure.target.property) ? resolvedNodeProperty(node, exposure.target.property) : null }
    }
    if (exposure.target.kind === 'part') {
      const target = exposure.target
      const part = currentGraphScene?.semanticParts.find((candidate) => candidate.id === target.semanticPartId)
      const values = part?.nodeIds
        .map((nodeId) => resolvedGraphScene.nodes[nodeId])
        .filter((node): node is ResolvedMotionNodeV1 => Boolean(node) && nodeSupportsProperty(node!, target.property))
        .map((node) => resolvedNodeProperty(node, target.property))
        .filter((candidate): candidate is MotionPropertyPrimitiveV1 => candidate !== null) ?? []
      return { value: values.length <= 1 ? values[0] ?? null : Object.freeze(values) }
    }
    return { value: null }
  }

  const writeExposure = (exposure: MotionExposureV1, value: MotionPropertyPrimitiveV1) => {
    if (exposure.target.kind === 'component') { writeComponentExposure(exposure.target.propertyId, value); return }
    if (exposure.target.kind === 'node') {
      appendGraphOperations([{ operationId: nextGraphOperationId('exposure-property'), type: 'set-property', target: { nodeId: exposure.target.nodeId, property: exposure.target.property }, value: constant(value) }])
      return
    }
    if (exposure.target.kind === 'part' && currentGraphScene && resolvedGraphScene) {
      const target = exposure.target
      const part = currentGraphScene.semanticParts.find((candidate) => candidate.id === target.semanticPartId)
      const operations = part?.nodeIds
        .filter((nodeId) => {
          const node = resolvedGraphScene.nodes[nodeId]
          return Boolean(node) && nodeSupportsProperty(node!, target.property)
        })
        .map((nodeId): MotionGraphOperationV1 => ({ operationId: nextGraphOperationId('part-property'), type: 'set-property', target: { nodeId, property: target.property }, value: constant(value) })) ?? []
      appendGraphOperations(operations)
    }
  }

  return (
    <main className="motion-lab">
      <header className="motion-lab__header">
        <div>
          <div className="motion-lab__eyebrow">SANVERSE / INTERNAL WORKSHOP</div>
          <h1>Motion Lab</h1>
        </div>
        <div className="motion-lab__header-status">
          <a className="motion-lab__library-link" href="/library">Creative Library</a>
          <span>{currentDefinition.id}</span>
          <strong>v{currentDefinition.version}</strong>
          <span>{currentDefinition.performanceClass}</span>
        </div>
      </header>

      <section className={`motion-lab__body${compositorMode ? ' motion-lab__body--compositor' : ''}`}>
        {compositorMode ? <LayerPanel
          projection={layerProjection}
          selection={selection}
          canUndo={compositorHistory.undo.length > 0}
          canRedo={compositorHistory.redo.length > 0}
          onSelectNode={selectLayerNode}
          onClearSelection={() => setSelection(createMotionSelectionState())}
          onToggleEnabled={toggleLayerEnabled}
          onToggleLock={toggleLayerLock}
          onRename={renameLayer}
          onDuplicate={duplicateLayer}
          onDuplicateSelection={duplicateLayers}
          onDelete={deleteLayers}
          onGroup={groupLayers}
          onToggleSelectionEnabled={toggleSelectedLayersEnabled}
          onToggleSelectionLock={toggleSelectedLayersLocked}
          onUngroup={ungroupLayer}
          onMove={moveLayer}
          onDrop={dropLayer}
          onAddEffect={addLayerEffect}
          onAddMask={addLayerMask}
          onFocusSection={focusInspectorSection}
          onUndo={undoCompositor}
          onRedo={redoCompositor}
          onReset={resetCompositor}
        /> : <aside className="motion-lab__browser" aria-label="Component browser">
          <div className="motion-lab__panel-title">Components · {MOTION_COMPONENT_CATALOG.length}</div>
          <input className="motion-lab__search" aria-label="Search motion components" value={componentSearch} onChange={(event) => setComponentSearch(event.target.value)} placeholder="Search library…" />
          <div className="motion-lab__catalog">
            {visibleCatalog.map((component) => {
              const active = component.id === selectedComponentId
              return (
                <button
                  key={component.id}
                  className={`motion-lab__component-card${active ? ' motion-lab__component-card--active' : ''}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectComponent(component.id as MotionLabComponentId)}
                >
                  <span className="motion-lab__component-category">{component.category}</span>
                  <strong>{component.name}</strong>
                  <span>{component.purpose}</span>
                </button>
              )
            })}
          </div>
          <div className="motion-lab__catalog-note">Proof components are added one at a time only after their tests and visual gate exist.</div>
        </aside>}

        <section className={`motion-lab__stage-column${compositorMode ? ' motion-lab__stage-column--c4' : ''}`}>
          <div className="motion-lab__stage-toolbar">
            <div className="motion-lab__segmented" aria-label="Composition ratio">
              {ratioOrder.map((candidate) => (
                <button key={candidate} type="button" aria-pressed={ratio === candidate} onClick={() => setRatio(candidate)}>{candidate}</button>
              ))}
            </div>
            <label className="motion-lab__compact-field">
              <span>Background</span>
              <select value={background} onChange={(event) => setBackground(event.target.value as PreviewBackground)}>
                {backgroundOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <div className="motion-lab__debug-toggles">
              <Toggle checked={safeArea} onChange={setSafeArea}>Safe area</Toggle>
              <Toggle checked={centerGuides} onChange={setCenterGuides}>Guides</Toggle>
              <Toggle checked={grid} onChange={setGrid}>Grid</Toggle>
              <Toggle checked={bounds} onChange={setBounds}>Bounds</Toggle>
            </div>
          </div>

          <div className="motion-lab__preview-host" ref={previewHostRef} onClickCapture={(event) => {
            if (!compositorMode) return
            const target = event.target as HTMLElement
            const nodeElement = target.closest<HTMLElement>('[data-motion-node-id]')
            const nodeId = nodeElement?.dataset.motionNodeId ?? null
            if (!nodeId || !currentGraphScene?.nodes[nodeId]) { setSelection(createMotionSelectionState()); return }
            setSelection((current) => event.shiftKey && layerProjection ? selectMotionNodeRange(current, nodeId, layerProjection.preorderNodeIds) : event.ctrlKey || event.metaKey ? toggleMotionNodeSelection(current, nodeId) : selectMotionNode(nodeId))
          }}>
            <MotionCompositionFrame
              composition={composition}
              displayScale={displayScale}
              background="transparent"
              className="motion-lab__preview-frame"
              overlays={(
                <>
                  <MotionGridOverlay visible={grid} />
                  <MotionCenterGuides visible={centerGuides} />
                  <MotionSafeArea composition={composition} visible={safeArea} />
                  <MotionDebugBounds visible={bounds} label="composition" inset={4} />
                  {compositorMode ? <MotionSelectionOverlay composition={composition} selectedNodeIds={selection.selectedNodeIds} labels={selectionOverlayLabels} descendantNodeIdsByNodeId={selectionOverlayDescendants} measurementKey={`${localTicks}:${ratio}:${stylePackId}:${applicableGraphOperations.length}`} /> : null}
                </>
              )}
            >
              <div style={{ position: 'absolute', inset: 0, ...previewBackgroundStyle(background) }} />
              {isFamily && familyRenderable && familyModule && validatedFamilyProps && validatedFamilyStyle ? (
                <MotionComponentHost module={familyModule} props={validatedFamilyProps} style={validatedFamilyStyle} context={context} graphOperations={applicableGraphOperations} selectedGraphNodeId={selectedGraphNodeId} selectedGraphNodeIds={selection.selectedNodeIds} />
              ) : isHeadline && headlineRenderable && validatedHeadlineProps && validatedHeadlineStyle ? (
                <MotionComponentHost module={KineticHeadlineModule} props={validatedHeadlineProps} style={validatedHeadlineStyle} context={context} graphOperations={applicableGraphOperations} selectedGraphNodeId={selectedGraphNodeId} selectedGraphNodeIds={selection.selectedNodeIds} />
              ) : isChecklist && checklistRenderable && validatedChecklistProps && validatedChecklistStyle ? (
                <MotionComponentHost module={ChecklistCardModule} props={validatedChecklistProps} style={validatedChecklistStyle} context={context} graphOperations={applicableGraphOperations} selectedGraphNodeId={selectedGraphNodeId} selectedGraphNodeIds={selection.selectedNodeIds} />
              ) : isCostValue && costValueRenderable && validatedCostValueProps && validatedCostValueStyle ? (
                <MotionComponentHost module={CostValueCardModule} props={validatedCostValueProps} style={validatedCostValueStyle} context={context} graphOperations={applicableGraphOperations} selectedGraphNodeId={selectedGraphNodeId} selectedGraphNodeIds={selection.selectedNodeIds} />
              ) : isTimer && timerRenderable && validatedTimerProps && validatedTimerStyle ? (
                <MotionComponentHost module={TimerStatusPillModule} props={validatedTimerProps} style={validatedTimerStyle} context={context} graphOperations={applicableGraphOperations} selectedGraphNodeId={selectedGraphNodeId} selectedGraphNodeIds={selection.selectedNodeIds} />
              ) : isTeamNetwork && teamNetworkRenderable && validatedTeamNetworkProps && validatedTeamNetworkStyle ? (
                <MotionComponentHost module={TeamNetworkDiagramModule} props={validatedTeamNetworkProps} style={validatedTeamNetworkStyle} context={context} graphOperations={applicableGraphOperations} selectedGraphNodeId={selectedGraphNodeId} selectedGraphNodeIds={selection.selectedNodeIds} />
              ) : (
                <div className="motion-lab__refusal" style={{ position: 'absolute', inset: 0 }}>
                  <div>
                    <strong>Component refused this input.</strong>
                    <span>Fix the highlighted property instead of silently clipping or rewriting content.</span>
                  </div>
                </div>
              )}
            </MotionCompositionFrame>
          </div>

          {compositorMode ? (
            <>
              <div className="motion-lab__animation-switch" aria-label="Animation editor view">
                <strong>ANIMATION</strong>
                <button type="button" aria-pressed={animationPanelMode === 'timeline'} onClick={() => setAnimationPanelMode('timeline')}>Timeline</button>
                <button type="button" aria-pressed={animationPanelMode === 'curves'} onClick={() => setAnimationPanelMode('curves')}>Curves</button>
              </div>
              {animationPanelMode === 'timeline' ? (
                <AnimationDopeSheet
                  scene={currentGraphScene}
                  selectedNodeId={selectedGraphNodeId}
                  localTicks={localTicks}
                  durationTicks={durationTicks}
                  composition={composition}
                  events={currentDefinition.events}
                  initialSelectedKeyframeId={initialSearch.get('c4key')}
                  sharedSelection={keyframeSelection}
                  onSharedSelectionChange={setKeyframeSelection}
                  sharedTrackId={selectedAnimationTrackId}
                  onSharedTrackChange={setSelectedAnimationTrackId}
                  errorMessage={graphOperationError}
                  canUndo={compositorHistory.undo.length > 0}
                  canRedo={compositorHistory.redo.length > 0}
                  onSeek={seek}
                  onSelectNode={(nodeId) => setSelectedGraphNodeId(nodeId)}
                  onOperations={(operations) => appendGraphOperations(operations)}
                  nextOperationId={nextGraphOperationId}
                  onUndo={undoCompositor}
                  onRedo={redoCompositor}
                />
              ) : (
                <MotionCurveEditor
                  scene={currentGraphScene}
                  selectedNodeId={selectedGraphNodeId}
                  localTicks={localTicks}
                  durationTicks={durationTicks}
                  selection={keyframeSelection}
                  selectedTrackId={selectedAnimationTrackId}
                  initialSelectedKeyframeId={initialSearch.get('c4key')}
                  errorMessage={graphOperationError}
                  canUndo={compositorHistory.undo.length > 0}
                  canRedo={compositorHistory.redo.length > 0}
                  onSeek={seek}
                  onSelectNode={(nodeId) => setSelectedGraphNodeId(nodeId)}
                  onSelectionChange={setKeyframeSelection}
                  onTrackChange={setSelectedAnimationTrackId}
                  onOperations={(operations) => appendGraphOperations(operations)}
                  nextOperationId={nextGraphOperationId}
                  onUndo={undoCompositor}
                  onRedo={redoCompositor}
                />
              )}
            </>
          ) : (
            <div className="motion-lab__event-strip">
              {currentDefinition.events.map((event) => (
                <div key={event.name} className="motion-lab__event" style={{ left: `${event.normalizedTime * 100}%` }} title={`${event.name} @ ${event.normalizedTime}`}>
                  <span />
                  <small>{event.name}</small>
                </div>
              ))}
            </div>
          )}

          <div className="motion-lab__transport">
            <div className="motion-lab__transport-buttons">
              <button type="button" onClick={restart}>↺ Restart</button>
              <button type="button" onClick={() => { setPlaying(false); seek(stepFrame(localTicks, -1, composition, durationTicks)) }}>← Frame</button>
              <button type="button" className="motion-lab__play" onClick={togglePlayback}>{playing ? 'Pause' : 'Play'}</button>
              <button type="button" onClick={() => { setPlaying(false); seek(stepFrame(localTicks, 1, composition, durationTicks)) }}>Frame →</button>
            </div>
            <input
              aria-label="Timeline seek"
              className="motion-lab__timeline-slider"
              type="range"
              min={0}
              max={durationTicks}
              step={1}
              value={localTicks}
              onChange={(event) => seek(Number(event.target.value))}
            />
            <div className="motion-lab__transport-meta">
              <label>
                <span>Exact tick</span>
                <input type="number" min={0} max={durationTicks} step={1} value={localTicks} onChange={(event) => seek(Number(event.target.value))} />
              </label>
              <label>
                <span>Speed</span>
                <select value={speed} onChange={(event) => setSpeed(Number(event.target.value) as PlaybackSpeed)}>
                  {PLAYBACK_SPEEDS.map((candidate) => <option key={candidate} value={candidate}>{candidate}×</option>)}
                </select>
              </label>
              <Toggle checked={loop} onChange={setLoop}>Loop</Toggle>
            </div>
          </div>

          <footer className="motion-lab__statusbar">
            <span>tick <strong>{localTicks.toLocaleString()}</strong></span>
            <span>frame <strong>{currentFrame}</strong></span>
            <span>progress <strong>{(progress * 100).toFixed(2)}%</strong></span>
            <span>phase <strong>{currentPhase ?? 'refused'}</strong></span>
            <span>fit <strong>{currentFitLabel}</strong></span>
            <span>composition <strong>{composition.width}×{composition.height}</strong></span>
            <span>display <strong>{Math.round(displayScale * 100)}%</strong></span>
            <span>clock <strong>{SANVERSE_TICKS_PER_SECOND.toLocaleString()} t/s</strong></span>
          </footer>
        </section>

        <aside className="motion-lab__inspector" aria-label="Properties inspector">
          <div className="motion-lab__panel-title">Properties</div>
          <GraphInspector
            level={exposureLevel}
            onLevelChange={setExposureLevel}
            compositorMode={compositorMode}
            onCompositorModeChange={setCompositorMode}
            exposures={graphExposures}
            scene={currentGraphScene}
            resolvedScene={resolvedGraphScene}
            readExposure={readExposure}
            writeExposure={writeExposure}
            selectedNodeId={selectedGraphNodeId}
            onSelectNode={setSelectedGraphNodeId}
            onOperation={(operation) => appendGraphOperations([operation])}
          />
          {compositorMode ? <CompositorInspector scene={currentGraphScene} resolvedScene={resolvedGraphScene} authoringMetadata={authoringMetadata} selection={selection} onOperation={(operation) => appendGraphOperations([operation])} nextOperationId={nextGraphOperationId} /> : null}
          {exposureLevel === 'advanced' ? (
            <>
              <KeyframeTimeline
                scene={currentGraphScene}
                selectedNodeId={selectedGraphNodeId}
                localTicks={localTicks}
                durationTicks={durationTicks}
                context={context}
                onSeek={seek}
                onOperation={(operation) => appendGraphOperations([operation])}
                errorMessage={graphOperationError}
              />
              <OperationPlayground
                scene={currentGraphScene}
                selectedNodeId={selectedGraphNodeId}
                onOperation={(operation) => appendGraphOperations([operation])}
                onSelectNode={setSelectedGraphNodeId}
                errorMessage={graphOperationError}
              />
            </>
          ) : null}
          {!renderable ? (
            <section className="motion-lab__issues" aria-live="polite">
              <strong>Typed refusal</strong>
              {currentIssues.map((issue) => (
                <div key={`${issue.path}:${issue.code}`}>{issue.path}: {issue.message}</div>
              ))}
            </section>
          ) : null}
        </aside>
      </section>
    </main>
  )
}

export const MOTION_LAB_INITIAL_STYLE_PACKS = [SANVERSE_CLEAN_STYLE.id, CREATOR_ENERGETIC_STYLE.id] as const
