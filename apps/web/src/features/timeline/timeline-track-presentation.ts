import { TIMELINE_TRACK_IDS, type TimelineTrackId } from '@sanverse/edit-domain'

import {
  DEFAULT_VERTICAL_ZOOM_BASIS_POINTS,
  type TimelineVerticalZoomV1,
} from './timeline-zoom-presentation'

/**
 * How tall each row is drawn, and whether it is folded away.
 *
 * ## Why this is NOT part of the project
 *
 * Exactly the same argument as the padlocks in `timeline-lock-state.ts`. Making
 * a row taller so you can see the waveform changes nothing about the finished
 * video. If it lived in the project it would:
 *
 *   - take a revision, so resizing a row would look like an edit;
 *   - take a slot in Undo, so pressing Undo after resizing would put the row
 *     back instead of undoing the cut the user actually wants back;
 *   - and — before the export key was fixed — throw away a finished export.
 *
 * There is a fourth reason that is specific to this one. Row height is about the
 * SCREEN, and two people opening the same project do not have the same screen. A
 * height that suits a 27-inch monitor is unusable on a laptop. Carrying it in
 * the project would push one person's monitor onto another person's laptop.
 *
 * So it lives in the browser, keyed by project, exactly like the padlocks.
 */
export const TRACK_PRESENTATION_SCHEMA_VERSION = 'sanverse.timeline-track-presentation/v1'

/**
 * The three named sizes, and what each is for.
 *
 * Named rather than free numbers because a user asked to pick a number picks
 * badly — too small to read, or so tall that two rows fill the panel. The names
 * describe the JOB, not the pixels: "I need to see more rows" versus "I need to
 * see this waveform properly".
 *
 * A custom height still exists for the one person who genuinely wants 92 pixels,
 * and it is bounded so it can never be dragged to nothing.
 */
export const TRACK_HEIGHT_PRESETS = Object.freeze(['compact', 'standard', 'tall'] as const)
export type TrackHeightPreset = (typeof TRACK_HEIGHT_PRESETS)[number]

export const TRACK_HEIGHT_PX: Readonly<Record<TrackHeightPreset, number>> = Object.freeze({
  compact: 34,
  standard: 56,
  tall: 96,
})

/** A row can never be dragged smaller than this. Below it the label is unreadable. */
export const MIN_TRACK_HEIGHT_PX = 24
/** Nor larger than this. Beyond it one row fills the panel and hides the rest. */
export const MAX_TRACK_HEIGHT_PX = 240
/** A folded row keeps a thin strip so it can still be found and unfolded. */
export const COLLAPSED_TRACK_HEIGHT_PX = 14

export type TrackPresentationV1 = Readonly<{
  schemaVersion: typeof TRACK_PRESENTATION_SCHEMA_VERSION
  /** Named size or an exact number of pixels, per track. */
  heights: Readonly<Partial<Record<TimelineTrackId, TrackHeightPreset | number>>>
  collapsed: readonly TimelineTrackId[]
}>

export const DEFAULT_TRACK_PRESENTATION: TrackPresentationV1 = Object.freeze({
  schemaVersion: TRACK_PRESENTATION_SCHEMA_VERSION,
  heights: Object.freeze({}),
  collapsed: Object.freeze([]),
})

const isTrackHeightPreset = (value: unknown): value is TrackHeightPreset =>
  typeof value === 'string' && (TRACK_HEIGHT_PRESETS as readonly string[]).includes(value)

/**
 * How tall this row actually is, right now.
 *
 * `fallbackPx` is what the timeline already worked out from the window width, so
 * a user who has never touched any of this gets exactly the behaviour they had
 * before — the rows still shrink sensibly on a small screen.
 */
export const trackHeightPx = (
  state: TrackPresentationV1,
  trackId: TimelineTrackId,
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

/**
 * Apply the global vertical zoom to the stored BASE height.
 *
 * Folding stays a fixed 14-pixel strip. The multiplier never overwrites a
 * preset or custom height, so returning to 100% restores the exact base value.
 */
export const effectiveTrackHeightPx = (
  state: TrackPresentationV1,
  zoom: TimelineVerticalZoomV1,
  trackId: TimelineTrackId,
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

export const isTrackCollapsed = (state: TrackPresentationV1, trackId: TimelineTrackId): boolean =>
  state.collapsed.includes(trackId)

export const setTrackHeight = (
  state: TrackPresentationV1,
  trackId: TimelineTrackId,
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
    // Setting a height unfolds the row. Asking for a height and getting a folded
    // strip would look like the control was ignored.
    collapsed: Object.freeze(state.collapsed.filter((id) => id !== trackId)),
  })

export const toggleTrackCollapsed = (
  state: TrackPresentationV1,
  trackId: TimelineTrackId,
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

/**
 * Fit tracks — make every row fit the space there is.
 *
 * Divides the available height between the rows that are not folded away, then
 * holds the result inside the same bounds a dragged row obeys. Folded rows keep
 * their thin strip and are not counted, which is the point of folding one.
 *
 * When there is not enough room even at the minimum, every row gets the minimum
 * and the timeline scrolls. Squeezing them below the readable size to avoid a
 * scrollbar would trade a scrollbar for rows nobody can read.
 */
export const fitTrackHeights = (
  state: TrackPresentationV1,
  availableHeightPx: number,
): TrackPresentationV1 => {
  const open = TIMELINE_TRACK_IDS.filter((trackId) => !state.collapsed.includes(trackId))
  if (open.length === 0) return state
  const usedByFolded = (TIMELINE_TRACK_IDS.length - open.length) * COLLAPSED_TRACK_HEIGHT_PX
  const each = Math.floor(Math.max(0, availableHeightPx - usedByFolded) / open.length)
  const bounded = Math.min(MAX_TRACK_HEIGHT_PX, Math.max(MIN_TRACK_HEIGHT_PX, each))
  const heights: Partial<Record<TimelineTrackId, number>> = {}
  for (const trackId of open) heights[trackId] = bounded
  return Object.freeze({
    schemaVersion: TRACK_PRESENTATION_SCHEMA_VERSION,
    heights: Object.freeze({ ...state.heights, ...heights }),
    collapsed: state.collapsed,
  })
}

/** Every row back to the size the window decides. */
export const resetTrackPresentation = (): TrackPresentationV1 => DEFAULT_TRACK_PRESENTATION

/**
 * Read whatever is stored, and refuse to trust any of it.
 *
 * Anything unrecognised produces the default, exactly as the padlocks do. A
 * corrupted workspace setting must never stop somebody opening their project,
 * and the safe direction here is "the sizes the window would have chosen".
 */
export const parseTrackPresentation = (raw: unknown): TrackPresentationV1 => {
  if (typeof raw !== 'string' || raw.length === 0) return DEFAULT_TRACK_PRESENTATION
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_TRACK_PRESENTATION
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_TRACK_PRESENTATION
  const record = parsed as Record<string, unknown>
  if (record.schemaVersion !== TRACK_PRESENTATION_SCHEMA_VERSION) return DEFAULT_TRACK_PRESENTATION

  const heights: Partial<Record<TimelineTrackId, TrackHeightPreset | number>> = {}
  if (typeof record.heights === 'object' && record.heights !== null && !Array.isArray(record.heights)) {
    for (const [key, value] of Object.entries(record.heights as Record<string, unknown>)) {
      if (!(TIMELINE_TRACK_IDS as readonly string[]).includes(key)) continue
      if (isTrackHeightPreset(value)) heights[key as TimelineTrackId] = value
      else if (typeof value === 'number' && Number.isFinite(value)) {
        heights[key as TimelineTrackId] = Math.min(
          MAX_TRACK_HEIGHT_PX,
          Math.max(MIN_TRACK_HEIGHT_PX, Math.round(value)),
        )
      }
    }
  }

  const collapsed = Array.isArray(record.collapsed)
    ? record.collapsed.filter((id): id is TimelineTrackId =>
      (TIMELINE_TRACK_IDS as readonly string[]).includes(id as string))
    : []

  return Object.freeze({
    schemaVersion: TRACK_PRESENTATION_SCHEMA_VERSION,
    heights: Object.freeze(heights),
    collapsed: Object.freeze([...new Set(collapsed)]),
  })
}

const storageKey = (projectId: string): string => `sanverse.timeline-track-presentation.${projectId}`

export const readTrackPresentation = (projectId: string): TrackPresentationV1 => {
  try {
    return parseTrackPresentation(globalThis.localStorage?.getItem(storageKey(projectId)))
  } catch {
    // Private browsing and blocked storage both throw. Losing a row height is an
    // inconvenience; refusing to open the editor is not acceptable.
    return DEFAULT_TRACK_PRESENTATION
  }
}

export const writeTrackPresentation = (projectId: string, state: TrackPresentationV1): void => {
  try {
    globalThis.localStorage?.setItem(storageKey(projectId), JSON.stringify(state))
  } catch {
    // Same reasoning: this is a preference, not the user's work.
  }
}
