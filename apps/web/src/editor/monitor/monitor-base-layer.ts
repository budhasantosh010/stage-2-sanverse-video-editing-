/**
 * WHICH LAYER IS THE PICTURE RIGHT NOW.
 *
 * ## The defect this exists to make impossible
 *
 * The preview has two picture layers stacked on top of each other:
 *
 * ```
 *     z-index 1   motion canvas     <- transformed picture, opaque black behind it
 *     z-index 0   <video>           <- the real decoded video
 * ```
 *
 * The canvas was switched off with the HTML `hidden` attribute and switched on
 * again by removing it. That looks correct and is not, because the stylesheet
 * also said `.studio-screen__footage-motion-canvas { display: block }`. An
 * author rule beats the browser's own `[hidden] { display: none }`, so setting
 * `hidden` did nothing at all: a canvas that had never drawn a single frame
 * stayed on screen as an opaque black rectangle covering healthy video.
 *
 * A hover rule was then added to paper over it —
 * `.studio-screen__video:hover + .studio-screen__footage-motion-canvas
 * { opacity: 0 !important }` — which is exactly the behaviour the owner
 * recorded: pointer on the video, real footage; pointer away, black.
 *
 * ## The rule that replaces it
 *
 * Exactly one value decides what the user is looking at, it is computed from
 * typed inputs, and **the pointer is not one of those inputs**. There is no
 * expression anywhere else that can show or hide the base picture, so a hover,
 * a focus ring, a toolbar, or a panel resize structurally cannot change it.
 */

import { HAVE_CURRENT_DATA } from '../../features/render-plan/media-readiness'

export {
  motionCanvasFrameToken,
  type MotionCanvasFrameToken,
} from '../../features/render-plan/motion-frame-token'

export const MONITOR_BASE_LAYER_KINDS = [
  'native-video',
  'motion-canvas',
  'gap',
  'loading',
  'error',
] as const

export type MonitorBaseLayerKind = (typeof MONITOR_BASE_LAYER_KINDS)[number]

export type MonitorBaseLayer =
  | Readonly<{ kind: 'native-video' }>
  | Readonly<{ kind: 'motion-canvas'; frameToken: string }>
  | Readonly<{ kind: 'gap' }>
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error'; reason: string }>

export type MonitorBaseLayerInput = Readonly<{
  /** A media source is attached at all. */
  hasSource: boolean
  /** `video.readyState`. */
  readyState: number
  /** `video.seeking`. */
  seeking: boolean
  /** A real media or rendering failure, in the words shown to the user. */
  mediaError: string | null
  /**
   * The canonical composition mapping has no source segment at this tick.
   *
   * The ONLY input allowed to produce `gap`. Black here is correct output that
   * matches the exported file exactly. Pausing, seeking, waiting on the canvas,
   * resizing a panel, loading metadata, or moving the pointer must never set it.
   */
  inCanonicalGap: boolean
  /** At least one real frame has been presented since the source was attached. */
  hasPresentedFrame: boolean
  /** Non-identity footage motion applies at this tick, so the canvas is needed. */
  motionActive: boolean
  /** The token this render is asking the canvas to hold. */
  requestedFrameToken: string | null
  /** The token the canvas actually holds, or null if it holds nothing real. */
  drawnFrameToken: string | null
  /**
   * The video is playing.
   *
   * While playing, the canvas is being redrawn by the decoder's own frame
   * callback — many times a second, far faster than React re-renders. Demanding
   * an exact token match during playback would be demanding that React keep up
   * with the decoder, and every frame it fell behind would drop the picture to
   * the untransformed native video and back. So while playing, a canvas holding
   * a real frame of the current source IS the picture.
   */
  playing: boolean
}>

/**
 * Order is the whole design, so it is spelled out rather than implied.
 *
 * 1. A real error outranks everything. Reporting `gap` over a decode failure
 *    would tell the user the black is intentional when it is not.
 * 2. No source at all is `loading`, not `gap`. A gap is a claim about a
 *    timeline that exists.
 * 3. The canonical gap outranks readiness: black there is the intended output.
 * 4. Nothing has ever been shown and no frame is decodable — genuinely no
 *    picture yet.
 * 5. Motion applies and the canvas holds exactly the frame being asked for —
 *    show the canvas. This is the only branch that can show it.
 * 6. Motion applies, the canvas holds a *real but stale* frame, and either a
 *    seek is in flight or the video is playing — keep showing it. A 120%
 *    punch-in that dropped to the untransformed native video for the length of
 *    every seek, or on every frame React fell behind the decoder, would visibly
 *    jump out and back. One frame behind is true pixels; a jumping frame is not.
 * 7. Everything else falls back to the native video. Untransformed footage is
 *    real footage in slightly the wrong framing for a moment. Black is not
 *    footage at all. **The base picture is never black except at rule 3.**
 */
export const resolveMonitorBaseLayer = (input: MonitorBaseLayerInput): MonitorBaseLayer => {
  if (input.mediaError !== null) return Object.freeze({ kind: 'error', reason: input.mediaError })
  if (!input.hasSource) return Object.freeze({ kind: 'loading' })
  if (input.inCanonicalGap) return Object.freeze({ kind: 'gap' })
  if (input.readyState < HAVE_CURRENT_DATA && !input.hasPresentedFrame) {
    return Object.freeze({ kind: 'loading' })
  }
  if (input.motionActive && input.drawnFrameToken !== null) {
    if (input.drawnFrameToken === input.requestedFrameToken) {
      return Object.freeze({ kind: 'motion-canvas', frameToken: input.drawnFrameToken })
    }
    if (input.seeking || input.playing) {
      return Object.freeze({ kind: 'motion-canvas', frameToken: input.drawnFrameToken })
    }
  }
  return Object.freeze({ kind: 'native-video' })
}

/**
 * Whether the deliberate black gap layer covers the picture.
 *
 * Routing it through the resolver is what makes this structural: there is no
 * other expression that can turn the black layer on.
 */
export const showsGapLayer = (layer: MonitorBaseLayer): boolean => layer.kind === 'gap'

/** Whether the motion canvas is the picture. Everything else keeps it hidden. */
export const showsMotionCanvas = (layer: MonitorBaseLayer): boolean =>
  layer.kind === 'motion-canvas'

/** The one sentence the monitor may show. `null` means say nothing. */
export const monitorBaseLayerMessage = (layer: MonitorBaseLayer): string | null => {
  switch (layer.kind) {
    case 'loading':
      return 'Loading frame…'
    case 'gap':
      return 'No media at this time'
    case 'error':
      return 'Preview unavailable'
    default:
      return null
  }
}
