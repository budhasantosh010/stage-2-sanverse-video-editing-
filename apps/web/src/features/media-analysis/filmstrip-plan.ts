import {
  filmstripFrameKey,
  mediaAnalysisKeyId,
  type MediaAnalysisKeyV1,
} from './media-analysis-key'

/**
 * Which thumbnails a stretch of timeline actually needs, and which moment of
 * which recording each one comes from.
 *
 * ## The rule that makes a filmstrip truthful
 *
 * A thumbnail must show the frame that is ON SCREEN at that point of the
 * finished video. That sounds obvious and is the thing filmstrips most often
 * get wrong, because a clip's position on the timeline and the moment of the
 * recording it is showing are two different numbers:
 *
 * ```
 *   a clip trimmed 4 s off its head, sitting at 10 s of the finished video
 *
 *     WRONG   the thumbnail at 12 s shows second 12 of the recording
 *     RIGHT   the thumbnail at 12 s shows second 6 of the recording
 *                                             (4 trimmed + 2 into the clip)
 * ```
 *
 * Get it wrong and every filmstrip in a cut project is off by the amount that
 * was trimmed — and it looks plausible, so nobody notices until they cut using
 * it.
 *
 * ## Why only the visible range is planned
 *
 * A sixty-minute project has tens of thousands of possible thumbnails. Asking
 * for all of them would decode for minutes and hold more memory than the tab
 * has. Only what is on screen — plus a margin either side so scrolling does not
 * show blanks — is ever requested.
 */

export type FilmstripClip = Readonly<{
  clipId: string
  assetId: string
  /** Where the clip sits in the finished video. */
  startTicks: number
  durationTicks: number
  /** Where the clip starts inside its own recording. */
  sourceStartTicks: number
}>

export type FilmstripRequest = Readonly<{
  key: MediaAnalysisKeyV1
  keyId: string
  clipId: string
  /** Where this thumbnail is drawn, in finished-video time. */
  compositionTicks: number
}>

export type FilmstripPlanInput = Readonly<{
  clips: readonly FilmstripClip[]
  /** The stretch of finished video on screen, plus whatever margin the caller wants. */
  visibleStartTicks: number
  visibleEndTicks: number
  /** How wide one thumbnail is drawn. Decides both spacing and decode size. */
  thumbnailWidthPx: number
  pixelsPerSecond: number
  timescale: number
  /** Hard ceiling on one plan, so a wild zoom cannot ask for thousands at once. */
  maxRequests?: number
}>

/**
 * Never more than this from one plan, however far out the user zooms.
 *
 * A cap is not a nice-to-have: without one, zooming out on a long project asks
 * for a request per pixel of a timeline that is tens of thousands of pixels
 * wide, and the browser stops responding. When the cap bites, the caller is
 * told, so the user is never quietly shown a filmstrip with holes in it and no
 * explanation.
 */
export const MAX_FILMSTRIP_REQUESTS_PER_PLAN = 240

export type FilmstripPlan = Readonly<{
  requests: readonly FilmstripRequest[]
  /** True when the cap above stopped this plan short. Never hidden. */
  truncated: boolean
}>

/**
 * The moment of the recording showing at one moment of the finished video.
 * Null when that moment is not inside this clip at all.
 */
export const sourceTicksWithinClip = (
  clip: FilmstripClip,
  compositionTicks: number,
): number | null => {
  if (compositionTicks < clip.startTicks) return null
  if (compositionTicks >= clip.startTicks + clip.durationTicks) return null
  return clip.sourceStartTicks + (compositionTicks - clip.startTicks)
}

export const planFilmstrip = (input: FilmstripPlanInput): FilmstripPlan => {
  const max = input.maxRequests ?? MAX_FILMSTRIP_REQUESTS_PER_PLAN
  const width = Math.max(8, input.thumbnailWidthPx)
  // How much finished-video time one thumbnail covers on screen. Everything is
  // whole ticks: converting through rounded seconds would drift a frame or two
  // across a long timeline, and the drift is invisible until it is wrong.
  const stepTicks = Math.max(
    1,
    Math.round((width / Math.max(1, input.pixelsPerSecond)) * input.timescale),
  )

  const requests: FilmstripRequest[] = []
  const seen = new Set<string>()
  let truncated = false

  for (const clip of input.clips) {
    const clipEnd = clip.startTicks + clip.durationTicks
    if (clipEnd <= input.visibleStartTicks || clip.startTicks >= input.visibleEndTicks) continue

    const from = Math.max(clip.startTicks, input.visibleStartTicks)
    const to = Math.min(clipEnd, input.visibleEndTicks)
    // Thumbnails are laid out from the CLIP's own start, not from the edge of
    // the window. Otherwise they would slide as the user scrolled, and the
    // picture under the pointer would change without the video changing.
    const firstIndex = Math.floor((from - clip.startTicks) / stepTicks)
    const lastIndex = Math.floor((to - 1 - clip.startTicks) / stepTicks)

    for (let index = firstIndex; index <= lastIndex; index += 1) {
      if (requests.length >= max) {
        truncated = true
        return Object.freeze({ requests: Object.freeze(requests), truncated })
      }
      const compositionTicks = clip.startTicks + index * stepTicks
      const sourceTicks = sourceTicksWithinClip(clip, compositionTicks)
      if (sourceTicks === null) continue
      const key = filmstripFrameKey({ assetId: clip.assetId, sourceTicks, widthPx: width })
      const keyId = mediaAnalysisKeyId(key)
      // The same moment of the same recording, shown twice on the timeline, is
      // ONE piece of work. That is what makes a split cost nothing and a shot
      // used twice cost once.
      const positionId = `${keyId}@${compositionTicks}`
      if (seen.has(positionId)) continue
      seen.add(positionId)
      requests.push(Object.freeze({ key, keyId, clipId: clip.clipId, compositionTicks }))
    }
  }

  return Object.freeze({ requests: Object.freeze(requests), truncated })
}

/** Distinct pieces of work in a plan — what actually has to be decoded. */
export const distinctFilmstripWork = (plan: FilmstripPlan): number =>
  new Set(plan.requests.map((request) => request.keyId)).size
