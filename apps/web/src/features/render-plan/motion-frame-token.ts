/**
 * WHAT A DRAWN CANVAS FRAME IS A PICTURE *OF*.
 *
 * A canvas is just pixels. It cannot say which moment of which file it holds,
 * so without an identity five different wrong pictures all look exactly like a
 * working preview:
 *
 * 1. a cleared canvas that was never drawn on;
 * 2. the frame from a seek the user has already moved on from;
 * 3. a frame of the PREVIOUS asset, after the source was swapped;
 * 4. a frame drawn at the old panel size, after a resize;
 * 5. a frame left behind by a previously opened project.
 *
 * So every draw records what it drew, every render states what it wants, and
 * the canvas is shown only when those two strings are equal.
 *
 * It lives beside the drawing code rather than beside the monitor because the
 * drawing code is what mints it — the monitor only compares.
 */

export type MotionCanvasFrameToken = Readonly<{
  assetId: string
  sourceTicks: number
  compositionTicks: number
  motionId: string | null
  /** Bumped whenever the canvas geometry changes, e.g. a panel resize. */
  geometryVersion: number
}>

/**
 * One string per distinguishable frame.
 *
 * A string rather than a deep object comparison because it has to survive a
 * round trip through a DOM dataset and a React render, where object identity is
 * worthless.
 */
export const motionCanvasFrameToken = (token: MotionCanvasFrameToken): string =>
  [
    token.assetId,
    token.sourceTicks,
    token.compositionTicks,
    token.motionId ?? '-',
    token.geometryVersion,
  ].join('|')
