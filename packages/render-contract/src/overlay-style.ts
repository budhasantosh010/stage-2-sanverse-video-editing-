/**
 * The one description of how titles and callouts look.
 *
 * Same rule as every other style contract here: this file names no CSS property
 * and no FFmpeg filter. It produces NUMBERS. The browser turns those numbers
 * into CSS, the exporter turns the same numbers into FFmpeg arguments, and a
 * test evaluates both and fails if they disagree. That is what makes "what you
 * approved is what you exported" structural rather than hopeful.
 *
 * Every size is a FRACTION of the frame with a floor in pixels. A fraction
 * alone would make a title unreadable on a small vertical video; a fixed pixel
 * size alone would make it a postage stamp on 4K. Both together give a title
 * that is the same size relative to the picture at every resolution, and never
 * smaller than the eye can read.
 */

export type TitleStyle = Readonly<{
  styleId: string
  /** Headline height as a fraction of frame height. */
  headlineRatio: number
  minHeadlineSize: number
  subheadRatio: number
  minSubheadSize: number
  /** Breathing room inside the plate, as a fraction of frame height. */
  paddingRatio: number
  minPadding: number
  /** Gap between the two lines, as a fraction of the headline's own size. */
  lineGapRatio: number
  /** How far up from the bottom a lower-third title sits. */
  lowerThirdMarginRatio: number
  minLowerThirdMargin: number
  textColor: string
  textOpacity: number
  /** null means no plate behind the words. */
  backgroundColor: string | null
  backgroundOpacity: number
}>

export const TITLE_STYLE_BOXED: TitleStyle = Object.freeze({
  styleId: 'sanverse.title.boxed/v1',
  headlineRatio: 0.075,
  minHeadlineSize: 20,
  subheadRatio: 0.038,
  minSubheadSize: 13,
  paddingRatio: 0.018,
  minPadding: 8,
  lineGapRatio: 0.3,
  lowerThirdMarginRatio: 0.14,
  minLowerThirdMargin: 32,
  textColor: '#ffffff',
  textOpacity: 1,
  backgroundColor: '#000000',
  backgroundOpacity: 0.6,
})

export const TITLE_STYLE_PLAIN: TitleStyle = Object.freeze({
  ...TITLE_STYLE_BOXED,
  styleId: 'sanverse.title.plain/v1',
  backgroundColor: null,
  backgroundOpacity: 0,
})

const TITLE_STYLES: readonly TitleStyle[] = Object.freeze([TITLE_STYLE_BOXED, TITLE_STYLE_PLAIN])

/**
 * An unknown look is refused, never quietly swapped for the default.
 *
 * Silently substituting would export a video that looks different from the one
 * the user approved, and nothing would say so.
 */
export const resolveTitleStyle = (styleId: string): TitleStyle => {
  const style = TITLE_STYLES.find((candidate) => candidate.styleId === styleId)
  if (!style) throw new Error(`unknown title style: ${styleId}`)
  return style
}

export type TitleMetrics = Readonly<{
  headlineFontSize: number
  subheadFontSize: number
  padding: number
  lineGap: number
  lowerThirdMargin: number
}>

export const resolveTitleMetrics = (
  frameWidth: number,
  frameHeight: number,
  style: TitleStyle,
): TitleMetrics => {
  const headlineFontSize = Math.max(style.minHeadlineSize, Math.round(frameHeight * style.headlineRatio))
  return Object.freeze({
    headlineFontSize,
    subheadFontSize: Math.max(style.minSubheadSize, Math.round(frameHeight * style.subheadRatio)),
    padding: Math.max(style.minPadding, Math.round(frameHeight * style.paddingRatio)),
    lineGap: Math.round(headlineFontSize * style.lineGapRatio),
    lowerThirdMargin: Math.max(style.minLowerThirdMargin, Math.round(frameHeight * style.lowerThirdMarginRatio)),
    // frameWidth is accepted so both renderers call the same function with the
    // same arguments; horizontal placement is pure centring and needs no metric.
    ...(frameWidth > 0 ? {} : {}),
  })
}

/**
 * Top edge of one title line's plate, in pixels from the top of the frame.
 *
 * The block is treated as a whole and then positioned, rather than each line
 * being positioned on its own, so a title with a subhead sits where a title
 * without one sits — centred on the same point instead of drifting upward.
 */
export const titleLineTop = (
  lineIndex: number,
  hasSubhead: boolean,
  placement: 'center' | 'lower-third',
  frameHeight: number,
  metrics: TitleMetrics,
): number => {
  const headlineBox = metrics.headlineFontSize + metrics.padding * 2
  const subheadBox = metrics.subheadFontSize + metrics.padding * 2
  const blockHeight = hasSubhead ? headlineBox + metrics.lineGap + subheadBox : headlineBox
  const blockTop = placement === 'center'
    ? Math.round((frameHeight - blockHeight) / 2)
    : frameHeight - metrics.lowerThirdMargin - blockHeight
  return lineIndex === 0 ? blockTop : blockTop + headlineBox + metrics.lineGap
}

export type CalloutStyle = Readonly<{
  styleId: string
  /** Line thickness as a fraction of frame height. */
  borderRatio: number
  minBorder: number
  borderColor: string
  borderOpacity: number
  labelRatio: number
  minLabelSize: number
  labelPaddingRatio: number
  minLabelPadding: number
  labelColor: string
  labelBackgroundColor: string
  labelBackgroundOpacity: number
}>

export const CALLOUT_STYLE_OUTLINE: CalloutStyle = Object.freeze({
  styleId: 'sanverse.callout.outline/v1',
  borderRatio: 0.005,
  minBorder: 2,
  // Chosen because it reads against both bright and dark footage without a
  // plate behind it, which a white or black line does not.
  borderColor: '#ffd400',
  borderOpacity: 1,
  labelRatio: 0.032,
  minLabelSize: 12,
  labelPaddingRatio: 0.01,
  minLabelPadding: 4,
  labelColor: '#000000',
  labelBackgroundColor: '#ffd400',
  labelBackgroundOpacity: 1,
})

const CALLOUT_STYLES: readonly CalloutStyle[] = Object.freeze([CALLOUT_STYLE_OUTLINE])

export const resolveCalloutStyle = (styleId: string): CalloutStyle => {
  const style = CALLOUT_STYLES.find((candidate) => candidate.styleId === styleId)
  if (!style) throw new Error(`unknown callout style: ${styleId}`)
  return style
}

export type CalloutMetrics = Readonly<{
  borderWidth: number
  labelFontSize: number
  labelPadding: number
}>

export const resolveCalloutMetrics = (
  frameWidth: number,
  frameHeight: number,
  style: CalloutStyle,
): CalloutMetrics => Object.freeze({
  borderWidth: Math.max(style.minBorder, Math.round(frameHeight * style.borderRatio)),
  labelFontSize: Math.max(style.minLabelSize, Math.round(frameHeight * style.labelRatio)),
  labelPadding: Math.max(style.minLabelPadding, Math.round(frameHeight * style.labelPaddingRatio)),
})

/** The callout rectangle in whole pixels, snapped so both renderers agree. */
export const calloutRectPixels = (
  region: Readonly<{ x: number; y: number; width: number; height: number }>,
  frameWidth: number,
  frameHeight: number,
): Readonly<{ x: number; y: number; width: number; height: number }> => Object.freeze({
  x: Math.round(region.x * frameWidth),
  y: Math.round(region.y * frameHeight),
  width: Math.round(region.width * frameWidth),
  height: Math.round(region.height * frameHeight),
})

/**
 * Where a callout's label sits: directly above the rectangle, unless the
 * rectangle is close enough to the top that the label would fall off the frame,
 * in which case it goes just inside the top instead.
 *
 * Stated here, once, so the preview and the export cannot pick different sides.
 */
export const calloutLabelTop = (
  rect: Readonly<{ y: number; height: number }>,
  metrics: CalloutMetrics,
): number => {
  const labelBox = metrics.labelFontSize + metrics.labelPadding * 2
  const above = rect.y - labelBox - metrics.borderWidth
  return above >= 0 ? above : rect.y + metrics.borderWidth
}

/**
 * The box a B-roll clip or picture is drawn in, keeping its own shape.
 *
 * The overlay is scaled to FIT inside the region and centred, never stretched
 * to fill it. A phone clip dropped into a wide box would otherwise come out
 * squashed, and nobody notices until the export.
 */
export const fitInsideRegion = (
  region: Readonly<{ x: number; y: number; width: number; height: number }>,
  frameWidth: number,
  frameHeight: number,
  mediaWidth: number,
  mediaHeight: number,
): Readonly<{ x: number; y: number; width: number; height: number }> => {
  const boxWidth = Math.max(1, Math.round(region.width * frameWidth))
  const boxHeight = Math.max(1, Math.round(region.height * frameHeight))
  const boxX = Math.round(region.x * frameWidth)
  const boxY = Math.round(region.y * frameHeight)
  if (mediaWidth <= 0 || mediaHeight <= 0) {
    return Object.freeze({ x: boxX, y: boxY, width: boxWidth, height: boxHeight })
  }
  const scale = Math.min(boxWidth / mediaWidth, boxHeight / mediaHeight)
  // Even dimensions, because H.264 with 4:2:0 colour cannot encode an odd one
  // and FFmpeg fails late rather than rounding for you.
  const width = Math.max(2, Math.round((mediaWidth * scale) / 2) * 2)
  const height = Math.max(2, Math.round((mediaHeight * scale) / 2) * 2)
  return Object.freeze({
    x: boxX + Math.round((boxWidth - width) / 2),
    y: boxY + Math.round((boxHeight - height) / 2),
    width,
    height,
  })
}
