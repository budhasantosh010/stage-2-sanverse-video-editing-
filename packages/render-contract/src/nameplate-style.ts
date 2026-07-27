/**
 * The one description of what a nameplate looks like.
 *
 * Before this file existed there were two independent designs — one in CSS for
 * the browser preview and one in FFmpeg arguments for the export — and nothing
 * compared them. They differed in font, in what the font size was measured
 * against, in whether long text wrapped, and in padding. Resizing the browser
 * window changed the preview but not the export.
 *
 * That matters more than it sounds. The entire safety story of this product is
 * "the user approves what they see in the preview". If the preview is not the
 * truth, that approval means nothing, and every AI feature built on top of it
 * inherits the lie.
 *
 * So: CSS and FFmpeg define no product semantics of their own. Both read the
 * numbers and rules below, and both are checked against each other by test.
 */

export const NAMEPLATE_STYLE_ID = 'sanverse.nameplate.default/v1'

export const NAMEPLATE_STYLE_V1 = Object.freeze({
  styleId: NAMEPLATE_STYLE_ID,

  /**
   * Every size is a fraction of the composition's SHORTEST edge, never of the
   * browser window. A nameplate on a 1080p video is the same size relative to
   * the picture whether the preview is full screen or in a small pane.
   */
  primaryFontRatio: 0.035,
  secondaryFontRatio: 0.026,
  paddingRatio: 0.011,
  safeMarginRatio: 0.03,
  /** Gap between the two lines, as a fraction of the primary font size. */
  lineGapRatio: 0.25,

  minPrimaryFontSize: 12,
  minSecondaryFontSize: 10,
  minPadding: 4,
  minSafeMargin: 8,

  primaryColor: '#ffffff',
  primaryOpacity: 1,
  secondaryColor: '#ffffff',
  secondaryOpacity: 0.78,
  backgroundColor: '#000000',
  backgroundOpacity: 0.82,

  fontWeight: 400,
  /**
   * Single line, never wrapped. FFmpeg's drawtext cannot wrap text, so a
   * wrapping preview would promise something the export cannot deliver. The
   * domain caps text length; this is the visual consequence of that cap.
   */
  wrap: 'none' as const,
} as const)

export type NameplateStyle = typeof NAMEPLATE_STYLE_V1

export type NameplateMetrics = Readonly<{
  primaryFontSize: number
  secondaryFontSize: number
  padding: number
  lineGap: number
  safeMargin: number
}>

/**
 * Turn the ratios into whole pixels for one composition size.
 *
 * Whole pixels matter: half a pixel is a place where two renderers can
 * legitimately round in opposite directions and drift apart.
 */
export const resolveNameplateMetrics = (
  frameWidth: number,
  frameHeight: number,
  style: NameplateStyle = NAMEPLATE_STYLE_V1,
): NameplateMetrics => {
  const shortestEdge = Math.min(frameWidth, frameHeight)
  const primaryFontSize = Math.max(style.minPrimaryFontSize, Math.round(shortestEdge * style.primaryFontRatio))
  return Object.freeze({
    primaryFontSize,
    secondaryFontSize: Math.max(style.minSecondaryFontSize, Math.round(shortestEdge * style.secondaryFontRatio)),
    padding: Math.max(style.minPadding, Math.round(shortestEdge * style.paddingRatio)),
    lineGap: Math.round(primaryFontSize * style.lineGapRatio),
    safeMargin: Math.max(style.minSafeMargin, Math.round(shortestEdge * style.safeMarginRatio)),
  })
}

/** Fraction of the box that sits left of / above the anchor point. */
export const anchorFraction = (anchor: string): Readonly<{ x: number; y: number }> => {
  const [vertical, horizontal] = anchor.split('-')
  return Object.freeze({
    x: horizontal === 'left' ? 0 : horizontal === 'right' ? 1 : 0.5,
    y: vertical === 'top' ? 0 : vertical === 'bottom' ? 1 : 0.5,
  })
}

export type PlacementInput = Readonly<{
  /** Normalized position, 0..1, in the composition's own coordinate space. */
  pointX: number
  pointY: number
  anchor: string
  frameWidth: number
  frameHeight: number
  /** Measured size of the drawn box, in composition pixels. */
  boxWidth: number
  boxHeight: number
  safeMargin: number
}>

/**
 * Where the nameplate box actually goes.
 *
 * Each renderer measures its own text with its own real font metrics and then
 * calls this with the result, so neither has to guess how wide the other's
 * text will be. Only the RULE is shared, which is the part that can drift.
 */
export const resolveNameplatePlacement = (
  input: PlacementInput,
): Readonly<{ x: number; y: number }> => {
  const fraction = anchorFraction(input.anchor)
  const rawX = input.pointX * input.frameWidth - input.boxWidth * fraction.x
  const rawY = input.pointY * input.frameHeight - input.boxHeight * fraction.y
  return Object.freeze({
    x: clampAxis(rawX, input.boxWidth, input.frameWidth, input.safeMargin),
    y: clampAxis(rawY, input.boxHeight, input.frameHeight, input.safeMargin),
  })
}

/**
 * Keep the box inside the safe area. When the box is larger than the safe
 * area, centre it instead of inverting the clamp and producing nonsense.
 */
const clampAxis = (raw: number, boxSize: number, frameSize: number, safeMargin: number): number => {
  const min = safeMargin
  const max = frameSize - safeMargin - boxSize
  if (max < min) return Math.round((frameSize - boxSize) / 2)
  return Math.round(Math.min(Math.max(raw, min), max))
}

/**
 * The same clamp, written as an FFmpeg expression.
 *
 * FFmpeg substitutes the real measured text size for `text_w` and `text_h` at
 * render time, so this is not an approximation of the browser's behaviour — it
 * is the identical formula with the identical inputs. The parity test
 * evaluates this string numerically and asserts it matches
 * `resolveNameplatePlacement`.
 *
 * Two details matter for that to hold.
 *
 * First, what gets anchored is the VISIBLE BOX, not the text inside it. The
 * user pointed at a place on the picture and expects the thing they can see to
 * land there. FFmpeg's `x`/`y` position the text, so the padding is added back
 * at the end.
 *
 * Second, the result is rounded here rather than left to FFmpeg, so both
 * renderers land on the same whole pixel instead of rounding independently.
 */
export type FfmpegPlacementInput = Readonly<{
  axis: 'x' | 'y'
  point: number
  anchorFraction: number
  frameSize: number
  safeMargin: number
  padding: number
  /**
   * The line's height in composition pixels — its font size. Used instead of
   * FFmpeg's `text_h` on the vertical axis, because `text_h` measures the
   * glyphs while CSS measures the em box, and those differ by the font's
   * internal leading (8 pixels at 28px Arial, measured 2026-07-27). Using a
   * number both renderers already know makes vertical placement identical for
   * every anchor rather than only for top-anchored nameplates.
   */
  lineHeight: number
}>

/** Where the visible box's top-left corner goes, in composition pixels. */
export const ffmpegBoxPositionExpression = (input: FfmpegPlacementInput): string => {
  const boxSize = input.axis === 'x'
    ? `(text_w+${2 * input.padding})`
    : String(input.lineHeight + 2 * input.padding)
  const anchored = `${input.point * input.frameSize}-${boxSize}*${input.anchorFraction}`
  const min = input.safeMargin
  const max = `${input.frameSize - input.safeMargin}-${boxSize}`
  const centred = `(${input.frameSize}-${boxSize})/2`
  // lt(max,min) is the "box does not fit the safe area" case.
  return `round(if(lt(${max}\\,${min})\\,${centred}\\,max(${min}\\,min(${max}\\,${anchored}))))`
}

/**
 * From the box's corner to where FFmpeg wants the text drawn.
 *
 * Horizontally that is just the padding. Vertically the glyphs are also
 * centred inside the em box, so a shorter glyph box sits in the same place the
 * browser's line box does.
 */
export const ffmpegTextInsetExpression = (
  axis: 'x' | 'y',
  padding: number,
  lineHeight: number,
): string => (axis === 'x' ? `+${padding}` : `+${padding}+(${lineHeight}-text_h)/2`)

/** Box position and text inset combined: the value FFmpeg's `x`/`y` takes. */
export const ffmpegPlacementExpression = (input: FfmpegPlacementInput): string =>
  `${ffmpegBoxPositionExpression(input)}${ffmpegTextInsetExpression(input.axis, input.padding, input.lineHeight)}`

export const toFfmpegColor = (hex: string, opacity: number): string =>
  `0x${hex.replace('#', '')}@${opacity}`

export const toCssColor = (hex: string, opacity: number): string => {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}

/** Where the browser can fetch the exact font file the export will use. */
export const NAMEPLATE_FONT_URL = '/api/render-assets/nameplate-font'
export const NAMEPLATE_FONT_FAMILY = 'SanverseNameplate'
