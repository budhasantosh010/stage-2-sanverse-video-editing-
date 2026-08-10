import { TIMELINE_TRACK_IDS, isTimelineTrackId } from '@sanverse/edit-domain'
import { isStableTimelineTrackId } from '@sanverse/edit-domain/timeline-tracks'

import {
  DEFAULT_VERTICAL_ZOOM_BASIS_POINTS,
  type TimelineVerticalZoomV1,
} from './timeline-zoom-presentation'

/**
 * How tall each row is drawn, and whether it is folded away.
 *
 * This is workspace presentation, never project/edit authority. T5 stores new
 * values by stable Track Model V2 id (`track_...`). Legacy V/A/C display ids are
 * still accepted on read so a T4 browser preference can be migrated when the
 * project first opens after T5.
 */
export const TRACK_PRESENTATION_SCHEMA_VERSION = 'sanverse.timeline-track-presentation/v1'

export const TRACK_HEIGHT_PRESETS = Object.freeze(['compact', 'standard', 'tall'] as const)
export type TrackHeightPreset = (typeof TRACK_HEIGHT_PRESETS)[number]

export const TRACK_HEIGHT_PX: Readonly<Record<TrackHeightPreset, number>> = Object.freeze({
  compact: 34,
  standard: 56,
  tall: 96,
})

export const MIN_TRACK_HEIGHT_PX = 24
export const MAX_TRACK_HEIGHT_PX = 240
export const COLLAPSED_TRACK_HEIGHT_PX = 14

export type TrackPresentationV1 = Readonly<{
  schemaVersion: typeof TRACK_PRESENTATION_SCHEMA_VERSION
  /** Stable ids after reconciliation; legacy aliases may exist only immediately after parsing old storage. */
  heights: Readonly<Record<string, TrackHeightPreset | number>>
  collapsed: readonly string[]
}>

export const DEFAULT_TRACK_PRESENTATION: TrackPresentationV1 = Object.freeze({
  schemaVersion: TRACK_PRESENTATION_SCHEMA_VERSION,
  heights: Object.freeze({}),
  collapsed: Object.freeze([]),
})

const isTrackHeightPreset = (value: unknown): value is TrackHeightPreset =>
  typeof value === 'string' && (TRACK_HEIGHT_PRESETS as readonly string[]).includes(value)

const isPresentationTrackReference = (value: unknown): value is string =>
  isTimelineTrackId(value) || isStableTimelineTrackId(value)

export const trackHeightPx = (
  state: TrackPresentationV1,
  trackId: string,
  fallbackPx: number,
): number => {
  if (state.collapsed.includes(trackId)) return COLLAPSED_TRACK_HEIGHT_PX
  const stored = state.heights[trackId]
  if (isTrackHeightPreset(stored)) return TRACK_HEIGHT_PX[stored]
  if (typeof stored === 'number' && Number.isFinite(stored)) {
    return Math.min(MAX_TRACK_HEIGHT_PX, Math.max(MIN_TRACK_HEIGHT_PX, Math.round(stored)))
  }
  return fallbackPx
}

export const effectiveTrackHeightPx = (
  state: TrackPresentationV1,
  zoom: TimelineVerticalZoomV1,
  trackId: string,
  fallbackPx: number,
): number => {
  if (state.collapsed.includes(trackId)) return COLLAPSED_TRACK_HEIGHT_PX
  const base = trackHeightPx(state, trackId, fallbackPx)
  const basisPoints = Number.isFinite(zoom.scaleBasisPoints)
    ? zoom.scaleBasisPoints
    : DEFAULT_VERTICAL_ZOOM_BASIS_POINTS
  return Math.min(
    MAX_TRACK_HEIGHT_PX,
    Math.max(MIN_TRACK_HEIGHT_PX, Math.round(base * basisPoints / DEFAULT_VERTICAL_ZOOM_BASIS_POINTS)),
  )
}

export const isTrackCollapsed = (state: TrackPresentationV1, trackId: string): boolean =>
  state.collapsed.includes(trackId)

export const setTrackHeight = (
  state: TrackPresentationV1,
  trackId: string,
  height: TrackHeightPreset | number,
): TrackPresentationV1 =>
  Object.freeze({
    schemaVersion: TRACK_PRESENTATION_SCHEMA_VERSION,
    heights: Object.freeze({
      ...state.heights,
      [trackId]: typeof height === 'number'
        ? Math.min(MAX_TRACK_HEIGHT_PX, Math.max(MIN_TRACK_HEIGHT_PX, Math.round(height)))
        : height,
    }),
    collapsed: Object.freeze(state.collapsed.filter((id) => id !== trackId)),
  })

export const toggleTrackCollapsed = (
  state: TrackPresentationV1,
  trackId: string,
): TrackPresentationV1 =>
  Object.freeze({
    schemaVersion: TRACK_PRESENTATION_SCHEMA_VERSION,
    heights: state.heights,
    collapsed: Object.freeze(
      state.collapsed.includes(trackId)
        ? state.collapsed.filter((id) => id !== trackId)
        : [...state.collapsed, trackId],
    ),
  })

export const fitTrackHeights = (
  state: TrackPresentationV1,
  availableHeightPx: number,
  trackIds: readonly string[] = TIMELINE_TRACK_IDS,
): TrackPresentationV1 => {
  const open = trackIds.filter((trackId) => !state.collapsed.includes(trackId))
  if (open.length === 0) return state
  const usedByFolded = (trackIds.length - open.length) * COLLAPSED_TRACK_HEIGHT_PX
  const each = Math.floor(Math.max(0, availableHeightPx - usedByFolded) / open.length)
  const bounded = Math.min(MAX_TRACK_HEIGHT_PX, Math.max(MIN_TRACK_HEIGHT_PX, each))
  const heights: Record<string, number> = {}
  for (const trackId of open) heights[trackId] = bounded
  return Object.freeze({
    schemaVersion: TRACK_PRESENTATION_SCHEMA_VERSION,
    heights: Object.freeze({ ...state.heights, ...heights }),
    collapsed: state.collapsed,
  })
}

export const resetTrackPresentation = (): TrackPresentationV1 => DEFAULT_TRACK_PRESENTATION

export const parseTrackPresentation = (raw: unknown): TrackPresentationV1 => {
  if (typeof raw !== 'string' || raw.length === 0) return DEFAULT_TRACK_PRESENTATION
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return DEFAULT_TRACK_PRESENTATION }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_TRACK_PRESENTATION
  const record = parsed as Record<string, unknown>
  if (record.schemaVersion !== TRACK_PRESENTATION_SCHEMA_VERSION) return DEFAULT_TRACK_PRESENTATION

  const heights: Record<string, TrackHeightPreset | number> = {}
  if (typeof record.heights === 'object' && record.heights !== null && !Array.isArray(record.heights)) {
    for (const [key, value] of Object.entries(record.heights as Record<string, unknown>)) {
      if (!isPresentationTrackReference(key)) continue
      if (isTrackHeightPreset(value)) heights[key] = value
      else if (typeof value === 'number' && Number.isFinite(value)) {
        heights[key] = Math.min(MAX_TRACK_HEIGHT_PX, Math.max(MIN_TRACK_HEIGHT_PX, Math.round(value)))
      }
    }
  }
  const collapsed = Array.isArray(record.collapsed)
    ? record.collapsed.filter(isPresentationTrackReference)
    : []
  return Object.freeze({
    schemaVersion: TRACK_PRESENTATION_SCHEMA_VERSION,
    heights: Object.freeze(heights),
    collapsed: Object.freeze([...new Set(collapsed)]),
  })
}

export type TrackPresentationIdentity = Readonly<{
  trackId: string
  /** T0–T4 row alias, such as V1/A2, when this is a migrated legacy row. */
  legacyDisplayId: string | null
}>

/**
 * Convert legacy V1/V2/C1/A1/A2 workspace preferences to the exact current
 * stable ids and discard preferences for tracks that no longer exist.
 */
export const reconcileTrackPresentation = (
  state: TrackPresentationV1,
  tracks: readonly TrackPresentationIdentity[],
): TrackPresentationV1 => {
  const heights: Record<string, TrackHeightPreset | number> = {}
  const collapsed: string[] = []
  for (const track of tracks) {
    if (!isStableTimelineTrackId(track.trackId)) continue
    const stored = state.heights[track.trackId]
      ?? (track.legacyDisplayId ? state.heights[track.legacyDisplayId] : undefined)
    if (stored !== undefined) heights[track.trackId] = stored
    if (
      state.collapsed.includes(track.trackId) ||
      (track.legacyDisplayId !== null && state.collapsed.includes(track.legacyDisplayId))
    ) collapsed.push(track.trackId)
  }
  return Object.freeze({
    schemaVersion: TRACK_PRESENTATION_SCHEMA_VERSION,
    heights: Object.freeze(heights),
    collapsed: Object.freeze(collapsed),
  })
}

const storageKey = (projectId: string): string => `sanverse.timeline-track-presentation.${projectId}`

export const readTrackPresentation = (projectId: string): TrackPresentationV1 => {
  try {
    return parseTrackPresentation(globalThis.localStorage?.getItem(storageKey(projectId)))
  } catch {
    return DEFAULT_TRACK_PRESENTATION
  }
}

export const writeTrackPresentation = (projectId: string, state: TrackPresentationV1): void => {
  try {
    globalThis.localStorage?.setItem(storageKey(projectId), JSON.stringify(state))
  } catch {
    // Presentation can be lost; the project must remain usable.
  }
}
