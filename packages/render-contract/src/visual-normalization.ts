/**
 * How a piece of footage is made to fit the finished video's canvas.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────────
 *
 * Before this, footage went into the exporter at whatever size it was recorded
 * at. That worked only while every project held exactly one recording, because
 * "the size of the footage" and "the size of the finished video" were the same
 * number by accident.
 *
 * The moment a project held two recordings of different sizes, FFmpeg's `concat`
 * step refused the whole export:
 *
 *   Input link in0:v0 parameters (size 714x1280, SAR 1:1) do not match the
 *   corresponding output link in0:v0 parameters (1920x1080, SAR 1:1)
 *
 * `concat` joins pieces end to end and demands that every piece already be the
 * same width, the same height and the same pixel shape. Nothing in the exporter
 * made that true. So a phone clip filmed upright, dropped into a normal
 * widescreen project, made Export fail outright — and the message the user got
 * was "The local renderer could not produce a verified MP4", which explains
 * nothing. That is FAIL-051. It was never only about upright phone clips: a
 * 1080p clip next to a 720p clip failed in exactly the same way.
 *
 * ── WHY THE RULE LIVES IN ONE FILE ────────────────────────────────────────────
 *
 * The picture in the browser and the picture in the exported file must be the
 * same picture. If the browser worked out the framing one way and the exporter
 * worked it out another way, they would agree on the easy cases and drift apart
 * on the hard ones — and the user would only find out after waiting for an
 * export. That class of bug is exactly what FAIL-052 was.
 *
 * So this file is the single authority. It answers one question —
 *
 *     "a picture this size, in a canvas this size: where exactly does it go?"
 *
 * — and it answers it in two forms that cannot disagree, because both are built
 * from the same numbers:
 *
 *     normalizeVisual(...)         -> exact whole numbers, for the browser and
 *                                     for tests to assert against
 *     normalizationFilterSteps(...) -> the FFmpeg instructions
 *
 * ── THE TWO WAYS TO FIT ───────────────────────────────────────────────────────
 *
 * Every editor has to choose one of two answers, and both are honest:
 *
 *   FIT   Show the whole picture. Shrink it until it is fully inside the canvas
 *         and fill the leftover space with black. Nothing is lost; you get bars.
 *
 *         upright phone clip 714x1280 into a 1920x1080 canvas
 *         ┌───────────────────────────────────────────┐
 *         │         │                       │         │  black
 *         │  black  │   the whole picture   │  black  │  bars at
 *         │         │       602 x 1080      │         │  the sides
 *         └───────────────────────────────────────────┘
 *
 *   FILL  Fill the canvas edge to edge. Grow the picture until it covers the
 *         canvas and cut off whatever hangs over. No bars; you lose the edges.
 *
 *         ┌───────────────────────────────────────────┐
 *         │▒▒▒▒▒▒▒▒▒│                       │▒▒▒▒▒▒▒▒▒│  ▒ = cut off
 *         │▒▒▒▒▒▒▒▒▒│  the middle of it     │▒▒▒▒▒▒▒▒▒│    and thrown
 *         │▒▒▒▒▒▒▒▒▒│      1920 x 1080      │▒▒▒▒▒▒▒▒▒│    away
 *         └───────────────────────────────────────────┘
 *
 * There is deliberately no third answer. Stretching the picture to the canvas
 * shape — making a face wide and flat — is never what anybody wants, so it is
 * not offered. That is a decision, not an oversight.
 *
 * FIT is the default. It is the only one of the two that cannot destroy part of
 * the user's footage without being asked, and for every project that already
 * exists — one recording, canvas the same size as it — FIT changes nothing at
 * all, because a picture already exactly the size of the canvas is scaled by one
 * and padded by zero.
 *
 * ── THE ORDER OF THE STEPS IS THE WHOLE DESIGN ────────────────────────────────
 *
 *   1  turn the picture the right way up      (the camera's own rotation note)
 *   2  make the pixels square                 (some cameras record oblong ones)
 *   3  work out FIT or FILL against the canvas
 *   4  scale, keeping the picture's own shape
 *   5  add black bars (FIT) or cut off the overhang (FILL)
 *   6  declare the pixels square in the result
 *   7  make the colour storage the same for every piece
 *
 * Doing 3 before 2 would frame the picture using its stored size rather than the
 * size it actually looks like, and oblong-pixel footage would be framed wrongly.
 * Doing 5 before 4 would cut the wrong part off. The order is not decorative.
 */

/** The two honest answers to "this picture is a different shape from the canvas". */
export const VISUAL_FIT_MODES = Object.freeze(['fit', 'fill'] as const)
export type VisualFitMode = (typeof VISUAL_FIT_MODES)[number]

export const isVisualFitMode = (value: unknown): value is VisualFitMode =>
  typeof value === 'string' && (VISUAL_FIT_MODES as readonly string[]).includes(value)

/**
 * The camera's own note about which way up the clip was filmed.
 *
 * A phone filmed sideways stores a normal landscape picture plus a note saying
 * "turn this 90 degrees". Only these four exist; anything else is a file we
 * cannot frame honestly, and we say so rather than guess.
 */
export const VISUAL_ROTATIONS = Object.freeze([0, 90, 180, 270] as const)
export type VisualRotationDegrees = (typeof VISUAL_ROTATIONS)[number]

export type VisualNormalizationInput = Readonly<{
  sourceWidth: number
  sourceHeight: number
  /**
   * The shape of one stored pixel, as a fraction. Square pixels are 1/1, which
   * is what almost everything records. Some older camcorder and broadcast
   * formats store oblong pixels — a 1440x1080 frame meant to be shown as
   * 1920x1080 has pixels 4/3 as wide as they are tall.
   */
  sourceSampleAspectNumerator?: number
  sourceSampleAspectDenominator?: number
  sourceRotationDegrees?: VisualRotationDegrees
  canvasWidth: number
  canvasHeight: number
  fitMode?: VisualFitMode
}>

/**
 * Exactly where a picture ends up inside the canvas. Every number is a whole
 * number of pixels, so the browser and the exporter can be compared directly
 * instead of "near enough".
 */
export type VisualNormalizationV1 = Readonly<{
  sourceWidth: number
  sourceHeight: number
  sourceSampleAspectNumerator: number
  sourceSampleAspectDenominator: number
  sourceRotationDegrees: VisualRotationDegrees

  canvasWidth: number
  canvasHeight: number
  fitMode: VisualFitMode

  /** The size the picture is drawn at, before any bars or trimming. */
  scaledWidth: number
  scaledHeight: number

  /** How much is cut off each edge. Always zero in FIT. */
  cropLeft: number
  cropTop: number
  cropRight: number
  cropBottom: number

  /** How much black is added to each edge. Always zero in FILL. */
  padLeft: number
  padTop: number
  padRight: number
  padBottom: number
}>

export const VISUAL_NORMALIZATION_REFUSALS = Object.freeze([
  'SOURCE_SIZE_UNUSABLE',
  'CANVAS_SIZE_UNUSABLE',
  'PIXEL_SHAPE_UNUSABLE',
  'ROTATION_UNSUPPORTED',
] as const)
export type VisualNormalizationRefusal = (typeof VISUAL_NORMALIZATION_REFUSALS)[number]

export type VisualNormalizationResult =
  | Readonly<{ ok: true; value: VisualNormalizationV1 }>
  | Readonly<{ ok: false; refusal: VisualNormalizationRefusal; message: string }>

/**
 * What to tell the user when the framing itself is the thing that failed.
 *
 * Named stages, in plain words. "The local renderer could not produce a verified
 * MP4" told the user nothing and sent them nowhere; each of these points at the
 * one piece of information that was wrong.
 */
export const visualNormalizationMessage = (refusal: VisualNormalizationRefusal): string => {
  switch (refusal) {
    case 'SOURCE_SIZE_UNUSABLE':
      return 'This clip does not report a usable picture size, so it cannot be framed.'
    case 'CANVAS_SIZE_UNUSABLE':
      return 'This project does not have a usable video size.'
    case 'PIXEL_SHAPE_UNUSABLE':
      return 'This clip reports a pixel shape that cannot be used.'
    case 'ROTATION_UNSUPPORTED':
      return 'This clip is turned by an angle that cannot be handled.'
  }
}

/** Round down to an even number, never below 2. */
const evenFloor = (value: number): number => Math.max(2, Math.floor(value / 2) * 2)

/**
 * Work out exactly where a picture sits inside the canvas.
 *
 * Pure: the same numbers in always give the same numbers out, and nothing else
 * — not what is selected, not what is hovered, not what the toolbar says — can
 * reach it. The argument list is the proof.
 */
export const normalizeVisual = (input: VisualNormalizationInput): VisualNormalizationResult => {
  const fitMode = input.fitMode ?? 'fit'
  const rotation = input.sourceRotationDegrees ?? 0
  const sarNumerator = input.sourceSampleAspectNumerator ?? 1
  const sarDenominator = input.sourceSampleAspectDenominator ?? 1

  const refuse = (refusal: VisualNormalizationRefusal): VisualNormalizationResult =>
    Object.freeze({ ok: false as const, refusal, message: visualNormalizationMessage(refusal) })

  if (
    !Number.isFinite(input.sourceWidth) || !Number.isFinite(input.sourceHeight) ||
    input.sourceWidth <= 0 || input.sourceHeight <= 0
  ) return refuse('SOURCE_SIZE_UNUSABLE')

  if (
    !Number.isSafeInteger(input.canvasWidth) || !Number.isSafeInteger(input.canvasHeight) ||
    input.canvasWidth < 2 || input.canvasHeight < 2
  ) return refuse('CANVAS_SIZE_UNUSABLE')

  if (
    !Number.isFinite(sarNumerator) || !Number.isFinite(sarDenominator) ||
    sarNumerator <= 0 || sarDenominator <= 0
  ) return refuse('PIXEL_SHAPE_UNUSABLE')

  if (!(VISUAL_ROTATIONS as readonly number[]).includes(rotation)) return refuse('ROTATION_UNSUPPORTED')

  // Step 1 — the camera's rotation note. A quarter turn either way swaps which
  // stored dimension is the width you actually see.
  const quarterTurned = rotation === 90 || rotation === 270
  const uprightWidth = quarterTurned ? input.sourceHeight : input.sourceWidth
  const uprightHeight = quarterTurned ? input.sourceWidth : input.sourceHeight

  // Step 2 — square the pixels. A 1440-wide frame with pixels 4/3 as wide as
  // they are tall is a 1920-wide picture. From here on every number is in
  // square pixels, so plain arithmetic is honest.
  const displayWidth = uprightWidth * (sarNumerator / sarDenominator)
  const displayHeight = uprightHeight

  // Steps 3 and 4 — one scale factor for both directions, so the picture keeps
  // its own shape. FIT takes the smaller factor (everything gets in); FILL takes
  // the larger (nothing is left uncovered).
  const widthFactor = input.canvasWidth / displayWidth
  const heightFactor = input.canvasHeight / displayHeight
  const factor = fitMode === 'fit'
    ? Math.min(widthFactor, heightFactor)
    : Math.max(widthFactor, heightFactor)

  // Even numbers throughout: the colour storage every player understands
  // (yuv420p) shares colour between pairs of pixels and simply cannot describe
  // an odd width or height.
  const scaledWidth = evenFloor(displayWidth * factor)
  const scaledHeight = evenFloor(displayHeight * factor)

  // Step 5 — bars, or trimming. Exactly one of the two happens per direction,
  // and the leftover odd pixel goes to the right and the bottom so the two
  // sides always add back to the canvas exactly.
  const widthDifference = input.canvasWidth - scaledWidth
  const heightDifference = input.canvasHeight - scaledHeight

  const padLeft = Math.max(0, Math.floor(widthDifference / 2))
  const padRight = Math.max(0, widthDifference - padLeft)
  const padTop = Math.max(0, Math.floor(heightDifference / 2))
  const padBottom = Math.max(0, heightDifference - padTop)

  const cropWidth = Math.max(0, -widthDifference)
  const cropHeight = Math.max(0, -heightDifference)
  const cropLeft = Math.floor(cropWidth / 2)
  const cropRight = cropWidth - cropLeft
  const cropTop = Math.floor(cropHeight / 2)
  const cropBottom = cropHeight - cropTop

  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      sourceWidth: input.sourceWidth,
      sourceHeight: input.sourceHeight,
      sourceSampleAspectNumerator: sarNumerator,
      sourceSampleAspectDenominator: sarDenominator,
      sourceRotationDegrees: rotation,
      canvasWidth: input.canvasWidth,
      canvasHeight: input.canvasHeight,
      fitMode,
      scaledWidth,
      scaledHeight,
      cropLeft,
      cropTop,
      cropRight,
      cropBottom,
      padLeft,
      padTop,
      padRight,
      padBottom,
    }),
  })
}

/**
 * The same rule, written as FFmpeg instructions.
 *
 * These are written as expressions against the real decoded picture rather than
 * as the whole numbers `normalizeVisual` predicts, and that is deliberate. The
 * predicted numbers come from what the file SAYS it is. If a file's stored note
 * about its own size or pixel shape is wrong — which happens — fixed numbers
 * would frame it wrongly, and worse, `concat` could still be handed a piece of
 * the wrong size and fail the entire export again. Expressions are worked out
 * from the picture actually being decoded, so the last two steps below force the
 * result to be exactly the canvas size, every time, whatever the file claimed.
 *
 * The arithmetic is identical to `normalizeVisual`. `force_original_aspect_ratio`
 * with `decrease` is Math.min of the two factors; with `increase` it is Math.max.
 * A test drives real files through both and checks the numbers match.
 *
 * The guarantee this buys is worth stating plainly: after these steps a piece of
 * footage is ALWAYS exactly canvasWidth x canvasHeight with square pixels, so
 * joining pieces can never fail on geometry again, no matter what was imported.
 */
export const normalizationFilterSteps = (input: Readonly<{
  canvasWidth: number
  canvasHeight: number
  fitMode: VisualFitMode
}>): readonly string[] => {
  const { canvasWidth: width, canvasHeight: height, fitMode } = input

  const steps: string[] = [
    // Step 2 — square the pixels, then say so. Without `setsar=1` afterwards the
    // oblong shape would be re-applied on top of the size we just corrected.
    "scale=w='max(2,trunc(iw*sar/2)*2)':h='max(2,trunc(ih/2)*2)'",
    'setsar=1',
    // Steps 3 and 4 — one scale factor for both directions, so the picture keeps
    // its shape. `decrease` = fit inside; `increase` = cover.
    `scale=w=${width}:h=${height}:force_original_aspect_ratio=` +
      `${fitMode === 'fit' ? 'decrease' : 'increase'}`,
    // yuv420p cannot describe an odd width or height.
    "scale=w='trunc(iw/2)*2':h='trunc(ih/2)*2'",
  ]

  if (fitMode === 'fit') {
    // Step 5a — black bars, centred, filling out to exactly the canvas.
    steps.push(`pad=w=${width}:h=${height}:x='(ow-iw)/2':y='(oh-ih)/2':color=black`)
  } else {
    // Step 5b — take the middle and throw the overhang away. `min` guards the
    // case where the picture is already smaller in one direction: cropping to
    // larger than the input is an error, and the pad below then finishes the job.
    steps.push(
      `crop=w='min(iw,${width})':h='min(ih,${height})':x='(iw-ow)/2':y='(ih-oh)/2'`,
      `pad=w=${width}:h=${height}:x='(ow-iw)/2':y='(oh-ih)/2':color=black`,
    )
  }

  // Steps 6 and 7 — square pixels declared, and one colour storage for every
  // piece. `concat` compares all three of size, pixel shape and colour storage.
  steps.push('setsar=1', 'format=pix_fmts=yuv420p')
  return Object.freeze(steps)
}

/**
 * The same rule again, as the browser's own word for it.
 *
 * A `<video>` element inside a box the shape of the canvas does exactly this:
 * `contain` shrinks the whole picture in and leaves the box showing through
 * (which is the black bars), `cover` grows it to fill and clips the overhang.
 * Naming it here — rather than writing 'contain' somewhere in the browser code —
 * is what stops the two sides drifting apart.
 */
export const normalizationObjectFit = (fitMode: VisualFitMode): 'contain' | 'cover' =>
  fitMode === 'fit' ? 'contain' : 'cover'
