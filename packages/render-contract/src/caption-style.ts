import { toCssColor, toFfmpegColor } from './nameplate-style.ts'

/**
 * The one description of what a caption looks like.
 *
 * Same rule as `nameplate-style.ts`, for the same reason: the browser preview
 * and the FFmpeg export must not each own a private idea of the design, or the
 * thing the user approves stops being the thing they get.
 *
 * Captions differ from a nameplate in one structural way that drives every
 * number below: the user does not choose where they go. A nameplate is placed
 * on a face the user pointed at; a caption always sits in the same reserved
 * strip along the bottom, because a caption that moved around would be
 * unreadable and because every video platform's own player expects it there.
 *
 *      ┌───────────────────────────────────────────┐
 *      │                                           │
 *      │              the picture                  │
 *      │                                           │
 *      │        ┌───────────────────────┐          │
 *      │        │  a caption line here  │  ← bottom strip
 *      │        └───────────────────────┘          │
 *      │              ↕ bottomMarginRatio           │
 *      └───────────────────────────────────────────┘
 *
 * Two looks exist. "Boxed" draws a dark plate behind the words, which is the
 * only thing that stays readable over unknown footage. "Plain" draws an outline
 * instead, which looks cleaner and fails on bright backgrounds. Boxed is the
 * default for exactly that reason.
 */

export const CAPTION_STYLE_PLAIN_ID = 'sanverse.caption.plain/v1'
export const CAPTION_STYLE_BOXED_ID = 'sanverse.caption.boxed/v1'

export type CaptionStyle = Readonly<{
  styleId: string
  /** Font size as a fraction of the composition's SHORTEST edge. */
  fontRatio: number
  minFontSize: number
  /** Space around the words inside the plate, as a fraction of shortest edge. */
  paddingRatio: number
  minPadding: number
  /** Distance from the bottom of the picture to the bottom of the last line. */
  bottomMarginRatio: number
  minBottomMargin: number
  /** Gap between two stacked lines, as a fraction of the font size. */
  lineGapRatio: number
  textColor: string
  textOpacity: number
  /** Null means no plate is drawn; the outline carries readability instead. */
  backgroundColor: string | null
  backgroundOpacity: number
  /** Outline thickness as a fraction of the font size. 0 means none. */
  outlineRatio: number
  outlineColor: string
  fontWeight: number
}>

export const CAPTION_STYLE_BOXED: CaptionStyle = Object.freeze({
  styleId: CAPTION_STYLE_BOXED_ID,
  fontRatio: 0.045,
  minFontSize: 14,
  paddingRatio: 0.012,
  minPadding: 5,
  bottomMarginRatio: 0.07,
  minBottomMargin: 16,
  lineGapRatio: 0.22,
  textColor: '#ffffff',
  textOpacity: 1,
  backgroundColor: '#000000',
  backgroundOpacity: 0.75,
  outlineRatio: 0,
  outlineColor: '#000000',
  fontWeight: 400,
})

export const CAPTION_STYLE_PLAIN: CaptionStyle = Object.freeze({
  styleId: CAPTION_STYLE_PLAIN_ID,
  fontRatio: 0.045,
  minFontSize: 14,
  paddingRatio: 0.012,
  minPadding: 5,
  bottomMarginRatio: 0.07,
  minBottomMargin: 16,
  lineGapRatio: 0.22,
  textColor: '#ffffff',
  textOpacity: 1,
  backgroundColor: null,
  backgroundOpacity: 0,
  // Roughly 1.5px at a 32px font: enough to separate the glyphs from bright
  // footage without the letters looking bolded.
  outlineRatio: 0.05,
  outlineColor: '#000000',
  fontWeight: 400,
})

export const CAPTION_STYLES: readonly CaptionStyle[] = Object.freeze([
  CAPTION_STYLE_BOXED,
  CAPTION_STYLE_PLAIN,
])

/**
 * Look up a style. An unknown id falls back to boxed rather than throwing,
 * because a renderer that refuses to draw is worse than one that draws the
 * safe default — and the DOMAIN already refused any unknown id long before a
 * plan reaches here, so this branch is a backstop, not a policy.
 */
export const resolveCaptionStyle = (styleId: string): CaptionStyle =>
  CAPTION_STYLES.find((style) => style.styleId === styleId) ?? CAPTION_STYLE_BOXED

export type CaptionMetrics = Readonly<{
  fontSize: number
  padding: number
  bottomMargin: number
  lineGap: number
  outlineWidth: number
  /** Height of one line's plate, including padding above and below. */
  lineBoxHeight: number
}>

/** Ratios to whole pixels, so both renderers land on the same pixel. */
export const resolveCaptionMetrics = (
  frameWidth: number,
  frameHeight: number,
  style: CaptionStyle,
): CaptionMetrics => {
  const shortestEdge = Math.min(frameWidth, frameHeight)
  const fontSize = Math.max(style.minFontSize, Math.round(shortestEdge * style.fontRatio))
  const padding = Math.max(style.minPadding, Math.round(shortestEdge * style.paddingRatio))
  return Object.freeze({
    fontSize,
    padding,
    bottomMargin: Math.max(style.minBottomMargin, Math.round(shortestEdge * style.bottomMarginRatio)),
    lineGap: Math.round(fontSize * style.lineGapRatio),
    outlineWidth: Math.round(fontSize * style.outlineRatio),
    lineBoxHeight: fontSize + 2 * padding,
  })
}

/**
 * The top edge of one line's plate, counting up from the bottom of the picture.
 *
 * Lines are stacked upward from the bottom margin so that a two-line caption
 * grows INTO the picture rather than sliding down out of the safe area. Index 0
 * is the first line, which ends up highest.
 */
export const captionLineTop = (
  lineIndex: number,
  lineCount: number,
  frameHeight: number,
  metrics: CaptionMetrics,
): number => {
  const stackHeight = lineCount * metrics.lineBoxHeight + (lineCount - 1) * metrics.lineGap
  const stackTop = frameHeight - metrics.bottomMargin - stackHeight
  return Math.round(stackTop + lineIndex * (metrics.lineBoxHeight + metrics.lineGap))
}

/**
 * The FFmpeg `x` expression that centres a line horizontally.
 *
 * `text_w` is substituted by FFmpeg with the real measured width, so this is
 * the same centring the browser performs, not an approximation of it.
 */
export const ffmpegCaptionXExpression = (frameWidth: number): string =>
  `round((${frameWidth}-text_w)/2)`

export { toCssColor, toFfmpegColor }

/** Captions use the same font file the nameplate does, served the same way. */
export { NAMEPLATE_FONT_FAMILY as CAPTION_FONT_FAMILY, NAMEPLATE_FONT_URL as CAPTION_FONT_URL } from './nameplate-style.ts'
