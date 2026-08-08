import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, ReactNode } from 'react'
import type { MotionAspectRatio, MotionExposureLevel, MotionStylePackV1 } from '@sanverse/motion-contract'
import { constant, evaluateScene } from '@sanverse/motion-graph'
import type { MotionExposureV1, MotionGraphPatchV1, MotionNodePropertyNameV1, MotionPropertyPrimitiveV1, MotionSceneV1, ResolvedMotionNodeV1 } from '@sanverse/motion-graph'
import {
  CHECKLIST_CARD_DEFINITION,
  ChecklistCardModule,
  DEFAULT_TEAM_NETWORK_PROPS,
  COST_VALUE_CARD_DEFINITION,
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
} from '@sanverse/motion-native-runtime'
import { SANVERSE_TICKS_PER_SECOND, frameForTicks } from '@sanverse/motion-primitives'
import { PLAYBACK_SPEEDS, advancePlaybackTicks, clampExactTick, resolveInitialTick, stepFrame } from './transport.ts'
import type { PlaybackSpeed } from './transport.ts'
import { GraphInspector, previewPatchedScene } from './GraphInspector.tsx'

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
const initialDurationSeconds = Math.max(1, Math.round(initialDefinition.defaultDurationTicks / SANVERSE_TICKS_PER_SECOND))
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

const patchIdentity = (patch: MotionGraphPatchV1): string | null => {
  if (patch.op === 'set-property') return `property:${patch.target.nodeId}:${patch.target.property}`
  if (patch.op === 'set-effect-property') return `effect-property:${patch.nodeId}:${patch.effectId}:${patch.parameter}`
  if (patch.op === 'set-effect-enabled') return `effect-enabled:${patch.nodeId}:${patch.effectId}`
  if (patch.op === 'set-mask-property') return `mask-property:${patch.nodeId}:${patch.maskId}:${patch.property}`
  if (patch.op === 'set-blend-mode') return `blend:${patch.nodeId}`
  if (patch.op === 'reorder-effect') return `effect-order:${patch.nodeId}:${patch.effectId}`
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
  const [exposureLevel, setExposureLevel] = useState<MotionExposureLevel>(initialSearch.get('level') === 'advanced' ? 'advanced' : initialSearch.get('level') === 'designer' ? 'designer' : 'creator')
  const [graphPatches, setGraphPatches] = useState<readonly MotionGraphPatchV1[]>([])
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null)

  const [text, setText] = useState(initialText)
  const [emphasisText, setEmphasisText] = useState(initialEmphasisText)
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
  const [familyProps, setFamilyProps] = useState<FamilyComponentProps>(initialFamilyModule.defaultProps)

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
    () => ({ text, emphasisIndices: parseEmphasisIndices(emphasisText), alignment, maxLines }),
    [text, emphasisText, alignment, maxLines],
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
  const patchedGraphPreview = baseGraphScene ? previewPatchedScene(baseGraphScene, graphPatches) : null
  const currentGraphScene = patchedGraphPreview?.scene ?? null
  const applicableGraphPatches = patchedGraphPreview?.patches ?? []
  const resolvedGraphScene = currentGraphScene ? evaluateScene(currentGraphScene, context) : null
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
    setGraphPatches([])
    setSelectedGraphNodeId(null)
  }

  const appendGraphPatches = (patches: readonly MotionGraphPatchV1[]) => {
    setGraphPatches((current) => {
      let next = [...current]
      for (const patch of patches) {
        const identity = patchIdentity(patch)
        if (identity) next = next.filter((candidate) => patchIdentity(candidate) !== identity)
        next.push(patch)
      }
      return Object.freeze(next)
    })
  }

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
    }
    if (isHeadline) {
      if (propertyId === 'text') return text
      if (propertyId === 'emphasisIndices') return emphasisText
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
    }
    if (isHeadline) {
      if (propertyId === 'text') { setText(String(value)); return }
      if (propertyId === 'emphasisIndices') { setEmphasisText(String(value)); return }
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
      appendGraphPatches([{ op: 'set-property', target: { nodeId: exposure.target.nodeId, property: exposure.target.property }, value: constant(value) }])
      return
    }
    if (exposure.target.kind === 'part' && currentGraphScene && resolvedGraphScene) {
      const target = exposure.target
      const part = currentGraphScene.semanticParts.find((candidate) => candidate.id === target.semanticPartId)
      const patches = part?.nodeIds
        .filter((nodeId) => {
          const node = resolvedGraphScene.nodes[nodeId]
          return Boolean(node) && nodeSupportsProperty(node!, target.property)
        })
        .map((nodeId): MotionGraphPatchV1 => ({ op: 'set-property', target: { nodeId, property: target.property }, value: constant(value) })) ?? []
      appendGraphPatches(patches)
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
          <span>{currentDefinition.id}</span>
          <strong>v{currentDefinition.version}</strong>
          <span>{currentDefinition.performanceClass}</span>
        </div>
      </header>

      <section className="motion-lab__body">
        <aside className="motion-lab__browser" aria-label="Component browser">
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
        </aside>

        <section className="motion-lab__stage-column">
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

          <div className="motion-lab__preview-host" ref={previewHostRef}>
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
                </>
              )}
            >
              <div style={{ position: 'absolute', inset: 0, ...previewBackgroundStyle(background) }} />
              {isFamily && familyRenderable && familyModule && validatedFamilyProps && validatedFamilyStyle ? (
                <MotionComponentHost module={familyModule} props={validatedFamilyProps} style={validatedFamilyStyle} context={context} graphPatches={applicableGraphPatches} selectedGraphNodeId={selectedGraphNodeId} />
              ) : isHeadline && headlineRenderable && validatedHeadlineProps && validatedHeadlineStyle ? (
                <MotionComponentHost module={KineticHeadlineModule} props={validatedHeadlineProps} style={validatedHeadlineStyle} context={context} graphPatches={applicableGraphPatches} selectedGraphNodeId={selectedGraphNodeId} />
              ) : isChecklist && checklistRenderable && validatedChecklistProps && validatedChecklistStyle ? (
                <MotionComponentHost module={ChecklistCardModule} props={validatedChecklistProps} style={validatedChecklistStyle} context={context} graphPatches={applicableGraphPatches} selectedGraphNodeId={selectedGraphNodeId} />
              ) : isCostValue && costValueRenderable && validatedCostValueProps && validatedCostValueStyle ? (
                <MotionComponentHost module={CostValueCardModule} props={validatedCostValueProps} style={validatedCostValueStyle} context={context} graphPatches={applicableGraphPatches} selectedGraphNodeId={selectedGraphNodeId} />
              ) : isTimer && timerRenderable && validatedTimerProps && validatedTimerStyle ? (
                <MotionComponentHost module={TimerStatusPillModule} props={validatedTimerProps} style={validatedTimerStyle} context={context} graphPatches={applicableGraphPatches} selectedGraphNodeId={selectedGraphNodeId} />
              ) : isTeamNetwork && teamNetworkRenderable && validatedTeamNetworkProps && validatedTeamNetworkStyle ? (
                <MotionComponentHost module={TeamNetworkDiagramModule} props={validatedTeamNetworkProps} style={validatedTeamNetworkStyle} context={context} graphPatches={applicableGraphPatches} selectedGraphNodeId={selectedGraphNodeId} />
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

          <div className="motion-lab__event-strip">
            {currentDefinition.events.map((event) => (
              <div key={event.name} className="motion-lab__event" style={{ left: `${event.normalizedTime * 100}%` }} title={`${event.name} @ ${event.normalizedTime}`}>
                <span />
                <small>{event.name}</small>
              </div>
            ))}
          </div>

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
            exposures={graphExposures}
            scene={currentGraphScene}
            resolvedScene={resolvedGraphScene}
            readExposure={readExposure}
            writeExposure={writeExposure}
            selectedNodeId={selectedGraphNodeId}
            onSelectNode={setSelectedGraphNodeId}
            onPatch={(patch) => appendGraphPatches([patch])}
          />
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
