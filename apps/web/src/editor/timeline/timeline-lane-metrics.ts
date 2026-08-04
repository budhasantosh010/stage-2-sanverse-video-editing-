import { laneDensityForHeight, type LaneDensity } from '../../features/media-analysis'
import type { TimelineLaneKind } from '../../features/timeline'

/**
 * How tall each row of the timeline is, in ONE place.
 *
 * ## Why this is not simply written in the stylesheet
 *
 * Two different things need the same number. The stylesheet needs it to lay the
 * row out; the code needs it to decide whether there is room for a filmstrip and
 * how tall to draw it. If the number lived in the stylesheet alone, the code
 * would have to guess it, and the day somebody changed the stylesheet the
 * filmstrips would be drawn at the old height — overflowing their row or leaving
 * a gap, with nothing in the code to explain why.
 *
 * So the number lives here, and the stylesheet is TOLD it. One fact, one place.
 *
 * ## Why the video and sound rows grew
 *
 * They used to be 42 and 34 pixels tall, which was enough for a coloured
 * rectangle with a name on it. A row of pictures needs more than that to be
 * recognisable, and a sound shape needs enough height that a quiet passage and a
 * loud one look different. The rows that carry no decoration — captions — are
 * unchanged, because making them taller would push the useful rows off screen
 * for nothing.
 */
export const TIMELINE_LANE_HEIGHTS: Readonly<Record<TimelineLaneKind, number>> = Object.freeze({
  /** Anything laid on top: B-roll, pictures, titles, callouts. */
  overlay: 46,
  /** The main footage. The tallest, because it is what the video IS. */
  video: 58,
  /** Words on screen. No pictures and no sound shape, so no extra height. */
  caption: 32,
  /** The sound that came with the footage. */
  dialogue: 42,
  /** Music and anything else laid under. */
  music: 42,
})

/**
 * The same rows on a small screen.
 *
 * A phone in portrait has room for perhaps four rows. Keeping the full heights
 * would mean the user could see the footage row and nothing else, so every row
 * shrinks — and the decorations honestly step down with them rather than being
 * squeezed into a space they cannot be read in.
 */
export const TIMELINE_LANE_HEIGHTS_COMPACT: Readonly<Record<TimelineLaneKind, number>> = Object.freeze({
  overlay: 32,
  video: 40,
  // Words on screen carry no picture and no sound shape, so this row can be the
  // one that gives up its height first.
  caption: 24,
  dialogue: 32,
  music: 32,
})

/**
 * Below this the SCREEN is treated as small. Matches the stylesheet's own break.
 *
 * The number that must be passed in is the width of the WINDOW, not the width of
 * the timeline itself. They are very different: on a 1440-pixel desktop the
 * timeline shares the screen with the preview and the inspector and is often
 * only 700 pixels wide. Measuring the timeline instead would decide the user was
 * on a phone and shrink every row on a large desktop — which it did, the first
 * time this ran in a real browser.
 */
export const COMPACT_LAYOUT_MAX_WIDTH_PX = 1100

export const laneHeightPx = (kind: TimelineLaneKind, windowWidthPx: number): number => {
  const table = Number.isFinite(windowWidthPx) && windowWidthPx <= COMPACT_LAYOUT_MAX_WIDTH_PX
    ? TIMELINE_LANE_HEIGHTS_COMPACT
    : TIMELINE_LANE_HEIGHTS
  return table[kind] ?? TIMELINE_LANE_HEIGHTS.caption
}

/**
 * How wide the whole window is, kept up to date.
 *
 * Read once at mount and again whenever the window changes size. On a server or
 * in a test with no window it falls back to a desktop width, so the default is
 * "there is room", not "assume a phone".
 */
export const DEFAULT_WINDOW_WIDTH_PX = 1440

export const currentWindowWidthPx = (): number =>
  typeof window === 'undefined' || !Number.isFinite(window.innerWidth)
    ? DEFAULT_WINDOW_WIDTH_PX
    : window.innerWidth

/**
 * How much detail this row has room for.
 *
 * `full` draws everything, `compact` draws fewer and coarser, `minimal` draws
 * none at all and leaves the name and the edges — which is what is actually
 * useful when a row is 26 pixels tall.
 */
export const laneDensity = (kind: TimelineLaneKind, viewportWidthPx: number): LaneDensity =>
  laneDensityForHeight(laneHeightPx(kind, viewportWidthPx))

/**
 * How much of a row a decoration may fill.
 *
 * Not the whole row: the clip's name has to stay readable on top of it, and the
 * selected outline and trim handles have to stay visible. Two thirds leaves room
 * for both without the decoration looking like a thin stripe.
 */
export const DECORATION_HEIGHT_RATIO = 0.68

export const decorationHeightPx = (kind: TimelineLaneKind, viewportWidthPx: number): number =>
  Math.max(8, Math.round(laneHeightPx(kind, viewportWidthPx) * DECORATION_HEIGHT_RATIO))
