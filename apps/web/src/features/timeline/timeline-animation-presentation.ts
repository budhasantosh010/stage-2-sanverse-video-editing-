import type {
  EditorAnimationPropertyIdV1,
  EditorAnimationTargetRefV1,
  EditorAnimationTimeContextV1,
  EditorAnimationTrackStateV1,
  EditorKeyframeAddressV1,
  EditorKeyframeSelectionV1,
} from '@sanverse/edit-domain'

export const TIMELINE_ANIMATION_PRESENTATION_SCHEMA_VERSION = 'sanverse.timeline-animation-presentation/v1'
export const TIMELINE_ANIMATION_PRESENTATION_STORAGE_PREFIX = 'sanverse.timeline-animation-presentation'
export const ANIMATION_PROPERTY_LANE_HEIGHT_PX = 30
export const MIN_GRAPH_HEIGHT_PX = 160
export const MAX_GRAPH_HEIGHT_PX = 480

export type TimelineAnimationVisibleModeV1 = 'animated' | 'all'

export type TimelineAnimationGraphViewportV1 = Readonly<{
  panX: number
  panY: number
  zoomX: number
  zoomY: number
}>

export type TimelineAnimationPresentationV1 = Readonly<{
  schemaVersion: typeof TIMELINE_ANIMATION_PRESENTATION_SCHEMA_VERSION
  expandedTargetKeys: readonly string[]
  visibleMode: TimelineAnimationVisibleModeV1
  activeProperty: EditorAnimationPropertyIdV1 | null
  graphOpen: boolean
  graphHeightPx: number
  graphViewport: TimelineAnimationGraphViewportV1
}>

export type TimelineAnimationSubjectV1 = Readonly<{
  itemId: string
  laneId: string
  label: string
  target: EditorAnimationTargetRefV1
  state: EditorAnimationTrackStateV1
  timeContext: EditorAnimationTimeContextV1
  sourceAnchored: boolean
}>

export const DEFAULT_TIMELINE_ANIMATION_PRESENTATION: TimelineAnimationPresentationV1 = Object.freeze({
  schemaVersion: TIMELINE_ANIMATION_PRESENTATION_SCHEMA_VERSION,
  expandedTargetKeys: Object.freeze([]),
  visibleMode: 'animated',
  activeProperty: null,
  graphOpen: false,
  graphHeightPx: 220,
  graphViewport: Object.freeze({ panX: 0, panY: 0, zoomX: 1, zoomY: 1 }),
})

const PROPERTIES: readonly EditorAnimationPropertyIdV1[] = Object.freeze([
  'translate-x', 'translate-y', 'scale', 'rotation', 'opacity',
  'crop-top', 'crop-right', 'crop-bottom', 'crop-left',
])

export const animationTargetKey = (target: EditorAnimationTargetRefV1): string =>
  target.kind === 'primary-footage-motion'
    ? `source:${target.motionId}:${target.assetId}`
    : `visual:${target.visualId}`

const sameTarget = (left: EditorAnimationTargetRefV1, right: EditorAnimationTargetRefV1): boolean =>
  animationTargetKey(left) === animationTargetKey(right)

export const keyframeAddressKey = (address: EditorKeyframeAddressV1): string =>
  `${animationTargetKey(address.target)}:${address.property}:${address.canonicalAtTicks}`

export const keyframeAddressEqual = (left: EditorKeyframeAddressV1, right: EditorKeyframeAddressV1): boolean =>
  left.property === right.property && left.canonicalAtTicks === right.canonicalAtTicks && sameTarget(left.target, right.target)

const frozenSelection = (
  addresses: readonly EditorKeyframeAddressV1[],
  anchor: EditorKeyframeAddressV1 | null,
): EditorKeyframeSelectionV1 => Object.freeze({
  addresses: Object.freeze([...addresses]),
  anchor,
})

export const clearEditorKeyframeSelection = (): EditorKeyframeSelectionV1 =>
  frozenSelection([], null)

export const selectOnlyEditorKeyframe = (address: EditorKeyframeAddressV1): EditorKeyframeSelectionV1 =>
  frozenSelection([address], address)

export const toggleEditorKeyframeSelection = (
  current: EditorKeyframeSelectionV1,
  address: EditorKeyframeAddressV1,
): EditorKeyframeSelectionV1 => {
  const exists = current.addresses.some((candidate) => keyframeAddressEqual(candidate, address))
  const addresses = exists
    ? current.addresses.filter((candidate) => !keyframeAddressEqual(candidate, address))
    : [...current.addresses, address]
  return frozenSelection(addresses, exists ? current.anchor : address)
}

export const extendEditorKeyframeSelection = (
  current: EditorKeyframeSelectionV1,
  address: EditorKeyframeAddressV1,
  orderedCanonicalTicks: readonly number[],
): EditorKeyframeSelectionV1 => {
  const anchor = current.anchor
  if (!anchor || !sameTarget(anchor.target, address.target) || anchor.property !== address.property) {
    return selectOnlyEditorKeyframe(address)
  }
  const startIndex = orderedCanonicalTicks.indexOf(anchor.canonicalAtTicks)
  const endIndex = orderedCanonicalTicks.indexOf(address.canonicalAtTicks)
  if (startIndex < 0 || endIndex < 0) return selectOnlyEditorKeyframe(address)
  const low = Math.min(startIndex, endIndex)
  const high = Math.max(startIndex, endIndex)
  const addresses = orderedCanonicalTicks.slice(low, high + 1).map((canonicalAtTicks) => Object.freeze({
    target: address.target,
    property: address.property,
    canonicalAtTicks,
  }))
  return frozenSelection(addresses, anchor)
}

export const selectAllEditorKeyframesInProperty = (
  target: EditorAnimationTargetRefV1,
  property: EditorAnimationPropertyIdV1,
  canonicalTicks: readonly number[],
): EditorKeyframeSelectionV1 => {
  const addresses = canonicalTicks.map((canonicalAtTicks) => Object.freeze({ target, property, canonicalAtTicks }))
  return frozenSelection(addresses, addresses[0] ?? null)
}

export const selectionForTarget = (
  selection: EditorKeyframeSelectionV1,
  target: EditorAnimationTargetRefV1,
): readonly EditorKeyframeAddressV1[] => Object.freeze(
  selection.addresses.filter((address) => sameTarget(address.target, target)),
)

export const reconcileEditorKeyframeSelection = (
  selection: EditorKeyframeSelectionV1,
  subject: TimelineAnimationSubjectV1 | null,
): EditorKeyframeSelectionV1 => {
  if (!subject) return clearEditorKeyframeSelection()
  const available = new Set(subject.state.tracks.flatMap((track) =>
    track.keyframes.map((frame) => `${track.property}:${frame.at.ticks}`),
  ))
  const addresses = selection.addresses.filter((address) =>
    sameTarget(address.target, subject.target) && available.has(`${address.property}:${address.canonicalAtTicks}`),
  )
  const anchor = selection.anchor && addresses.some((address) => keyframeAddressEqual(address, selection.anchor!))
    ? selection.anchor
    : addresses[0] ?? null
  return frozenSelection(addresses, anchor)
}

export const animationPresentationForTarget = (
  current: TimelineAnimationPresentationV1,
  target: EditorAnimationTargetRefV1,
  expanded: boolean,
): TimelineAnimationPresentationV1 => {
  const key = animationTargetKey(target)
  const keys = new Set(current.expandedTargetKeys)
  if (expanded) keys.add(key)
  else keys.delete(key)
  return Object.freeze({ ...current, expandedTargetKeys: Object.freeze([...keys]) })
}

export const animationTargetExpanded = (
  current: TimelineAnimationPresentationV1,
  target: EditorAnimationTargetRefV1,
): boolean => current.expandedTargetKeys.includes(animationTargetKey(target))

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const plainRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const closedKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key)) && allowed.every((key) => Object.hasOwn(value, key))

export const validateTimelineAnimationPresentation = (input: unknown): TimelineAnimationPresentationV1 | null => {
  if (!plainRecord(input) || !closedKeys(input, ['schemaVersion', 'expandedTargetKeys', 'visibleMode', 'activeProperty', 'graphOpen', 'graphHeightPx', 'graphViewport'])) return null
  if (input.schemaVersion !== TIMELINE_ANIMATION_PRESENTATION_SCHEMA_VERSION) return null
  if (!Array.isArray(input.expandedTargetKeys) || !input.expandedTargetKeys.every((key) => typeof key === 'string' && key.length > 0)) return null
  if (input.visibleMode !== 'animated' && input.visibleMode !== 'all') return null
  if (input.activeProperty !== null && !PROPERTIES.includes(input.activeProperty as EditorAnimationPropertyIdV1)) return null
  if (typeof input.graphOpen !== 'boolean') return null
  if (!finite(input.graphHeightPx) || input.graphHeightPx < MIN_GRAPH_HEIGHT_PX || input.graphHeightPx > MAX_GRAPH_HEIGHT_PX) return null
  if (!plainRecord(input.graphViewport) || !closedKeys(input.graphViewport, ['panX', 'panY', 'zoomX', 'zoomY'])) return null
  const viewport = input.graphViewport as Record<string, unknown>
  if (!finite(viewport.panX) || !finite(viewport.panY) || !finite(viewport.zoomX) || !finite(viewport.zoomY)) return null
  if ((viewport.zoomX as number) < 0.1 || (viewport.zoomX as number) > 20 || (viewport.zoomY as number) < 0.1 || (viewport.zoomY as number) > 20) return null
  return Object.freeze({
    schemaVersion: TIMELINE_ANIMATION_PRESENTATION_SCHEMA_VERSION,
    expandedTargetKeys: Object.freeze([...(input.expandedTargetKeys as string[])]),
    visibleMode: input.visibleMode,
    activeProperty: input.activeProperty as EditorAnimationPropertyIdV1 | null,
    graphOpen: input.graphOpen,
    graphHeightPx: input.graphHeightPx,
    graphViewport: Object.freeze({
      panX: viewport.panX as number,
      panY: viewport.panY as number,
      zoomX: viewport.zoomX as number,
      zoomY: viewport.zoomY as number,
    }),
  })
}

const storageKey = (projectId: string): string => `${TIMELINE_ANIMATION_PRESENTATION_STORAGE_PREFIX}:${projectId}`

export const readTimelineAnimationPresentation = (projectId: string): TimelineAnimationPresentationV1 => {
  try {
    const stored = globalThis.localStorage?.getItem(storageKey(projectId))
    if (!stored) return DEFAULT_TIMELINE_ANIMATION_PRESENTATION
    return validateTimelineAnimationPresentation(JSON.parse(stored)) ?? DEFAULT_TIMELINE_ANIMATION_PRESENTATION
  } catch {
    return DEFAULT_TIMELINE_ANIMATION_PRESENTATION
  }
}

export const writeTimelineAnimationPresentation = (
  projectId: string,
  presentation: TimelineAnimationPresentationV1,
): void => {
  try {
    globalThis.localStorage?.setItem(storageKey(projectId), JSON.stringify(presentation))
  } catch {
    // Presentation persistence is optional. Editing must continue when storage is unavailable.
  }
}
