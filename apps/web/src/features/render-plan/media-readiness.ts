/**
 * HTMLMediaElement readiness levels, named so no bare number appears anywhere.
 *
 * The distinction that matters is HAVE_METADATA vs HAVE_CURRENT_DATA. A video
 * reports `videoWidth` and `videoHeight` at HAVE_METADATA — before a single
 * frame can be drawn from it. Treating "we know the size" as "we have a
 * picture" is what allows an empty canvas to be revealed over a healthy video,
 * or a blank frame to be presented as if it were the footage.
 */
export const HAVE_NOTHING = 0
export const HAVE_METADATA = 1
export const HAVE_CURRENT_DATA = 2
export const HAVE_FUTURE_DATA = 3
export const HAVE_ENOUGH_DATA = 4

/** Whether a frame can actually be read out of this element right now. */
export const hasDecodableFrame = (
  media: Readonly<{ readyState: number; videoWidth: number; videoHeight: number }>,
): boolean =>
  media.readyState >= HAVE_CURRENT_DATA && media.videoWidth > 0 && media.videoHeight > 0
