/**
 * What the base picture layer is actually doing, as one named state.
 *
 * Before this existed, four completely different situations all rendered as an
 * identical black rectangle: an intentional gap in the timeline, media still
 * loading, a seek in flight, and a genuine failure. The owner recorded exactly
 * that ambiguity — base footage went black while the overlay and the controls
 * stayed visible, and the monitor had no way to say which of the four it was.
 *
 * Deciding it here, as a pure function of typed inputs, means the answer can be
 * tested without a browser and cannot drift between the layer that paints and
 * the label that explains.
 */

import { HAVE_CURRENT_DATA } from '../../features/render-plan/media-readiness'

export {
  HAVE_CURRENT_DATA,
  HAVE_ENOUGH_DATA,
  HAVE_FUTURE_DATA,
  HAVE_METADATA,
  HAVE_NOTHING,
} from '../../features/render-plan/media-readiness'

export const MONITOR_BASE_FRAME_STATES = ['loading', 'ready', 'seeking', 'gap', 'error'] as const

export type MonitorBaseFrameState = (typeof MONITOR_BASE_FRAME_STATES)[number]

export type MonitorBaseFrameInput = Readonly<{
  /** A media source is attached at all. */
  hasSource: boolean
  /** `video.readyState`. */
  readyState: number
  /** `video.seeking`. */
  seeking: boolean
  /** A real media or rendering error was reported. */
  hasMediaError: boolean
  /**
   * The canonical composition mapping has no active source segment here.
   *
   * This is the ONLY input allowed to produce 'gap'. Pausing, seeking, waiting
   * on the motion canvas, resizing a panel, loading metadata, selecting an
   * overlay, and changing Fit/Fill must never set it.
   */
  inCanonicalGap: boolean
  /** At least one valid frame has been presented since the source was attached. */
  hasPresentedFrame: boolean
  /** Non-default footage motion needs the canvas rather than the native video. */
  motionActive: boolean
  /** The motion canvas currently holds a frame drawn from decodable video. */
  motionFrameValid: boolean
}>

/**
 * Order is the whole design here, so it is spelled out rather than implied.
 *
 * 1. A real error outranks everything. Reporting 'gap' over a decode failure
 *    would tell the user the black is intentional when it is not.
 * 2. No source at all is loading, not a gap. A gap is a statement about a
 *    timeline that exists.
 * 3. The canonical gap wins over readiness, because black there is the correct,
 *    intended output and matches the exported file exactly.
 * 4. A seek while a frame is already on screen is 'seeking', not 'loading' —
 *    we keep showing the previous valid frame rather than blanking. readyState
 *    routinely drops below HAVE_CURRENT_DATA mid-seek, so this must be checked
 *    before readiness or every seek would report 'loading'.
 * 5. Below HAVE_CURRENT_DATA with nothing ever shown, there is genuinely no
 *    picture yet.
 * 6. Motion is active but the canvas has never held a real frame — still
 *    loading. A canvas holding a slightly stale but real frame is 'ready': the
 *    user is looking at true pixels, one frame behind at worst, and surfacing a
 *    status for that would be noise.
 */
export const monitorBaseFrameState = (input: MonitorBaseFrameInput): MonitorBaseFrameState => {
  if (input.hasMediaError) return 'error'
  if (!input.hasSource) return 'loading'
  if (input.inCanonicalGap) return 'gap'
  if (input.seeking) return input.hasPresentedFrame ? 'seeking' : 'loading'
  if (input.readyState < HAVE_CURRENT_DATA) return input.hasPresentedFrame ? 'seeking' : 'loading'
  if (input.motionActive && !input.motionFrameValid && !input.hasPresentedFrame) return 'loading'
  return 'ready'
}

/**
 * The one sentence the monitor is allowed to show for each state.
 *
 * 'ready' returns null because a working preview must say nothing at all.
 */
export const monitorBaseFrameMessage = (state: MonitorBaseFrameState): string | null => {
  switch (state) {
    case 'loading':
      return 'Loading frame…'
    case 'seeking':
      return 'Seeking…'
    case 'gap':
      return 'No media at this time'
    case 'error':
      return 'Preview unavailable'
    default:
      return null
  }
}

/**
 * Whether the deliberate black gap layer covers the picture.
 *
 * Routing this through the state machine is what makes A6 structural: there is
 * no other expression anywhere that can turn the black layer on, so a pause, a
 * seek, a resize, or a waiting canvas cannot produce one.
 */
export const showsGapLayer = (state: MonitorBaseFrameState): boolean => state === 'gap'

/** Whether the monitor should keep the last valid picture rather than blanking. */
export const retainsPreviousFrame = (state: MonitorBaseFrameState): boolean =>
  state === 'seeking'

export const isMonitorBaseFrameState = (value: unknown): value is MonitorBaseFrameState =>
  typeof value === 'string' && (MONITOR_BASE_FRAME_STATES as readonly string[]).includes(value)
