import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

import {
  FILMSTRIP_GRID_TICKS,
  filmstripFrameKey,
  imageThumbnailKey,
  mediaAnalysisKeyId,
  snapWidthPx,
  waveformBlockKey,
  WAVEFORM_BLOCK_TICKS,
  type MediaAnalysisKeyV1,
} from './media-analysis-key'
import { planWaveformBlocks } from './waveform-peaks'

/**
 * What ONE clip on the timeline needs drawn inside it.
 *
 * ## Why this is a pure function used in two places
 *
 * The clip itself has to know which pictures to draw. The timeline as a whole
 * has to know which pictures to ask for. If those were two pieces of code they
 * would eventually disagree, and the disagreement looks like this: a clip draws
 * a picture nobody asked for and shows a blank forever, or the timeline asks for
 * pictures nothing draws and the machine works for nothing.
 *
 * So there is one function. The timeline calls it to build its shopping list;
 * the clip calls it to know what to put on screen. Same inputs, same answer,
 * always.
 *
 * ## The rule that makes it truthful
 *
 * A thumbnail shows the moment of the RECORDING that is on screen at that point
 * of the finished video — not the point of the finished video. A clip trimmed
 * four seconds off its head and sitting at ten seconds shows second six of the
 * recording at twelve seconds of the video. Getting that wrong is invisible
 * until somebody cuts using it.
 */

/**
 * How much room a lane has, and therefore how much detail is worth drawing.
 *
 * Decorations that do not fit are not decorations, they are noise. A filmstrip
 * squeezed into a lane eighteen pixels tall is a row of unreadable smudges that
 * cost a decode each.
 */
export type LaneDensity = 'full' | 'compact' | 'minimal'

export const LANE_DENSITY_FULL_PX = 40
export const LANE_DENSITY_COMPACT_PX = 26

export const laneDensityForHeight = (laneHeightPx: number): LaneDensity => {
  if (!Number.isFinite(laneHeightPx) || laneHeightPx < LANE_DENSITY_COMPACT_PX) return 'minimal'
  return laneHeightPx >= LANE_DENSITY_FULL_PX ? 'full' : 'compact'
}

/**
 * Narrower than this and a clip gets no pictures at all.
 *
 * At the widest zoom-out a sixty-minute project puts a fourteen-second clip into
 * about six pixels. One unreadable thumbnail per clip would be 250 decodes to
 * show 250 smudges. The clip's edges and its name still draw — those are what is
 * useful at that zoom.
 */
export const MIN_CLIP_WIDTH_FOR_PICTURES_PX = 24
/** And narrower than this, no waveform either. */
export const MIN_CLIP_WIDTH_FOR_WAVEFORM_PX = 18

/** How wide one thumbnail is drawn, before rounding to a reusable step. */
export const FILMSTRIP_CELL_WIDTH_PX = 64
export const FILMSTRIP_CELL_WIDTH_COMPACT_PX = 96

/**
 * How many loudness numbers to ask for per second of sound.
 *
 * Snapped to a small set of steps for exactly the reason thumbnail widths are:
 * a value that followed the zoom continuously would produce a brand-new,
 * never-reused block on every zoom step.
 */
export const PEAKS_PER_BLOCK_STEPS: readonly number[] = Object.freeze([16, 32, 64, 128, 256])

export const peaksPerBlockFor = (pixelsPerSecond: number): number => {
  const wanted = Number.isFinite(pixelsPerSecond) ? pixelsPerSecond / 2 : 32
  for (const step of PEAKS_PER_BLOCK_STEPS) {
    if (wanted <= step) return step
  }
  return PEAKS_PER_BLOCK_STEPS[PEAKS_PER_BLOCK_STEPS.length - 1]
}

/** One clip, described in the only terms derived media cares about. */
export type DerivedMediaClip = Readonly<{
  itemId: string
  assetId: string
  assetVersion: string
  mediaKind: 'video' | 'image' | 'audio'
  /** Where it sits in the finished video. */
  startTicks: number
  durationTicks: number
  /** Where it starts inside its own file. Zero for a picture. */
  sourceStartTicks: number
  /** True when it is the sound of a piece of footage rather than a picture. */
  drawSound: boolean
}>

export type FilmstripCell = Readonly<{
  key: MediaAnalysisKeyV1
  keyId: string
  /** Distance from the clip's own left edge, in pixels. */
  offsetPx: number
  widthPx: number
}>

export type WaveformBlock = Readonly<{
  key: MediaAnalysisKeyV1
  keyId: string
  /** Where this block starts inside the file. */
  blockStartTicks: number
  blockSpanTicks: number
}>

export type ClipDerivedMedia =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'filmstrip'; cells: readonly FilmstripCell[]; truncated: boolean }>
  | Readonly<{ kind: 'image'; key: MediaAnalysisKeyV1; keyId: string }>
  | Readonly<{
      kind: 'waveform'
      blocks: readonly WaveformBlock[]
      truncated: boolean
      /** The stretch of the file the clip actually shows, for slicing. */
      fromTicks: number
      toTicks: number
    }>

export type ClipDerivedMediaInput = Readonly<{
  clip: DerivedMediaClip
  timescale: number
  pixelsPerSecond: number
  density: LaneDensity
  /** Ceiling per clip, so one enormous clip cannot fill the whole plan. */
  maxCellsPerClip?: number
}>

export const MAX_CELLS_PER_CLIP = 48
export const MAX_BLOCKS_PER_CLIP = 40

const clipWidthPx = (durationTicks: number, timescale: number, pixelsPerSecond: number): number =>
  (durationTicks / Math.max(1, timescale)) * Math.max(1, pixelsPerSecond)

/**
 * Everything one clip needs, and nothing it does not.
 *
 * Returns `none` rather than an empty list when a clip is too small or a lane
 * too short, so a caller cannot mistake "deliberately nothing" for "nothing yet".
 */
export const clipDerivedMedia = (input: ClipDerivedMediaInput): ClipDerivedMedia => {
  const { clip, timescale, pixelsPerSecond, density } = input
  if (density === 'minimal') return Object.freeze({ kind: 'none' as const })
  if (clip.assetVersion.length === 0) return Object.freeze({ kind: 'none' as const })

  const widthPx = clipWidthPx(clip.durationTicks, timescale, pixelsPerSecond)

  if (clip.drawSound) {
    if (widthPx < MIN_CLIP_WIDTH_FOR_WAVEFORM_PX) return Object.freeze({ kind: 'none' as const })
    const fromTicks = clip.sourceStartTicks
    const toTicks = clip.sourceStartTicks + clip.durationTicks
    const planned = planWaveformBlocks({
      fromTicks,
      toTicks,
      blockSpanTicks: WAVEFORM_BLOCK_TICKS,
      maxBlocks: MAX_BLOCKS_PER_CLIP,
    })
    const peaksPerBlock = density === 'full'
      ? peaksPerBlockFor(pixelsPerSecond)
      : Math.max(PEAKS_PER_BLOCK_STEPS[0], peaksPerBlockFor(pixelsPerSecond) / 2)
    const blocks = planned.blockStartTicks.map((blockStartTicks) => {
      const key = waveformBlockKey({
        assetId: clip.assetId,
        assetVersion: clip.assetVersion,
        sourceTicks: blockStartTicks,
        peaksPerBlock,
      })
      return Object.freeze({
        key,
        keyId: mediaAnalysisKeyId(key),
        blockStartTicks,
        blockSpanTicks: WAVEFORM_BLOCK_TICKS,
      })
    })
    return Object.freeze({
      kind: 'waveform' as const,
      blocks: Object.freeze(blocks),
      truncated: planned.truncated,
      fromTicks,
      toTicks,
    })
  }

  if (clip.mediaKind === 'image') {
    if (widthPx < MIN_CLIP_WIDTH_FOR_PICTURES_PX) return Object.freeze({ kind: 'none' as const })
    // A picture has one appearance. Asked for at the tallest size a lane ever
    // draws it, so zoom and lane height reuse the same one decode.
    const key = imageThumbnailKey({
      assetId: clip.assetId,
      assetVersion: clip.assetVersion,
      widthPx: FILMSTRIP_CELL_WIDTH_PX,
    })
    return Object.freeze({ kind: 'image' as const, key, keyId: mediaAnalysisKeyId(key) })
  }

  if (clip.mediaKind !== 'video') return Object.freeze({ kind: 'none' as const })
  if (widthPx < MIN_CLIP_WIDTH_FOR_PICTURES_PX) return Object.freeze({ kind: 'none' as const })

  const cellWidthPx = snapWidthPx(density === 'full' ? FILMSTRIP_CELL_WIDTH_PX : FILMSTRIP_CELL_WIDTH_COMPACT_PX)
  /*
   * How far apart the pictures are, in the RECORDING'S own time.
   *
   * Rounded to a whole number of grid steps, and everything stays in whole
   * ticks — converting through rounded seconds drifts a frame or two across a
   * long timeline, and the drift is invisible until it is wrong.
   */
  const rawStepTicks = (cellWidthPx / Math.max(1, pixelsPerSecond)) * timescale
  const stepTicks = Math.max(
    FILMSTRIP_GRID_TICKS,
    Math.round(rawStepTicks / FILMSTRIP_GRID_TICKS) * FILMSTRIP_GRID_TICKS,
  )
  const maxCells = Math.max(1, input.maxCellsPerClip ?? MAX_CELLS_PER_CLIP)

  /*
   * WHICH MOMENTS OF THE RECORDING to show, and why they are chosen this way.
   *
   * The very first picture is the clip's OWN starting moment. It has to be: a
   * clip trimmed four seconds off its head must show second four, and if the
   * first picture were rounded to a nearby moment instead, trimming would not
   * visibly change the picture at all until the trim crossed a rounding line.
   *
   * Every picture after it sits on a fixed ladder of moments measured from the
   * START OF THE RECORDING — 0, 0.75 s, 1.5 s and so on — never from the clip.
   * That is what makes editing cheap:
   *
   * ```
   *   move a clip      nothing changes: same recording, same moments
   *   trim a clip      only the first picture changes; the rest are already made
   *   split a clip     the right half needs ONE new picture, its own new start.
   *                    Everything else it shows, the whole clip already had.
   * ```
   *
   * A ladder measured from each clip's own start instead would put every clip
   * on its own private set of moments, and a single split would re-decode an
   * entire filmstrip.
   */
  const sourceStartTicks = clip.sourceStartTicks
  const sourceEndTicks = sourceStartTicks + clip.durationTicks
  const moments: number[] = [sourceStartTicks]
  let truncated = false
  for (
    let moment = Math.ceil((sourceStartTicks + 1) / stepTicks) * stepTicks;
    moment < sourceEndTicks;
    moment += stepTicks
  ) {
    if (moments.length >= maxCells) { truncated = true; break }
    moments.push(moment)
  }

  const toPx = (ticks: number): number => (ticks / Math.max(1, timescale)) * Math.max(1, pixelsPerSecond)
  const cells: FilmstripCell[] = moments.map((moment, index) => {
    const key = filmstripFrameKey({
      assetId: clip.assetId,
      assetVersion: clip.assetVersion,
      sourceTicks: moment,
      widthPx: cellWidthPx,
    })
    // Each picture fills the space up to the next one, and the last is cropped
    // to the clip's end — so a filmstrip can never draw past the clip it
    // belongs to, and never leaves a gap between two pictures.
    const nextMoment = moments[index + 1] ?? sourceEndTicks
    return Object.freeze({
      key,
      keyId: mediaAnalysisKeyId(key),
      offsetPx: toPx(moment - sourceStartTicks),
      widthPx: Math.max(1, toPx(nextMoment - moment)),
    })
  })

  return Object.freeze({ kind: 'filmstrip' as const, cells: Object.freeze(cells), truncated })
}

/** Every key one clip needs, flattened. */
export const derivedMediaKeys = (media: ClipDerivedMedia): readonly MediaAnalysisKeyV1[] => {
  if (media.kind === 'filmstrip') return media.cells.map((cell) => cell.key)
  if (media.kind === 'waveform') return media.blocks.map((block) => block.key)
  if (media.kind === 'image') return [media.key]
  return []
}

/**
 * A whole timeline's shopping list, in the order things should be fetched.
 *
 * Bounded twice over: each clip has a ceiling, and the plan as a whole has one.
 * When the plan runs out of room it SAYS SO, because a filmstrip quietly missing
 * most of itself reads as "covered everything" when it did not.
 */
export const MAX_TIMELINE_ANALYSIS_REQUESTS = 400

export type TimelineAnalysisPlanInput = Readonly<{
  clips: readonly Readonly<{
    clip: DerivedMediaClip
    density: LaneDensity
    /** How important this clip is: see `ANALYSIS_PRIORITY`. */
    priority: number
  }>[]
  timescale: number
  pixelsPerSecond: number
  maxRequests?: number
}>

export type TimelineAnalysisPlan = Readonly<{
  wanted: readonly Readonly<{ key: MediaAnalysisKeyV1; priority: number }>[]
  truncated: boolean
}>

export const planTimelineAnalysis = (input: TimelineAnalysisPlanInput): TimelineAnalysisPlan => {
  const max = Math.max(1, input.maxRequests ?? MAX_TIMELINE_ANALYSIS_REQUESTS)
  // Most important first, so if the ceiling bites it bites the least useful work.
  const ordered = [...input.clips].sort((left, right) => left.priority - right.priority)
  const wanted: { key: MediaAnalysisKeyV1; priority: number }[] = []
  const seen = new Set<string>()
  let truncated = false

  for (const entry of ordered) {
    const media = clipDerivedMedia({
      clip: entry.clip,
      timescale: input.timescale,
      pixelsPerSecond: input.pixelsPerSecond,
      density: entry.density,
    })
    if (media.kind === 'filmstrip' || media.kind === 'waveform') {
      if (media.truncated) truncated = true
    }
    for (const key of derivedMediaKeys(media)) {
      const keyId = mediaAnalysisKeyId(key)
      // The same moment of the same recording, wanted by two clips, is ONE
      // piece of work. That is what makes a split cost nothing.
      if (seen.has(keyId)) continue
      if (wanted.length >= max) { truncated = true; break }
      seen.add(keyId)
      wanted.push(Object.freeze({ key, priority: entry.priority }))
    }
    if (wanted.length >= max) { truncated = true; break }
  }

  return Object.freeze({ wanted: Object.freeze(wanted), truncated })
}

/** One second of sound, in the project's own clock. Exported for tests. */
export const ONE_SECOND_TICKS = PROJECT_TIMESCALE
