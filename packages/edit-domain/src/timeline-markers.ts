import { err, isRecord, ok, type Result } from './result.ts'
import { capabilityProduces } from './capabilities.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import { OPERATION_SCHEMA_VERSION } from './timeline-operations.ts'

/**
 * Markers — the user's own notes pinned to moments of their video.
 *
 * A marker is a flag: "the good take starts here", "fix the audio between here
 * and here", "this is where the sponsor bit goes". It is written by the person
 * editing, for the person editing.
 *
 * ## The one thing that makes markers different from everything else
 *
 * A marker changes NOTHING about the finished video. Nobody watching the export
 * can tell whether the project had two hundred markers or none.
 *
 * That gives markers two requirements that look like they fight each other:
 *
 *   1. They are the user's WORK. Somebody typed that note. Losing it when they
 *      close the tab, or when they open the project on another computer, is
 *      losing work. So markers must be part of the project and must be undoable.
 *
 *   2. They must NOT make the video be built again. Adding a note to a finished
 *      project and being told to wait four minutes for a byte-identical file is
 *      the product punishing somebody for writing a note.
 *
 * They only fight because of how an export used to be identified:
 *
 *      export key  =  project id : revision : schema version
 *
 * Any edit at all made a new revision, so any edit at all threw away a finished
 * export. The fix is in `apps/api/src/server.ts`: an export is now identified by
 * THE RENDER PLAN — by what will actually be produced. Two projects that will
 * produce the same video share one export. A marker does not appear in the
 * render plan, so adding one leaves the key untouched.
 *
 * ## Why one operation carries the WHOLE list
 *
 * Every operation here states the complete set of markers, not "add this one".
 * Same reason as `set-track-output`: the last one wins, and there is no way to
 * end up in a state nobody chose. Undoing "add the fifth marker" restores the
 * list of four exactly, with no replaying of nudges.
 *
 * The cost is honest and small: the operation is bigger. With at most 200
 * markers of at most 1,120 characters each, the worst case is well inside what a
 * change set already carries.
 *
 * ## A point and a range are ONE kind of thing
 *
 *      point marker        |            durationTicks = 0
 *      range marker        |=========|  durationTicks > 0
 *
 * They are not two types. A point is a range of zero length. Two types would
 * mean two code paths for "move a marker", and they would drift.
 */

export const MARKERS_OPERATION_KIND = 'set-timeline-markers'

export const MARKER_ID_PATTERN = /^marker_[a-z0-9]{8,64}$/

/**
 * The colours a marker may be.
 *
 * A closed list, not free-form colour values, for three reasons: the timeline
 * has to stay readable in light and dark, a user picking a colour must not be
 * able to make their own note invisible, and a name survives a theme change
 * where `#ff0000` does not.
 *
 * `neutral` is first because it is the default: a marker with nothing said about
 * its colour is not "no colour", it is the ordinary one.
 */
export const MARKER_COLORS = Object.freeze([
  'neutral',
  'red',
  'amber',
  'green',
  'blue',
  'violet',
] as const)

export type MarkerColor = (typeof MARKER_COLORS)[number]

export const isMarkerColor = (value: unknown): value is MarkerColor =>
  typeof value === 'string' && (MARKER_COLORS as readonly string[]).includes(value)

/** At most this many markers in one project. Beyond it the timeline is unreadable anyway. */
export const MAX_MARKERS = 200
/** A label is a glance-able name, not a paragraph. */
export const MAX_MARKER_LABEL_LENGTH = 120
/** A note is where the paragraph goes. */
export const MAX_MARKER_NOTE_LENGTH = 1_000

export type TimelineMarkerV1 = Readonly<{
  markerId: string
  /** Finished-video time. Never source time, never seconds. */
  startTicks: number
  /** Zero for a point marker. Never negative. */
  durationTicks: number
  label: string
  /** Empty string when there is nothing more to say. Never null, so there is one shape. */
  note: string
  color: MarkerColor
}>

export type SetTimelineMarkersOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: typeof MARKERS_OPERATION_KIND
  capabilityId: string
  /** The complete set, in time order. Never a change to the previous set. */
  markers: readonly TimelineMarkerV1[]
  extensions: Extensions
}>

const KEYS = Object.freeze([
  'schemaVersion',
  'operationId',
  'kind',
  'capabilityId',
  'markers',
  'extensions',
])

const MARKER_KEYS = Object.freeze([
  'markerId',
  'startTicks',
  'durationTicks',
  'label',
  'note',
  'color',
])

export type MarkersIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'DUPLICATE_ID'
  | 'OPERATION_KIND_UNKNOWN'
  | 'CAPABILITY_UNKNOWN'

export type MarkersOperationError = {
  readonly code: 'OPERATION_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: MarkersIssueCode }[]
}

const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/

/**
 * Text a user typed, checked before it is allowed into the project.
 *
 * Control characters are refused rather than stripped. Stripping would store
 * something different from what the user typed and show it back to them as
 * though it were theirs. Refusing says so.
 *
 * A newline is allowed in a note (people write lists) and refused in a label (a
 * label is one line on a timeline; a newline in it would silently be lost).
 */
const isCleanText = (value: unknown, maxLength: number, allowNewline: boolean): value is string => {
  if (typeof value !== 'string') return false
  if (value.length > maxLength) return false
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code === 0x0a && allowNewline) continue
    if (code < 0x20 || code === 0x7f) return false
  }
  return true
}

const validateMarker = (
  input: unknown,
  path: string,
  issues: { path: string; code: MarkersIssueCode }[],
): TimelineMarkerV1 | null => {
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  const before = issues.length
  for (const key of MARKER_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!MARKER_KEYS.includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  }
  if (typeof input.markerId !== 'string' || !MARKER_ID_PATTERN.test(input.markerId)) {
    issues.push({ path: `${path}.markerId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!Number.isSafeInteger(input.startTicks) || (input.startTicks as number) < 0) {
    issues.push({ path: `${path}.startTicks`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!Number.isSafeInteger(input.durationTicks) || (input.durationTicks as number) < 0) {
    issues.push({ path: `${path}.durationTicks`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!isCleanText(input.label, MAX_MARKER_LABEL_LENGTH, false)) {
    issues.push({ path: `${path}.label`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!isCleanText(input.note, MAX_MARKER_NOTE_LENGTH, true)) {
    issues.push({ path: `${path}.note`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!isMarkerColor(input.color)) {
    issues.push({ path: `${path}.color`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (issues.length !== before) return null
  return Object.freeze({
    markerId: input.markerId as string,
    startTicks: input.startTicks as number,
    durationTicks: input.durationTicks as number,
    label: input.label as string,
    note: input.note as string,
    color: input.color as MarkerColor,
  })
}

/**
 * The stored order of markers.
 *
 * Sorted by when they happen, and by id when two share a moment so the order is
 * never left to chance. A stable order means the same set of markers always
 * produces the same stored operation, which is what makes replaying history
 * produce the same file.
 */
export const sortMarkers = (
  markers: readonly TimelineMarkerV1[],
): readonly TimelineMarkerV1[] =>
  Object.freeze(
    markers.slice().sort((left, right) =>
      left.startTicks !== right.startTicks
        ? left.startTicks - right.startTicks
        : left.markerId < right.markerId ? -1 : left.markerId > right.markerId ? 1 : 0,
    ),
  )

export const validateSetTimelineMarkersOperation = (
  input: unknown,
  path = '$',
): Result<SetTimelineMarkersOperation, MarkersOperationError> => {
  if (!isRecord(input)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  if (input.kind !== MARKERS_OPERATION_KIND) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.kind`, code: 'OPERATION_KIND_UNKNOWN' }] })
  }

  const issues: { path: string; code: MarkersIssueCode }[] = []
  for (const key of KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!KEYS.includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  }
  if (input.schemaVersion !== OPERATION_SCHEMA_VERSION) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)) {
    issues.push({ path: `${path}.operationId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.capabilityId !== 'string' || !capabilityProduces(input.capabilityId, MARKERS_OPERATION_KIND)) {
    issues.push({ path: `${path}.capabilityId`, code: 'CAPABILITY_UNKNOWN' })
  }

  const markers: TimelineMarkerV1[] = []
  if (!Array.isArray(input.markers)) {
    issues.push({ path: `${path}.markers`, code: 'TYPE_INVALID' })
  } else if (input.markers.length > MAX_MARKERS) {
    issues.push({ path: `${path}.markers`, code: 'VALUE_OUT_OF_RANGE' })
  } else {
    const seen = new Set<string>()
    input.markers.forEach((candidate, index) => {
      const marker = validateMarker(candidate, `${path}.markers[${index}]`, issues)
      if (!marker) return
      // Two markers with one id would make "delete this marker" ambiguous, and
      // the user would watch the wrong note disappear.
      if (seen.has(marker.markerId)) {
        issues.push({ path: `${path}.markers[${index}].markerId`, code: 'DUPLICATE_ID' })
        return
      }
      seen.add(marker.markerId)
      markers.push(marker)
    })
  }

  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) issues.push({ path: `${path}.extensions`, code: 'VALUE_OUT_OF_RANGE' })

  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })

  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    kind: MARKERS_OPERATION_KIND,
    capabilityId: input.capabilityId as string,
    markers: sortMarkers(markers),
    extensions: extensions.ok ? extensions.value : emptyExtensions(),
  }))
}

/**
 * The markers a project has right now, after replaying every accepted change.
 *
 * A project that has never had a marker has no such operation in its history, so
 * this returns nothing at all — which is exactly how every project saved before
 * markers existed behaves. No stored project is rewritten.
 */
export const foldTimelineMarkerOperations = (
  operations: readonly SetTimelineMarkersOperation[],
): readonly TimelineMarkerV1[] =>
  operations.length === 0
    ? Object.freeze([])
    : sortMarkers(operations[operations.length - 1].markers)

/** The next marker at or after a moment, for "jump to the next one". */
export const markerAfter = (
  markers: readonly TimelineMarkerV1[],
  ticks: number,
): TimelineMarkerV1 | null =>
  sortMarkers(markers).find((marker) => marker.startTicks > ticks) ?? null

/** The last marker before a moment. Strictly before, so pressing it twice keeps moving. */
export const markerBefore = (
  markers: readonly TimelineMarkerV1[],
  ticks: number,
): TimelineMarkerV1 | null => {
  const earlier = sortMarkers(markers).filter((marker) => marker.startTicks < ticks)
  return earlier.length === 0 ? null : earlier[earlier.length - 1]
}

/**
 * Markers whose label or note contains what was typed.
 *
 * Case is ignored, because a user searching for "sponsor" means the one they
 * wrote as "Sponsor". An empty search returns everything rather than nothing:
 * clearing the box should show the list again, not empty it.
 */
export const searchMarkers = (
  markers: readonly TimelineMarkerV1[],
  query: string,
): readonly TimelineMarkerV1[] => {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return sortMarkers(markers)
  return Object.freeze(
    sortMarkers(markers).filter((marker) =>
      marker.label.toLowerCase().includes(needle) || marker.note.toLowerCase().includes(needle),
    ),
  )
}
