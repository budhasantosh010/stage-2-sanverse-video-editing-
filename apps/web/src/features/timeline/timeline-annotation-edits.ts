import {
  GROUPS_OPERATION_KIND,
  MARKERS_OPERATION_KIND,
  MAX_GROUPS,
  MAX_MARKERS,
  MAX_MARKER_LABEL_LENGTH,
  MAX_MARKER_NOTE_LENGTH,
  OPERATION_SCHEMA_VERSION,
  TIMELINE_GROUPS_PRIMITIVE_ID,
  TIMELINE_MARKERS_PRIMITIVE_ID,
  activeTimelineGroups,
  activeTimelineMarkers,
  groupForItem,
  validateOperation,
  type EditOperation,
  type EditProject,
  type MarkerColor,
  type TimelineGroupV1,
  type TimelineMarkerV1,
} from '@sanverse/edit-domain'

import type { TimelineItemPlanInput, TimelineItemRefusal, TimelineItemRefusalCode } from './timeline-item-operations'

/**
 * Turning what the user did into a marker or group operation.
 *
 * ## Every change sends the WHOLE list
 *
 * Adding one marker sends all the markers, with the new one in it. Deleting one
 * sends all the ones that are left. Same for groups.
 *
 * That looks wasteful and it is the right shape, for the same reason
 * `set-track-output` carries the whole answer for one track: the last operation
 * wins outright, so there is no way to end up in a state nobody chose, and Undo
 * restores the previous complete list rather than replaying a nudge backwards.
 *
 * ## Everything here is ONE operation, so one gesture is one Undo
 *
 * Dragging a marker two seconds later is one operation. Grouping four clips is
 * one operation. There is no version of these that produces two.
 */

export type AnnotationPlan =
  | Readonly<{ ok: true; operations: readonly EditOperation[]; description: string }>
  | Readonly<{ ok: false; refusal: TimelineItemRefusal }>

const refuse = (code: TimelineItemRefusalCode, message: string): AnnotationPlan =>
  Object.freeze({ ok: false, refusal: Object.freeze({ code, message }) })

const markersOperation = (
  markers: readonly TimelineMarkerV1[],
  operationId: string,
): EditOperation =>
  Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId,
    kind: MARKERS_OPERATION_KIND,
    capabilityId: TIMELINE_MARKERS_PRIMITIVE_ID,
    markers: Object.freeze(markers.map((marker) => Object.freeze({ ...marker }))),
    extensions: Object.freeze({}),
  }) as unknown as EditOperation

const groupsOperation = (
  groups: readonly TimelineGroupV1[],
  operationId: string,
): EditOperation =>
  Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId,
    kind: GROUPS_OPERATION_KIND,
    capabilityId: TIMELINE_GROUPS_PRIMITIVE_ID,
    groups: Object.freeze(groups.map((group) => Object.freeze({
      groupId: group.groupId,
      memberItemIds: Object.freeze([...group.memberItemIds]),
    }))),
    extensions: Object.freeze({}),
  }) as unknown as EditOperation

const finish = (operation: EditOperation, description: string): AnnotationPlan => {
  const validated = validateOperation(operation)
  if (!validated.ok) {
    // The refusal says what the user can do, never which field failed. A field
    // path is our vocabulary and tells them nothing they can act on.
    return refuse('OPERATION_UNSUPPORTED', 'Sanverse cannot record that. Nothing was changed.')
  }
  return Object.freeze({ ok: true, operations: Object.freeze([validated.value]), description })
}

/**
 * Text on its way into the project, tidied at the edge and only at the edge.
 *
 * The domain REFUSES control characters rather than removing them, which is
 * right: it must not quietly store something different from what it was given.
 * But a user typing into a box is not sending an operation — they are typing.
 * Tidying here, once, at the point where a person's typing becomes an edit, is
 * what stops a pasted line break turning into a refusal the user cannot explain.
 *
 * A newline is kept in a note and turned into a space in a label, because a
 * label is one line on a timeline.
 */
const cleanUserText = (value: string, maxLength: number, allowNewline: boolean): string => {
  let out = ''
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code === 0x0a) {
      out += allowNewline ? character : ' '
      continue
    }
    if (code < 0x20 || code === 0x7f) continue
    out += character
  }
  return out.slice(0, maxLength)
}

export type AnnotationPlanInput = Readonly<{
  project: EditProject
  pendingProposalExists: boolean
  exportInProgress: boolean
  expectedRevision: number
  ids: TimelineItemPlanInput['ids']
}>

const guard = (input: AnnotationPlanInput): AnnotationPlan | null => {
  if (input.project.revision !== input.expectedRevision) {
    return refuse('PROJECT_STALE', 'The project changed a moment ago. Try that again.')
  }
  if (input.pendingProposalExists) {
    return refuse('PROPOSAL_PENDING', 'Finish the suggestion on screen before changing the timeline.')
  }
  if (input.exportInProgress) {
    return refuse('EXPORT_IN_PROGRESS', 'Wait for the export to finish before changing the timeline.')
  }
  return null
}

/** Leave a note at a moment, or over a stretch. `durationTicks` of 0 is a point. */
export const planAddMarker = (input: AnnotationPlanInput & Readonly<{
  startTicks: number
  durationTicks?: number
  label: string
  note?: string
  color?: MarkerColor
}>): AnnotationPlan => {
  const blocked = guard(input)
  if (blocked) return blocked

  const existing = activeTimelineMarkers(input.project)
  if (existing.length >= MAX_MARKERS) {
    return refuse(
      'OUT_OF_RANGE',
      `There is room for ${MAX_MARKERS} notes on one video, and they are all used. Delete one to add another.`,
    )
  }

  const marker: TimelineMarkerV1 = Object.freeze({
    markerId: input.ids.entity('marker', existing.length),
    startTicks: Math.max(0, Math.round(input.startTicks)),
    durationTicks: Math.max(0, Math.round(input.durationTicks ?? 0)),
    label: cleanUserText(input.label, MAX_MARKER_LABEL_LENGTH, false),
    note: cleanUserText(input.note ?? '', MAX_MARKER_NOTE_LENGTH, true),
    color: input.color ?? 'neutral',
  })
  return finish(markersOperation([...existing, marker], input.ids.operation(0)), 'Leave a note')
}

/** Change what a note says, what colour it is, when it is, or how long it lasts. */
export const planUpdateMarker = (input: AnnotationPlanInput & Readonly<{
  markerId: string
  changes: Readonly<Partial<Pick<TimelineMarkerV1, 'startTicks' | 'durationTicks' | 'label' | 'note' | 'color'>>>
}>): AnnotationPlan => {
  const blocked = guard(input)
  if (blocked) return blocked

  const existing = activeTimelineMarkers(input.project)
  if (!existing.some((marker) => marker.markerId === input.markerId)) {
    return refuse('ITEM_UNKNOWN', 'That note is no longer on the timeline.')
  }

  const next = existing.map((marker) => marker.markerId !== input.markerId ? marker : Object.freeze({
    ...marker,
    ...(input.changes.startTicks === undefined
      ? {} : { startTicks: Math.max(0, Math.round(input.changes.startTicks)) }),
    ...(input.changes.durationTicks === undefined
      ? {} : { durationTicks: Math.max(0, Math.round(input.changes.durationTicks)) }),
    ...(input.changes.label === undefined
      ? {} : { label: cleanUserText(input.changes.label, MAX_MARKER_LABEL_LENGTH, false) }),
    ...(input.changes.note === undefined
      ? {} : { note: cleanUserText(input.changes.note, MAX_MARKER_NOTE_LENGTH, true) }),
    ...(input.changes.color === undefined ? {} : { color: input.changes.color }),
  }))

  const moved = input.changes.startTicks !== undefined || input.changes.durationTicks !== undefined
  return finish(markersOperation(next, input.ids.operation(0)), moved ? 'Move a note' : 'Change a note')
}

export const planDeleteMarker = (input: AnnotationPlanInput & Readonly<{
  markerId: string
}>): AnnotationPlan => {
  const blocked = guard(input)
  if (blocked) return blocked
  const existing = activeTimelineMarkers(input.project)
  const kept = existing.filter((marker) => marker.markerId !== input.markerId)
  if (kept.length === existing.length) {
    return refuse('ITEM_UNKNOWN', 'That note is no longer on the timeline.')
  }
  return finish(markersOperation(kept, input.ids.operation(0)), 'Delete a note')
}

/**
 * Make several things move together.
 *
 * Anything already in another group is taken out of that one first. A thing
 * cannot be in two groups — see `timeline-groups.ts` for why — and refusing here
 * would mean a user has to remember which of forty clips is already grouped
 * before they can group anything.
 */
export const planGroupItems = (input: AnnotationPlanInput & Readonly<{
  itemIds: readonly string[]
}>): AnnotationPlan => {
  const blocked = guard(input)
  if (blocked) return blocked

  const members = [...new Set(input.itemIds)].sort()
  if (members.length < 2) {
    return refuse('ITEM_UNKNOWN', 'Pick at least two things to make them move together.')
  }

  const existing = activeTimelineGroups(input.project)
  const trimmed = existing
    .map((group) => Object.freeze({
      groupId: group.groupId,
      memberItemIds: Object.freeze(group.memberItemIds.filter((id) => !members.includes(id))),
    }))
    // A group with fewer than two members left is not a group any more.
    .filter((group) => group.memberItemIds.length >= 2)

  if (trimmed.length >= MAX_GROUPS) {
    return refuse('OUT_OF_RANGE', `There is room for ${MAX_GROUPS} groups on one video, and they are all used.`)
  }

  const next: TimelineGroupV1 = Object.freeze({
    groupId: input.ids.entity('group', trimmed.length),
    memberItemIds: Object.freeze(members),
  })
  return finish(
    groupsOperation([...trimmed, next], input.ids.operation(0)),
    `Make ${members.length} things move together`,
  )
}

/** Stop the group this item belongs to from moving together. */
export const planUngroupItem = (input: AnnotationPlanInput & Readonly<{
  itemId: string
}>): AnnotationPlan => {
  const blocked = guard(input)
  if (blocked) return blocked

  const existing = activeTimelineGroups(input.project)
  const group = groupForItem(existing, input.itemId)
  if (!group) return refuse('ITEM_UNKNOWN', 'That is not part of a group.')

  return finish(
    groupsOperation(existing.filter((each) => each.groupId !== group.groupId), input.ids.operation(0)),
    'Stop them moving together',
  )
}

/**
 * Delete a whole group's worth of things.
 *
 * The group record goes too. Leaving it behind would keep a group naming three
 * clips that no longer exist — harmless, because stale names are ignored, but it
 * would build up invisible clutter in a file the user cannot see or clean.
 */
export const planRemoveGroupRecord = (input: AnnotationPlanInput & Readonly<{
  removedItemIds: readonly string[]
}>): AnnotationPlan | null => {
  const existing = activeTimelineGroups(input.project)
  if (existing.length === 0) return null

  const trimmed = existing
    .map((group) => Object.freeze({
      groupId: group.groupId,
      memberItemIds: Object.freeze(group.memberItemIds.filter((id) => !input.removedItemIds.includes(id))),
    }))
    .filter((group) => group.memberItemIds.length >= 2)

  const unchanged = trimmed.length === existing.length
    && trimmed.every((group, index) => group.memberItemIds.length === existing[index].memberItemIds.length)
  if (unchanged) return null

  const blocked = guard(input)
  if (blocked) return blocked
  return finish(groupsOperation(trimmed, input.ids.operation(0)), 'Tidy up an empty group')
}
