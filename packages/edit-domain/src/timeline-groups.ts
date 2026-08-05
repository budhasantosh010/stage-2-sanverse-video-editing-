import { err, isRecord, ok, type Result } from './result.ts'
import { capabilityProduces } from './capabilities.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import { OPERATION_SCHEMA_VERSION } from './timeline-operations.ts'

/**
 * Groups — "treat these things as one thing".
 *
 * A user puts a piece of B-roll, the music that goes under it and the title over
 * it into a group. From then on, clicking any one of them picks all three, and
 * moving them moves them together, keeping their spacing.
 *
 * ## What a group is NOT
 *
 * It is not a container. Nothing is put inside anything. The clips stay exactly
 * where they are, on the tracks they were already on, and each one is still an
 * ordinary clip that the export handles exactly as before.
 *
 *      A GROUP IS JUST A LIST OF NAMES
 *
 *      group_a1b2c3d4  ──►  [ overlay:broll_77:0 , music:music_31:0 ]
 *                            these two items are already on the timeline;
 *                            the group only records that they belong together
 *
 * That is what makes groups safe. A container would change the shape of a saved
 * project and force every reader — the compiler, the preview, the exporter — to
 * learn about it. A list of names changes nothing: a reader that has never heard
 * of groups produces the identical video.
 *
 * ## Why this is part of the project and not a browser setting
 *
 * Same reason as markers. Grouping is a decision the user made about their own
 * work. Losing it when they open the project on a different computer would be
 * losing work. So it is an accepted, undoable operation.
 *
 * And like markers, it does not appear in the render plan, so it does not change
 * the export key. Grouping three clips does not make the video be built again.
 * See the long note at the top of `timeline-markers.ts` for how that works.
 *
 * ## Membership is by presentation id, and that is deliberate
 *
 * The names stored are the ids the Timeline uses on screen — `overlay:broll_x:0`,
 * `music:music_y:0`, `clip:clip_z`. Not the underlying overlay ids.
 *
 * The alternative was to store domain ids and work out the on-screen pieces
 * every time. That sounds tidier and is worse: one B-roll clip cut in half shows
 * as two rectangles, and a user who grouped only the second half means the second
 * half. Storing the on-screen name records what they actually pointed at.
 *
 * The cost, stated plainly: an item that disappears leaves its name in the group.
 * That is handled by IGNORING names that are no longer on the timeline rather
 * than by refusing to open the project — see `resolveGroupMembers`. A group that
 * ends up with one member left is still a group; it just no longer does anything
 * until something joins it.
 */

export const GROUPS_OPERATION_KIND = 'set-timeline-groups'

export const GROUP_ID_PATTERN = /^group_[a-z0-9]{8,64}$/

/** At most this many groups. Far past the point where a person could keep track. */
export const MAX_GROUPS = 100
/** At most this many items in one group. */
export const MAX_GROUP_MEMBERS = 200
/** The longest a presentation id may be. Generous; the real ones are ~30 characters. */
export const MAX_MEMBER_ID_LENGTH = 128

export type TimelineGroupV1 = Readonly<{
  groupId: string
  /** Timeline presentation ids, sorted, with no repeats. At least two. */
  memberItemIds: readonly string[]
}>

export type SetTimelineGroupsOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: typeof GROUPS_OPERATION_KIND
  capabilityId: string
  /** The complete set of groups. Never a change to the previous set. */
  groups: readonly TimelineGroupV1[]
  extensions: Extensions
}>

const KEYS = Object.freeze([
  'schemaVersion',
  'operationId',
  'kind',
  'capabilityId',
  'groups',
  'extensions',
])

const GROUP_KEYS = Object.freeze(['groupId', 'memberItemIds'])

export type GroupsIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'DUPLICATE_ID'
  | 'MEMBER_IN_TWO_GROUPS'
  | 'OPERATION_KIND_UNKNOWN'
  | 'CAPABILITY_UNKNOWN'

export type GroupsOperationError = {
  readonly code: 'OPERATION_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: GroupsIssueCode }[]
}

const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/

/**
 * A timeline presentation id, as a plain safe string.
 *
 * Deliberately narrow: letters, digits, underscore, hyphen and colon only. A
 * group member name is stored in the project and later matched against ids on
 * screen; letting arbitrary text in would mean whatever a future id format
 * allowed would silently become allowed here too.
 */
const MEMBER_ID_PATTERN = /^[A-Za-z0-9_:-]{1,128}$/

const validateGroup = (
  input: unknown,
  path: string,
  issues: { path: string; code: GroupsIssueCode }[],
): TimelineGroupV1 | null => {
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  const before = issues.length
  for (const key of GROUP_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!GROUP_KEYS.includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  }
  if (typeof input.groupId !== 'string' || !GROUP_ID_PATTERN.test(input.groupId)) {
    issues.push({ path: `${path}.groupId`, code: 'VALUE_OUT_OF_RANGE' })
  }

  const members: string[] = []
  if (!Array.isArray(input.memberItemIds)) {
    issues.push({ path: `${path}.memberItemIds`, code: 'TYPE_INVALID' })
  } else if (input.memberItemIds.length < 2 || input.memberItemIds.length > MAX_GROUP_MEMBERS) {
    // A group of one is not a group. Allowing it would put an invisible,
    // unremovable state on a clip that behaves exactly like an ungrouped one.
    issues.push({ path: `${path}.memberItemIds`, code: 'VALUE_OUT_OF_RANGE' })
  } else {
    const seen = new Set<string>()
    input.memberItemIds.forEach((candidate, index) => {
      if (typeof candidate !== 'string' || candidate.length > MAX_MEMBER_ID_LENGTH || !MEMBER_ID_PATTERN.test(candidate)) {
        issues.push({ path: `${path}.memberItemIds[${index}]`, code: 'VALUE_OUT_OF_RANGE' })
        return
      }
      if (seen.has(candidate)) {
        issues.push({ path: `${path}.memberItemIds[${index}]`, code: 'DUPLICATE_ID' })
        return
      }
      seen.add(candidate)
      members.push(candidate)
    })
  }

  if (issues.length !== before) return null
  return Object.freeze({
    groupId: input.groupId as string,
    memberItemIds: Object.freeze(members.slice().sort()),
  })
}

export const validateSetTimelineGroupsOperation = (
  input: unknown,
  path = '$',
): Result<SetTimelineGroupsOperation, GroupsOperationError> => {
  if (!isRecord(input)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  if (input.kind !== GROUPS_OPERATION_KIND) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.kind`, code: 'OPERATION_KIND_UNKNOWN' }] })
  }

  const issues: { path: string; code: GroupsIssueCode }[] = []
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
  if (typeof input.capabilityId !== 'string' || !capabilityProduces(input.capabilityId, GROUPS_OPERATION_KIND)) {
    issues.push({ path: `${path}.capabilityId`, code: 'CAPABILITY_UNKNOWN' })
  }

  const groups: TimelineGroupV1[] = []
  if (!Array.isArray(input.groups)) {
    issues.push({ path: `${path}.groups`, code: 'TYPE_INVALID' })
  } else if (input.groups.length > MAX_GROUPS) {
    issues.push({ path: `${path}.groups`, code: 'VALUE_OUT_OF_RANGE' })
  } else {
    const seenGroups = new Set<string>()
    // One item may belong to at most one group. Two groups sharing an item would
    // make "select the group" ambiguous, and a move would be planned twice for
    // the same clip — which is how a clip ends up moved by double the distance.
    const seenMembers = new Set<string>()
    input.groups.forEach((candidate, index) => {
      const group = validateGroup(candidate, `${path}.groups[${index}]`, issues)
      if (!group) return
      if (seenGroups.has(group.groupId)) {
        issues.push({ path: `${path}.groups[${index}].groupId`, code: 'DUPLICATE_ID' })
        return
      }
      const clash = group.memberItemIds.find((member) => seenMembers.has(member))
      if (clash !== undefined) {
        issues.push({ path: `${path}.groups[${index}].memberItemIds`, code: 'MEMBER_IN_TWO_GROUPS' })
        return
      }
      seenGroups.add(group.groupId)
      for (const member of group.memberItemIds) seenMembers.add(member)
      groups.push(group)
    })
  }

  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) issues.push({ path: `${path}.extensions`, code: 'VALUE_OUT_OF_RANGE' })

  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })

  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    kind: GROUPS_OPERATION_KIND,
    capabilityId: input.capabilityId as string,
    groups: Object.freeze(groups.slice().sort((left, right) =>
      left.groupId < right.groupId ? -1 : left.groupId > right.groupId ? 1 : 0,
    )),
    extensions: extensions.ok ? extensions.value : emptyExtensions(),
  }))
}

/** The groups a project has now. No operation in history means no groups at all. */
export const foldTimelineGroupOperations = (
  operations: readonly SetTimelineGroupsOperation[],
): readonly TimelineGroupV1[] =>
  operations.length === 0 ? Object.freeze([]) : operations[operations.length - 1].groups

/** The group an item belongs to, or null. */
export const groupForItem = (
  groups: readonly TimelineGroupV1[],
  itemId: string,
): TimelineGroupV1 | null =>
  groups.find((group) => group.memberItemIds.includes(itemId)) ?? null

/**
 * Everything that must move when this item moves — including the item itself.
 *
 * `existingItemIds` is what is actually on the timeline right now. Names that
 * are no longer there are dropped rather than refused: a project must always
 * open, and a group holding the name of a deleted clip is a stale note, not a
 * corruption.
 */
export const resolveGroupMembers = (
  groups: readonly TimelineGroupV1[],
  itemId: string,
  existingItemIds: readonly string[],
): readonly string[] => {
  const group = groupForItem(groups, itemId)
  if (!group) return Object.freeze([itemId])
  const alive = group.memberItemIds.filter((member) => existingItemIds.includes(member))
  return Object.freeze(alive.includes(itemId) ? alive : [itemId, ...alive])
}
