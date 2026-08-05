import { describe, expect, it } from 'vitest'

import { TIMELINE_GROUPS_PRIMITIVE_ID, MUSIC_PRIMITIVE_ID } from './capabilities.ts'
import { validateOperation } from './operations.ts'
import {
  MAX_GROUPS,
  MAX_GROUP_MEMBERS,
  foldTimelineGroupOperations,
  groupForItem,
  resolveGroupMembers,
  validateSetTimelineGroupsOperation,
  type TimelineGroupV1,
} from './timeline-groups.ts'
import {
  acceptChangeSet,
  activeTimelineGroups,
  undoChangeSet,
  type EditProject,
} from './project.ts'
import { changeSetOf, testMultiAssetProject } from './test-fixtures.ts'

const setGroups = (
  groups: readonly Record<string, unknown>[],
  operationId = 'operation_group001',
): Record<string, unknown> => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'set-timeline-groups',
  capabilityId: TIMELINE_GROUPS_PRIMITIVE_ID,
  groups,
  extensions: {},
})

const accept = (
  project: EditProject,
  changeSetId: string,
  operations: readonly unknown[],
): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(changeSetId, project.revision, operations as never))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

describe('T1.6 groups — treat these as one thing', () => {
  it('accepts a group of two things already on the timeline', () => {
    const result = validateSetTimelineGroupsOperation(setGroups([
      { groupId: 'group_aaaaaaaa', memberItemIds: ['overlay:broll_77:0', 'music:music_31:0'] },
    ]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.groups[0].memberItemIds).toHaveLength(2)
  })

  it('refuses a group of one, because it would be an invisible state that does nothing', () => {
    const result = validateSetTimelineGroupsOperation(setGroups([
      { groupId: 'group_aaaaaaaa', memberItemIds: ['overlay:broll_77:0'] },
    ]))
    expect(result.ok).toBe(false)
  })

  it('refuses the same thing being in two groups at once', () => {
    // Two groups sharing an item makes "select the group" ambiguous, and a move
    // would be planned twice for one clip — which moves it double the distance.
    const result = validateSetTimelineGroupsOperation(setGroups([
      { groupId: 'group_aaaaaaaa', memberItemIds: ['overlay:broll_77:0', 'music:music_31:0'] },
      { groupId: 'group_bbbbbbbb', memberItemIds: ['overlay:broll_77:0', 'clip:clip_12ab34cd'] },
    ]))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'MEMBER_IN_TWO_GROUPS')).toBe(true)
  })

  it('refuses two groups with one identity', () => {
    const result = validateSetTimelineGroupsOperation(setGroups([
      { groupId: 'group_aaaaaaaa', memberItemIds: ['overlay:broll_77:0', 'music:music_31:0'] },
      { groupId: 'group_aaaaaaaa', memberItemIds: ['clip:clip_1', 'clip:clip_2'] },
    ]))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'DUPLICATE_ID')).toBe(true)
  })

  it('refuses the same thing listed twice inside one group', () => {
    const result = validateSetTimelineGroupsOperation(setGroups([
      { groupId: 'group_aaaaaaaa', memberItemIds: ['overlay:broll_77:0', 'overlay:broll_77:0'] },
    ]))
    expect(result.ok).toBe(false)
  })

  it('refuses a member name that is not a plain timeline identity', () => {
    // The stored name is later matched against ids on screen. Letting arbitrary
    // text in would mean whatever a future id format allows becomes allowed here
    // by accident.
    for (const bad of ['../etc/passwd', 'a b', 'overlay:<script>', '', 'x'.repeat(129), 7, null]) {
      const result = validateSetTimelineGroupsOperation(setGroups([
        { groupId: 'group_aaaaaaaa', memberItemIds: ['clip:clip_ok', bad] },
      ]))
      expect(result.ok).toBe(false)
    }
  })

  it('holds the stated limits on how many groups and how many members', () => {
    const tooMany = Array.from({ length: MAX_GROUPS + 1 }, (_unused, index) => ({
      groupId: `group_${String(index).padStart(8, '0')}`,
      memberItemIds: [`clip:clip_a${index}`, `clip:clip_b${index}`],
    }))
    expect(validateSetTimelineGroupsOperation(setGroups(tooMany)).ok).toBe(false)

    const bigGroup = Array.from({ length: MAX_GROUP_MEMBERS + 1 }, (_unused, index) => `clip:clip_${index}`)
    expect(validateSetTimelineGroupsOperation(setGroups([
      { groupId: 'group_aaaaaaaa', memberItemIds: bigGroup },
    ])).ok).toBe(false)
  })

  it('refuses an unknown key and a capability that does not produce groups', () => {
    expect(validateSetTimelineGroupsOperation({
      ...setGroups([{ groupId: 'group_aaaaaaaa', memberItemIds: ['clip:clip_1', 'clip:clip_2'] }]),
      colour: 'red',
    }).ok).toBe(false)
    expect(validateSetTimelineGroupsOperation({
      ...setGroups([{ groupId: 'group_aaaaaaaa', memberItemIds: ['clip:clip_1', 'clip:clip_2'] }]),
      capabilityId: MUSIC_PRIMITIVE_ID,
    }).ok).toBe(false)
  })

  it('stores members and groups in one settled order however they arrive', () => {
    const result = validateSetTimelineGroupsOperation(setGroups([
      { groupId: 'group_bbbbbbbb', memberItemIds: ['clip:clip_z', 'clip:clip_a'] },
      { groupId: 'group_aaaaaaaa', memberItemIds: ['clip:clip_m', 'clip:clip_b'] },
    ]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.groups.map((group) => group.groupId)).toEqual(['group_aaaaaaaa', 'group_bbbbbbbb'])
    expect(result.value.groups[1].memberItemIds).toEqual(['clip:clip_a', 'clip:clip_z'])
  })

  it('is reachable through the general operation validator', () => {
    const result = validateOperation(setGroups([
      { groupId: 'group_aaaaaaaa', memberItemIds: ['clip:clip_1', 'clip:clip_2'] },
    ]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.kind).toBe('set-timeline-groups')
  })
})

describe('T1.6 groups in a project', () => {
  it('gives every project that has never had a group exactly none', () => {
    expect(activeTimelineGroups(testMultiAssetProject())).toEqual([])
  })

  it('groups, then ungroups by sending the set without it, and Undo brings it back', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_group001', [setGroups([
      { groupId: 'group_aaaaaaaa', memberItemIds: ['overlay:broll_77:0', 'music:music_31:0'] },
    ])])
    expect(activeTimelineGroups(project)).toHaveLength(1)

    project = accept(project, 'changeset_group002', [setGroups([], 'operation_group002')])
    expect(activeTimelineGroups(project)).toHaveLength(0)

    const undone = undoChangeSet(project)
    if (!undone.ok) throw new Error('undo failed')
    expect(activeTimelineGroups(undone.value)).toHaveLength(1)
  })

  it('accepts a group naming a clip that is no longer there rather than refusing the edit', () => {
    // A stale note is not a corrupt project. Refusing here would make an
    // unrelated, perfectly good cut fail.
    const project = accept(testMultiAssetProject(), 'changeset_group001', [setGroups([
      { groupId: 'group_aaaaaaaa', memberItemIds: ['clip:clip_deleted1', 'clip:clip_deleted2'] },
    ])])
    expect(activeTimelineGroups(project)).toHaveLength(1)
  })
})

describe('T1.6 working out what moves together', () => {
  const groups: readonly TimelineGroupV1[] = Object.freeze([
    Object.freeze({
      groupId: 'group_aaaaaaaa',
      memberItemIds: Object.freeze(['clip:clip_a', 'music:music_b:0', 'overlay:broll_c:0']),
    }),
  ])

  it('returns just the item itself when it is in no group', () => {
    expect(resolveGroupMembers(groups, 'clip:clip_lonely', ['clip:clip_lonely'])).toEqual(['clip:clip_lonely'])
  })

  it('returns every living member when the item is grouped', () => {
    const alive = ['clip:clip_a', 'music:music_b:0', 'overlay:broll_c:0']
    expect(resolveGroupMembers(groups, 'clip:clip_a', alive)).toEqual(alive)
  })

  it('quietly drops members that are no longer on the timeline', () => {
    // The stated cost of storing on-screen names. A group holding the name of a
    // deleted clip is stale, not broken.
    expect(resolveGroupMembers(groups, 'clip:clip_a', ['clip:clip_a', 'music:music_b:0']))
      .toEqual(['clip:clip_a', 'music:music_b:0'])
  })

  it('always includes the item the user actually pointed at', () => {
    // Even if the group's own list has gone stale and no longer names it.
    expect(resolveGroupMembers(groups, 'clip:clip_a', ['music:music_b:0']))
      .toEqual(['clip:clip_a', 'music:music_b:0'])
  })

  it('finds the group an item belongs to, and null when it has none', () => {
    expect(groupForItem(groups, 'music:music_b:0')?.groupId).toBe('group_aaaaaaaa')
    expect(groupForItem(groups, 'clip:clip_elsewhere')).toBeNull()
  })

  it('folds an empty history to no groups at all', () => {
    expect(foldTimelineGroupOperations([])).toEqual([])
  })
})
