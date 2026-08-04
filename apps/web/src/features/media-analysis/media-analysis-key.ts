import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

/**
 * The name of one piece of DERIVED media — a filmstrip frame, a small picture,
 * or a block of waveform peaks.
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
 *     which file · WHICH BYTES that file holds · which moment · how big
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
 * ## Why the name also carries WHICH BYTES
 *
 * `assetId` names a slot in the project — "the B-roll clip". It does not by
 * itself promise the bytes behind that slot never change. If a file is ever
 * relinked or replaced, an ID-only name would let a picture of the OLD footage
 * be served for the NEW footage, and it would look completely plausible.
 *
 * So the name also carries `assetVersion`: the first sixteen characters of the
 * file's SHA-256 checksum, which the project already records for every asset.
 * Different bytes mean a different checksum, which means a different name, which
 * means the stale picture can never be found. No expiry, no clock, no window in
 * which the wrong thing can be shown.
 *
 * `assetVersion` is a checksum of CONTENT. It carries no filesystem path, no
 * inode, no local URL and no server path, so it is safe to put in a web address.
 *
 * ## Why nothing is persisted
 *
 * Derived media is never saved into the project. It can always be produced
 * again from the file, so storing it would grow the project file without adding
 * a single fact, and a stale thumbnail would then outlive the media it came
 * from. See DOCS/decisions/ADR-DERIVED-MEDIA-EXECUTION-V1.md.
 */
export const MEDIA_ANALYSIS_SCHEMA_VERSION = 'sanverse.media-analysis/v1'

/**
 * The complete list of things that can be derived. Closed on purpose: an
 * unknown kind is refused rather than guessed at.
 *
 * `image-thumbnail` is its own kind rather than "a video frame at moment zero".
 * A picture genuinely has no moments — asking for second 4 of a photograph is a
 * question with no answer — so pretending it is a zero-length video would put a
 * meaningless number in the name and invite a caller to vary it.
 */
export const MEDIA_ANALYSIS_KINDS = Object.freeze([
  'filmstrip-frame',
  'waveform-block',
  'image-thumbnail',
] as const)
export type MediaAnalysisKind = (typeof MEDIA_ANALYSIS_KINDS)[number]

export const isMediaAnalysisKind = (value: unknown): value is MediaAnalysisKind =>
  typeof value === 'string' && (MEDIA_ANALYSIS_KINDS as readonly string[]).includes(value)

/** What an asset version looks like: a short slice of a SHA-256 checksum. */
export const ASSET_VERSION_PATTERN = /^[a-f0-9]{16}$/
export const ASSET_VERSION_LENGTH = 16

/**
 * The immutable name for the bytes of one file.
 *
 * Sixteen hexadecimal characters is 64 bits. Two DIFFERENT files colliding would
 * need roughly four billion files in one project before it became likely, and a
 * project holds tens. The full 64-character checksum would work equally well and
 * is simply longer in every web address for no gain.
 */
export const assetVersionFromSha256 = (sha256: string): string => {
  const normalised = typeof sha256 === 'string' ? sha256.trim().toLowerCase() : ''
  return /^[a-f0-9]{64}$/.test(normalised) ? normalised.slice(0, ASSET_VERSION_LENGTH) : ''
}

export type MediaAnalysisKeyV1 = Readonly<{
  schemaVersion: typeof MEDIA_ANALYSIS_SCHEMA_VERSION
  kind: MediaAnalysisKind
  /** Which file. Never a path or a URL — see the note in the drag contract. */
  assetId: string
  /** WHICH BYTES that file holds. See the long note above. */
  assetVersion: string
  /**
   * WHICH MOMENT OF THE FILE, not of the finished video.
   *
   * This is what survives every edit. Two clips showing the same moment of the
   * same recording share the frame, whether they are two halves of one split or
   * the same shot deliberately used twice.
   *
   * Always 0 for a picture, which has no moments.
   */
  sourceTicks: number
  /**
   * How much of the file this covers. Zero for a single frame or a picture; the
   * length of the block for a waveform.
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

/** Widths are rounded to a step, for the same reason moments are. */
export const snapWidthPx = (widthPx: number): number =>
  Math.max(16, Math.round((Number.isFinite(widthPx) ? widthPx : 16) / 16) * 16)

export const filmstripFrameKey = (input: Readonly<{
  assetId: string
  assetVersion: string
  sourceTicks: number
  widthPx: number
}>): MediaAnalysisKeyV1 =>
  Object.freeze({
    schemaVersion: MEDIA_ANALYSIS_SCHEMA_VERSION,
    kind: 'filmstrip-frame' as const,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    sourceTicks: snapToGrid(input.sourceTicks, FILMSTRIP_GRID_TICKS),
    spanTicks: 0,
    resolution: snapWidthPx(input.widthPx),
  })

export const waveformBlockKey = (input: Readonly<{
  assetId: string
  assetVersion: string
  sourceTicks: number
  peaksPerBlock: number
}>): MediaAnalysisKeyV1 =>
  Object.freeze({
    schemaVersion: MEDIA_ANALYSIS_SCHEMA_VERSION,
    kind: 'waveform-block' as const,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    sourceTicks: snapToGrid(input.sourceTicks, WAVEFORM_BLOCK_TICKS),
    spanTicks: WAVEFORM_BLOCK_TICKS,
    resolution: Math.max(1, Math.round(input.peaksPerBlock)),
  })

/**
 * A picture, shrunk to fit a bounded box.
 *
 * `sourceTicks` and `spanTicks` are both zero and are NOT a parameter a caller
 * may vary — a picture has one appearance and asking for it "at four seconds"
 * would be a question with no meaning.
 */
export const imageThumbnailKey = (input: Readonly<{
  assetId: string
  assetVersion: string
  widthPx: number
}>): MediaAnalysisKeyV1 =>
  Object.freeze({
    schemaVersion: MEDIA_ANALYSIS_SCHEMA_VERSION,
    kind: 'image-thumbnail' as const,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    sourceTicks: 0,
    spanTicks: 0,
    resolution: snapWidthPx(input.widthPx),
  })

/** One string, for use as a map key. Same key in, same string out, always. */
export const mediaAnalysisKeyId = (key: MediaAnalysisKeyV1): string =>
  `${key.kind}:${key.assetId}:${key.assetVersion}:${key.sourceTicks}:${key.spanTicks}:${key.resolution}`

/**
 * Read back a key that came from somewhere less trusted than this module.
 *
 * Closed: an unknown field, an unknown kind, or a number that is not a
 * non-negative whole number is refused rather than repaired. A key that is
 * quietly repaired is a key whose name no longer matches what it describes,
 * which is how the wrong picture ends up under the right clip.
 */
export const parseMediaAnalysisKey = (value: unknown): MediaAnalysisKeyV1 | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const allowed = ['schemaVersion', 'kind', 'assetId', 'assetVersion', 'sourceTicks', 'spanTicks', 'resolution']
  if (Object.keys(record).length !== allowed.length) return null
  if (allowed.some((name) => !(name in record))) return null
  if (record.schemaVersion !== MEDIA_ANALYSIS_SCHEMA_VERSION) return null
  if (!isMediaAnalysisKind(record.kind)) return null
  if (typeof record.assetId !== 'string' || !/^asset_[a-z0-9]{8,64}$/.test(record.assetId)) return null
  if (typeof record.assetVersion !== 'string' || !ASSET_VERSION_PATTERN.test(record.assetVersion)) return null
  const whole = (candidate: unknown): candidate is number =>
    typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0
  if (!whole(record.sourceTicks) || !whole(record.spanTicks) || !whole(record.resolution)) return null
  if (record.resolution === 0) return null
  if (record.kind === 'image-thumbnail' && (record.sourceTicks !== 0 || record.spanTicks !== 0)) return null
  if (record.kind === 'filmstrip-frame' && record.spanTicks !== 0) return null
  if (record.kind === 'waveform-block' && record.spanTicks === 0) return null
  return Object.freeze({
    schemaVersion: MEDIA_ANALYSIS_SCHEMA_VERSION,
    kind: record.kind,
    assetId: record.assetId,
    assetVersion: record.assetVersion,
    sourceTicks: record.sourceTicks,
    spanTicks: record.spanTicks,
    resolution: record.resolution,
  })
}
