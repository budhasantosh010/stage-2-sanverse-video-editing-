import { getRenderedVideoContentBox, type ElementBox } from '../point-target/point-target.ts'

/**
 * Turning where a finger touched the screen into where it touched the PICTURE.
 *
 * These are not the same thing, and the gap between them is the bug this file
 * exists to make impossible.
 *
 * A video element is a box on a page. The picture inside it almost never fills
 * that box exactly, because the picture has its own shape. A tall phone video
 * shown in a wide window leaves black bars down each side; a wide video in a
 * tall window leaves bars above and below. Those bars belong to the element and
 * not to the picture.
 *
 *      element box (what the page gave the video)
 *      ┌───────────────────────────────────────┐
 *      │▓▓▓▓▓│                           │▓▓▓▓▓│
 *      │▓ b ▓│      the actual picture    │▓ b ▓│
 *      │▓ a ▓│                            │▓ a ▓│
 *      │▓ r ▓│         ✱ user tapped here │▓ r ▓│
 *      │▓▓▓▓▓│                           │▓▓▓▓▓│
 *      └───────────────────────────────────────┘
 *
 * Measured against the ELEMENT the tap is maybe 70% across. Measured against
 * the PICTURE it is maybe 85% across. Store the first number and the mark walks
 * sideways the moment the window is resized, and lands somewhere else again in
 * fullscreen. Store the second and it stays on the same object forever.
 *
 * So every mark is stored as a fraction of the picture, 0 to 1, and the bars
 * are subtracted first. `getRenderedVideoContentBox` is the single function
 * that works out where the picture actually sits, and it is shared with
 * point-target so a tap and a drawn mark can never disagree.
 */

export type ClientPoint = Readonly<{ clientX: number; clientY: number }>
export type NormalizedPoint = Readonly<{ x: number; y: number }>

export type CaptureAnnotationInput = Readonly<{
  clientPoints: readonly ClientPoint[]
  elementBox: ElementBox
  videoWidth: number
  videoHeight: number
  currentTimeSeconds: number
}>

export type CaptureAnnotationResult =
  | { readonly ok: true; readonly value: { readonly points: readonly NormalizedPoint[]; readonly timeMs: number } }
  | { readonly ok: false; readonly error: string }

/**
 * Marks are allowed to run right up to the edge but never past it.
 *
 * A finger dragged off the side of a phone screen produces coordinates outside
 * the picture. Refusing the whole stroke would throw away a gesture the user
 * meant; letting it through would store a position that does not exist. Pulling
 * it back to the edge keeps the part of the stroke that was on the picture and
 * puts the rest exactly on the boundary, which is where the user's finger
 * visibly was when it left.
 */
const clampUnit = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value)

export const captureAnnotationPoints = (input: CaptureAnnotationInput): CaptureAnnotationResult => {
  if (!Number.isFinite(input.currentTimeSeconds) || input.currentTimeSeconds < 0) {
    return { ok: false, error: 'The current video time is unavailable.' }
  }
  if (input.clientPoints.length === 0) {
    return { ok: false, error: 'Draw on the video first.' }
  }
  const contentBox = getRenderedVideoContentBox(input.elementBox, input.videoWidth, input.videoHeight)
  if (!contentBox) {
    return { ok: false, error: 'The visible video bounds are unavailable.' }
  }

  const points: NormalizedPoint[] = []
  for (const point of input.clientPoints) {
    if (!Number.isFinite(point.clientX) || !Number.isFinite(point.clientY)) {
      return { ok: false, error: 'Part of that mark could not be read.' }
    }
    points.push({
      x: clampUnit((point.clientX - contentBox.left) / contentBox.width),
      y: clampUnit((point.clientY - contentBox.top) / contentBox.height),
    })
  }

  return {
    ok: true,
    value: { points: Object.freeze(points), timeMs: Math.round(input.currentTimeSeconds * 1000) },
  }
}

/**
 * The exact inverse: put a stored mark back on screen at whatever size the
 * video is being shown at now.
 *
 * Drawing uses this and only this, so the mark on screen is always derived from
 * the stored number rather than from wherever the finger happened to be. That
 * is what makes resizing the window, rotating the phone, and entering
 * fullscreen all leave the mark on the same object.
 */
export const annotationPointToClient = (
  point: NormalizedPoint,
  elementBox: ElementBox,
  videoWidth: number,
  videoHeight: number,
): ClientPoint | null => {
  const contentBox = getRenderedVideoContentBox(elementBox, videoWidth, videoHeight)
  if (!contentBox) return null
  return {
    clientX: contentBox.left + point.x * contentBox.width,
    clientY: contentBox.top + point.y * contentBox.height,
  }
}
