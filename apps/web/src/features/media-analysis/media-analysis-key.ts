import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

/**
 * The name of one piece of DERIVED media — a filmstrip frame, or a block of
 * waveform peaks.
 *
 * ## Why derived media needs names at all
 *
 * A sixty-minute video with 250 pieces of footage needs thousands of thumbnails
 * and thousands of blocks of waveform. Producing one costs real work: decoding
 * a frame, or reading and summarising a stretch of sound. Producing the same
 * one twice is that work wasted, and on a long project it is the difference
 * between a timeline that scrolls and one that stutters.
 *
 * So each piece is named, and the name is derived ONLY from what it depends on:
 *
 *     which file · which moment of it · how big
 *
 * Nothing about where it currently sits on the timeline, and nothing about the
 * project. That is deliberate and it is the whole point:
 *
 * ```
 *   the user moves a clip           the frames it shows do not change,
 *                                   because the same moments of the same
 *                                   file are still on screen
 *
 *   the user trims a clip's head    the frames that remain keep their names;
 *                                   only the ones no longer shown are dropped
 *
 *   the user cuts a clip in half    both halves reuse the frames the whole
 *                                   already had
 * ```
 *
 * A name that included the clip's position would change on every drag, throw
 * away every thumbnail, and re-decode the lot — which is exactly the stutter
 * this exists to prevent.
 *
 * ## Why nothing is persisted
 *
 * Derived media is never saved into the project. It can always be produced
 * again from the file, so storing it would grow the project file without adding
 * a single fact, and a stale thumbnail would then outlive the media it came
 * from.
 */
export const MEDIA_ANALYSIS_SCHEMA_VERSION = 'sanverse.media-analysis/v1'

export const MEDIA_ANALYSIS_KINDS = Object.freeze(['filmstrip-frame', 'waveform-block'] as const)
export type MediaAnalysisKind = (typeof MEDIA_ANALYSIS_KINDS)[number]

export type MediaAnalysisKeyV1 = Readonly<{
  schemaVersion: typeof MEDIA_ANALYSIS_SCHEMA_VERSION
  kind: MediaAnalysisKind
  /** Which file. Never a path or a URL — see the note in the drag contract. */
  assetId: string
  /**
   * WHICH MOMENT OF THE FILE, not of the finished video.
   *
   * This is what survives every edit. Two clips showing the same moment of the
   * same recording share the frame, whether they are two halves of one split or
   * the same shot deliberately used twice.
   */
  sourceTicks: number
  /**
   * How much of the file this covers. Zero for a single frame; the length of
   * the block for a waveform.
   */
  spanTicks: number
  /** Pixel width a frame is produced at, or peaks-per-block for sound. */
  resolution: number
}>

/**
 * Frames are produced at moments that are multiples of this, never at arbitrary
 * ones.
 *
 * A filmstrip that asked for whatever moment happened to be under a pixel would
 * produce a brand-new frame every time the zoom changed by one step, and none
 * of them would ever be reused. Snapping the REQUEST to a grid means zooming in
 * and out reuses what is already there.
 *
 * Quarter of a second: fine enough that a filmstrip reads as motion, coarse
 * enough that a sixty-minute recording is 14,400 possible frames rather than
 * millions.
 */
export const FILMSTRIP_GRID_TICKS = PROJECT_TIMESCALE / 4

/** One block of waveform covers this much of the sound. */
export const WAVEFORM_BLOCK_TICKS = PROJECT_TIMESCALE

export const snapToGrid = (ticks: number, gridTicks: number): number =>
  Math.max(0, Math.floor(ticks / gridTicks) * gridTicks)

export const filmstripFrameKey = (input: Readonly<{
  assetId: string
  sourceTicks: number
  widthPx: number
}>): MediaAnalysisKeyV1 =>
  Object.freeze({
    schemaVersion: MEDIA_ANALYSIS_SCHEMA_VERSION,
    kind: 'filmstrip-frame' as const,
    assetId: input.assetId,
    sourceTicks: snapToGrid(input.sourceTicks, FILMSTRIP_GRID_TICKS),
    spanTicks: 0,
    // Widths are rounded to a step as well, for the same reason moments are:
    // otherwise every pixel of window resize is a fresh decode of everything.
    resolution: Math.max(16, Math.round(input.widthPx / 16) * 16),
  })

export const waveformBlockKey = (input: Readonly<{
  assetId: string
  sourceTicks: number
  peaksPerBlock: number
}>): MediaAnalysisKeyV1 =>
  Object.freeze({
    schemaVersion: MEDIA_ANALYSIS_SCHEMA_VERSION,
    kind: 'waveform-block' as const,
    assetId: input.assetId,
    sourceTicks: snapToGrid(input.sourceTicks, WAVEFORM_BLOCK_TICKS),
    spanTicks: WAVEFORM_BLOCK_TICKS,
    resolution: Math.max(1, Math.round(input.peaksPerBlock)),
  })

/** One string, for use as a map key. Same key in, same string out, always. */
export const mediaAnalysisKeyId = (key: MediaAnalysisKeyV1): string =>
  `${key.kind}:${key.assetId}:${key.sourceTicks}:${key.spanTicks}:${key.resolution}`
