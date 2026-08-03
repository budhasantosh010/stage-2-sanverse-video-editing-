import { ASSET_ID_PATTERN } from '@sanverse/edit-domain/media-organization'

/**
 * The ONLY thing that may travel from the Media panel to a drop target.
 *
 * A drag payload is not a convenience bag. Whatever is put in here becomes a
 * public interface between two parts of the product that are otherwise
 * unrelated, and — because a browser drag can cross a window — it is also
 * something the user's machine will hand to another program if they let go over
 * one. So the rule is the same closed-key rule the project schema uses:
 *
 *   four keys, exactly. Not three, not five. Anything else is refused.
 *
 * Deliberately ABSENT, and each for a reason worth writing down:
 *
 *   filesystem path   would leak where the user's disk is laid out
 *   source URL        a signed or local URL handed to another program
 *   object URL        a live handle into this tab's memory
 *   the asset object  mutable, and would let a drop target act on a stale copy
 *   project data      a drop must re-read the project, never trust the drag
 *
 * The receiver gets an IDENTITY (`assetId`) plus the two facts it needs to draw
 * a preview before it has looked anything up: what kind of thing it is, and how
 * long it is. Everything else it must fetch from the project itself, which is
 * the only place that is authoritative.
 */

export const MEDIA_DRAG_SCHEMA_VERSION = 'sanverse.media-drag/v1'

/** The drag type name registered on the DataTransfer. */
export const MEDIA_DRAG_MIME = 'application/vnd.sanverse.media-drag+json'

/**
 * Whether asset rows offer a visible drag gesture in the shipped product.
 *
 * FALSE until Gate C. The contract, the parser and the drag-source adapter all
 * exist and are tested, but nothing in the Timeline can yet accept a drop. A
 * gesture that can start and can never finish is worse than no gesture at all:
 * the user learns the product is broken, and they are right.
 */
export const MEDIA_DRAG_ENABLED = false

export const MEDIA_DRAG_KINDS = Object.freeze(['video', 'image', 'audio'] as const)
export type MediaDragKind = (typeof MEDIA_DRAG_KINDS)[number]

export type MediaDragPayloadV1 = Readonly<{
  schemaVersion: typeof MEDIA_DRAG_SCHEMA_VERSION
  assetId: string
  mediaKind: MediaDragKind
  sourceDurationTicks: number | null
}>

/** The four keys, in one place, so "closed" can be checked rather than trusted. */
const PAYLOAD_KEYS = Object.freeze(['schemaVersion', 'assetId', 'mediaKind', 'sourceDurationTicks'] as const)

const isDragKind = (value: unknown): value is MediaDragKind =>
  MEDIA_DRAG_KINDS.includes(value as MediaDragKind)

/**
 * A duration is either "not applicable" (a still picture) or a whole positive
 * number of ticks. A fraction, a negative, an infinity or a NaN is a refusal:
 * every one of those would become a clip length somebody has to draw.
 */
const isDurationTicks = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)

/**
 * Is this exactly a v1 payload?
 *
 * Exactly means: an object, not an array, with these four keys and no others.
 * An extra key is refused rather than dropped, because a sender that added a
 * key believes it matters, and silently discarding it would make the two sides
 * disagree about what was just moved.
 */
export const validateMediaDragPayload = (value: unknown): value is MediaDragPayloadV1 => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const keys = Object.keys(value)
  if (keys.length !== PAYLOAD_KEYS.length) return false
  if (!PAYLOAD_KEYS.every((key) => keys.includes(key))) return false
  const candidate = value as Record<string, unknown>
  return candidate.schemaVersion === MEDIA_DRAG_SCHEMA_VERSION
    && typeof candidate.assetId === 'string'
    && ASSET_ID_PATTERN.test(candidate.assetId)
    && isDragKind(candidate.mediaKind)
    && isDurationTicks(candidate.sourceDurationTicks)
}

/**
 * Build a payload for one asset, or return null when that asset cannot be
 * dragged at all — an unreadable kind, an id that is not an id.
 *
 * Null rather than a thrown error because "this row cannot start a drag" is an
 * ordinary answer the UI acts on, not an exceptional one.
 */
export const createMediaDragPayload = (
  input: Readonly<{ assetId: string; mediaKind: string; sourceDurationTicks: number | null }>,
): MediaDragPayloadV1 | null => {
  const payload = {
    schemaVersion: MEDIA_DRAG_SCHEMA_VERSION,
    assetId: input.assetId,
    mediaKind: input.mediaKind,
    sourceDurationTicks: input.sourceDurationTicks,
  }
  return validateMediaDragPayload(payload) ? Object.freeze(payload) : null
}

export const serializeMediaDragPayload = (payload: MediaDragPayloadV1): string => JSON.stringify(payload)

/**
 * Read a payload back from whatever a drop handed us.
 *
 * The input is genuinely unknown — it may have come from another program, or
 * from a much older or much newer build of this one. Anything that is not
 * exactly a v1 payload returns null, so a drop target's only possible outcomes
 * are "a valid asset" or "nothing", never "something half understood".
 */
export const parseMediaDragPayload = (text: unknown): MediaDragPayloadV1 | null => {
  if (typeof text !== 'string' || text.length === 0 || text.length > 4_096) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  return validateMediaDragPayload(parsed) ? Object.freeze(parsed) : null
}
