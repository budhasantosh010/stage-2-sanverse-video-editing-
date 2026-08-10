import { isStableTimelineTrackId } from '@sanverse/edit-domain/timeline-tracks'

/**
 * How a real audio waveform is drawn in the Timeline.
 *
 * This is a workspace preference, not an edit. Switching Combined/Separate
 * must never create a project revision, Undo entry, API edit, or export change.
 * The decoder still owns the truth about whether separate L/R channels exist;
 * asking for Separate on mono/unknown audio simply falls back to Combined.
 */
export const TIMELINE_WAVEFORM_PRESENTATION_SCHEMA_VERSION = 'sanverse.timeline-waveform-presentation/v1' as const

export const AUDIO_CHANNEL_DISPLAY_MODES = Object.freeze(['combined', 'separate'] as const)
export type AudioChannelDisplayMode = (typeof AUDIO_CHANNEL_DISPLAY_MODES)[number]

export type TimelineWaveformPresentationV1 = Readonly<{
  schemaVersion: typeof TIMELINE_WAVEFORM_PRESENTATION_SCHEMA_VERSION
  /** Stable Track Model V2 ids only. Missing means Combined. */
  modes: Readonly<Record<string, AudioChannelDisplayMode>>
}>

export const DEFAULT_TIMELINE_WAVEFORM_PRESENTATION: TimelineWaveformPresentationV1 = Object.freeze({
  schemaVersion: TIMELINE_WAVEFORM_PRESENTATION_SCHEMA_VERSION,
  modes: Object.freeze({}),
})

const isMode = (value: unknown): value is AudioChannelDisplayMode =>
  typeof value === 'string' && (AUDIO_CHANNEL_DISPLAY_MODES as readonly string[]).includes(value)

export const waveformDisplayModeForTrack = (
  state: TimelineWaveformPresentationV1,
  trackId: string,
): AudioChannelDisplayMode => state.modes[trackId] ?? 'combined'

export const setWaveformDisplayMode = (
  state: TimelineWaveformPresentationV1,
  trackId: string,
  mode: AudioChannelDisplayMode,
): TimelineWaveformPresentationV1 => {
  if (!isStableTimelineTrackId(trackId) || !isMode(mode)) return state
  const modes = { ...state.modes }
  if (mode === 'combined') delete modes[trackId]
  else modes[trackId] = mode
  return Object.freeze({
    schemaVersion: TIMELINE_WAVEFORM_PRESENTATION_SCHEMA_VERSION,
    modes: Object.freeze(modes),
  })
}

/** Drop preferences for tracks that no longer exist; never manufacture ids. */
export const reconcileTimelineWaveformPresentation = (
  state: TimelineWaveformPresentationV1,
  stableTrackIds: readonly string[],
): TimelineWaveformPresentationV1 => {
  const allowed = new Set(stableTrackIds.filter(isStableTimelineTrackId))
  const modes: Record<string, AudioChannelDisplayMode> = {}
  for (const [trackId, mode] of Object.entries(state.modes)) {
    if (allowed.has(trackId) && mode === 'separate') modes[trackId] = mode
  }
  return Object.freeze({
    schemaVersion: TIMELINE_WAVEFORM_PRESENTATION_SCHEMA_VERSION,
    modes: Object.freeze(modes),
  })
}

export const parseTimelineWaveformPresentation = (raw: unknown): TimelineWaveformPresentationV1 => {
  if (typeof raw !== 'string' || raw.length === 0) return DEFAULT_TIMELINE_WAVEFORM_PRESENTATION
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return DEFAULT_TIMELINE_WAVEFORM_PRESENTATION }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_TIMELINE_WAVEFORM_PRESENTATION
  const record = parsed as Record<string, unknown>
  if (record.schemaVersion !== TIMELINE_WAVEFORM_PRESENTATION_SCHEMA_VERSION) return DEFAULT_TIMELINE_WAVEFORM_PRESENTATION
  if (typeof record.modes !== 'object' || record.modes === null || Array.isArray(record.modes)) return DEFAULT_TIMELINE_WAVEFORM_PRESENTATION
  const modes: Record<string, AudioChannelDisplayMode> = {}
  for (const [trackId, value] of Object.entries(record.modes as Record<string, unknown>)) {
    if (!isStableTimelineTrackId(trackId) || !isMode(value)) continue
    // Combined is the default and is deliberately not persisted.
    if (value === 'separate') modes[trackId] = value
  }
  return Object.freeze({
    schemaVersion: TIMELINE_WAVEFORM_PRESENTATION_SCHEMA_VERSION,
    modes: Object.freeze(modes),
  })
}

const storageKey = (projectId: string): string => `sanverse.timeline-waveform-presentation.${projectId}`

export const readTimelineWaveformPresentation = (projectId: string): TimelineWaveformPresentationV1 => {
  try {
    return parseTimelineWaveformPresentation(globalThis.localStorage?.getItem(storageKey(projectId)))
  } catch {
    return DEFAULT_TIMELINE_WAVEFORM_PRESENTATION
  }
}

export const writeTimelineWaveformPresentation = (
  projectId: string,
  state: TimelineWaveformPresentationV1,
): void => {
  try {
    globalThis.localStorage?.setItem(storageKey(projectId), JSON.stringify(state))
  } catch {
    // A browser preference may be lost; the project itself must still open.
  }
}
