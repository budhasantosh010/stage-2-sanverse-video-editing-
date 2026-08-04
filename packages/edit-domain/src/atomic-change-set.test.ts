import { describe, expect, it } from 'vitest'

import {
  acceptChangeSet,
  acceptChangeSetAtomic,
  activeOperations,
  createIdFactory,
  effectiveComposition,
  evaluateProject,
  redoChangeSet,
  serializeProject,
  undoChangeSet,
  type EditProject,
} from './project.ts'
import {
  changeSetOf,
  ms,
  testMultiAssetProject,
  testOperation,
  testRemove,
  testSplit,
  testTitle,
  testTrim,
  TEST_CLIP_ID,
} from './test-fixtures.ts'

/**
 * Gate C0. One change set is one all-or-nothing step.
 *
 * The defect these tests exist for: a change set holding a valid cut AND an
 * invalid overlay used to have the cut applied to the footage while the change
 * set itself was reported as failed. The user saw an error message and a
 * changed video at the same time, and no Undo they pressed was the one they
 * wanted, because the project never recorded the cut as something that happened.
 */

const accepted = (project: EditProject, changeSet: unknown): EditProject => {
  const result = acceptChangeSet(project, changeSet)
  if (!result.ok) throw new Error(`expected acceptance: ${JSON.stringify(result.error)}`)
  return result.value
}

/** Total footage length in ticks — the single number a cut visibly changes. */
const footageTicks = (project: EditProject): number =>
  effectiveComposition(project).tracks[0].clips.reduce((total, clip) => total + clip.sourceRange.duration.ticks, 0)

/** A cut that really removes footage: drop the first second of the only clip. */
const validCut = () => testTrim({ operationId: 'operation_cut00001', trimStart: ms(1_000), trimEnd: ms(0) })

/**
 * A title pinned to source seconds 0-3. Any cut that removes source second 0
 * strands it, and the replay refuses it with SOURCE_SPAN_REMOVED.
 */
const titleOverEarlyFootage = () =>
  testTitle({ operationId: 'operation_title001', titleId: 'title_0001', sourceInterval: { start: ms(0), duration: ms(3_000) } })

/** An overlay that can never apply: it names an asset the project does not hold. */
const overlayOnMissingAsset = () =>
  testTitle({
    operationId: 'operation_title002',
    titleId: 'title_0002',
    assetId: 'asset_zzzzzzzz',
    sourceInterval: { start: ms(0), duration: ms(1_000) },
  })

describe('atomic compound change sets', () => {
  describe('A — a valid cut beside an invalid overlay applies neither', () => {
    it('leaves the footage exactly as long as it was', () => {
      const project = testMultiAssetProject()
      const before = footageTicks(project)

      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_mixed001', project.revision, [validCut(), overlayOnMissingAsset()]),
      )

      expect(result.status).toBe('blocked')
      expect(footageTicks(result.project)).toBe(before)
      expect(result.project).toBe(project)
    })

    it('names the operation that refused, not just "something failed"', () => {
      const project = testMultiAssetProject()
      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_mixed002', project.revision, [validCut(), overlayOnMissingAsset()]),
      )

      expect(result.status === 'blocked' && result.failedOperationIndex).toBe(1)
    })

    it('moves neither the revision nor the history', () => {
      const project = testMultiAssetProject()
      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_mixed003', project.revision, [validCut(), overlayOnMissingAsset()]),
      )

      expect(result.revision).toBe(project.revision)
      expect(result.project.changeSets).toHaveLength(project.changeSets.length)
      expect(result.project.issuedChangeSetIds).toEqual(project.issuedChangeSetIds)
    })
  })

  describe('B — an invalid cut beside a valid overlay applies neither', () => {
    it('adds no overlay when the cut cannot be made', () => {
      const project = testMultiAssetProject()
      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_mixed004', project.revision, [
          testRemove({ operationId: 'operation_gone0001', clipId: 'clip_zzzzzzzz' }),
          testTitle({ operationId: 'operation_title003', titleId: 'title_0003' }),
        ]),
      )

      expect(result.status).toBe('blocked')
      expect(activeOperations(result.project)).toHaveLength(0)
      expect(result.status === 'blocked' && result.failedOperationIndex).toBe(0)
    })
  })

  describe('C and D — an unknown operation or an unknown key applies nothing', () => {
    it('refuses the whole set for an unknown operation kind', () => {
      const project = testMultiAssetProject()
      const result = acceptChangeSetAtomic(project, {
        ...changeSetOf('changeset_mixed005', project.revision, [testOperation()]),
        operations: [testOperation(), { ...testOperation(), operationId: 'operation_bbbbbbbb', kind: 'teleport-clip' }],
      })

      expect(result.status).toBe('blocked')
      expect(activeOperations(result.project)).toHaveLength(0)
    })

    it('refuses the whole set for one unknown key on the second operation', () => {
      const project = testMultiAssetProject()
      const result = acceptChangeSetAtomic(project, {
        ...changeSetOf('changeset_mixed006', project.revision, [testOperation()]),
        operations: [
          testOperation(),
          { ...testOperation(), operationId: 'operation_bbbbbbbb', unknownField: 'not repaired, refused' },
        ],
      })

      expect(result.status).toBe('blocked')
      expect(activeOperations(result.project)).toHaveLength(0)
    })
  })

  describe('E and F — later operations see what earlier ones did', () => {
    it('accepts a split followed by an edit to the fragment the split created', () => {
      const project = testMultiAssetProject()
      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_seq00001', project.revision, [
          testSplit({ operationId: 'operation_split001', newClipId: 'clip_bbbbbbbb', atClipTime: ms(10_000) }),
          testRemove({ operationId: 'operation_remove01', clipId: 'clip_bbbbbbbb', ripple: true }),
        ]),
      )

      expect(result.status).toBe('accepted')
      // 30s of footage, split at 10s, the 20s tail removed.
      expect(footageTicks(result.project)).toBe(ms(10_000).ticks)
    })

    it('keeps the split when the operation that depends on it fails', () => {
      const project = testMultiAssetProject()
      const before = footageTicks(project)

      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_seq00002', project.revision, [
          testSplit({ operationId: 'operation_split001', newClipId: 'clip_bbbbbbbb', atClipTime: ms(10_000) }),
          testRemove({ operationId: 'operation_remove01', clipId: 'clip_cccccccc', ripple: true }),
        ]),
      )

      expect(result.status).toBe('blocked')
      expect(result.status === 'blocked' && result.failedOperationIndex).toBe(1)
      expect(footageTicks(result.project)).toBe(before)
      expect(effectiveComposition(result.project).tracks[0].clips).toHaveLength(1)
    })
  })

  describe('G to J — a refusal anywhere in the set retracts everything before it', () => {
    it('G — a failing second placement removes the first placement', () => {
      const project = testMultiAssetProject()
      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_link0001', project.revision, [
          testTitle({ operationId: 'operation_title004', titleId: 'title_0004' }),
          overlayOnMissingAsset(),
        ]),
      )

      expect(result.status).toBe('blocked')
      expect(activeOperations(result.project)).toHaveLength(0)
    })

    it('H — a ripple that succeeded is retracted when the placement after it fails', () => {
      const project = testMultiAssetProject()
      const before = footageTicks(project)

      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_ripple01', project.revision, [
          testTrim({ operationId: 'operation_ripple01', trimStart: ms(2_000), trimEnd: ms(0), ripple: true }),
          overlayOnMissingAsset(),
        ]),
      )

      expect(result.status).toBe('blocked')
      expect(footageTicks(result.project)).toBe(before)
    })

    it('I — fragments created earlier in the set leave the original clips untouched', () => {
      const project = testMultiAssetProject()
      const clipsBefore = effectiveComposition(project).tracks[0].clips

      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_frag0001', project.revision, [
          testSplit({ operationId: 'operation_split001', newClipId: 'clip_bbbbbbbb', atClipTime: ms(10_000) }),
          testSplit({ operationId: 'operation_split002', newClipId: 'clip_dddddddd', atClipTime: ms(5_000), clipId: 'clip_bbbbbbbb' }),
          overlayOnMissingAsset(),
        ]),
      )

      expect(result.status).toBe('blocked')
      expect(effectiveComposition(result.project).tracks[0].clips).toEqual(clipsBefore)
    })

    it('J — an already-accepted operation in the same set is not kept when a later one refuses', () => {
      const project = testMultiAssetProject()
      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_late00001', project.revision, [
          testOperation({ operationId: 'operation_ok000001' }),
          testRemove({ operationId: 'operation_gone0002', clipId: 'clip_zzzzzzzz' }),
        ]),
      )

      expect(result.status).toBe('blocked')
      expect(activeOperations(result.project)).toHaveLength(0)
    })
  })

  describe('K — a stale base revision changes nothing', () => {
    it('refuses without evaluating the operations', () => {
      const project = testMultiAssetProject()
      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_stale001', project.revision + 7, [validCut()]),
      )

      expect(result.status).toBe('blocked')
      expect(result.status === 'blocked' && (result.refusal as { code: string }).code).toBe('REVISION_CONFLICT')
      expect(result.project).toBe(project)
    })
  })

  describe('M and N — one accepted compound set is one revision and one Undo', () => {
    it('moves the revision exactly once for a two-operation set', () => {
      const project = testMultiAssetProject()
      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_two00001', project.revision, [
          validCut(),
          testTitle({ operationId: 'operation_title005', titleId: 'title_0005', sourceInterval: { start: ms(5_000), duration: ms(2_000) } }),
        ]),
      )

      expect(result.status).toBe('accepted')
      expect(result.revision).toBe(project.revision + 1)
      expect(result.project.changeSets).toHaveLength(1)
    })

    it('undoes both operations together and redoes both together', () => {
      const project = testMultiAssetProject()
      const before = footageTicks(project)
      const next = accepted(
        project,
        changeSetOf('changeset_two00002', project.revision, [
          validCut(),
          testTitle({ operationId: 'operation_title006', titleId: 'title_0006', sourceInterval: { start: ms(5_000), duration: ms(2_000) } }),
        ]),
      )

      expect(footageTicks(next)).toBe(before - ms(1_000).ticks)
      expect(activeOperations(next)).toHaveLength(2)

      const undone = undoChangeSet(next)
      expect(undone.ok).toBe(true)
      if (!undone.ok) return
      expect(footageTicks(undone.value)).toBe(before)
      expect(activeOperations(undone.value)).toHaveLength(0)

      const redone = redoChangeSet(undone.value)
      expect(redone.ok).toBe(true)
      if (!redone.ok) return
      expect(footageTicks(redone.value)).toBe(before - ms(1_000).ticks)
      expect(activeOperations(redone.value)).toHaveLength(2)
    })
  })

  describe('immutability — a refused request leaves the project byte for byte identical', () => {
    it('serializes to exactly the same bytes before and after a blocked evaluation', () => {
      const project = testMultiAssetProject()
      const before = serializeProject(project)
      expect(before.ok).toBe(true)

      acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_bytes001', project.revision, [validCut(), overlayOnMissingAsset()]),
      )

      const after = serializeProject(project)
      expect(after.ok && before.ok && after.value).toBe(before.ok ? before.value : '')
    })
  })

  describe('the retraction that makes this work', () => {
    it('does not leave a cut in the footage when its own change set is blocked', () => {
      // The exact shape of the defect: the cut is valid, the title is valid at
      // the moment it is written, and the cut is what strands the title.
      const project = testMultiAssetProject()
      const before = footageTicks(project)

      const result = acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_self0001', project.revision, [
          testTrim({ operationId: 'operation_cut00002', trimStart: ms(4_000), trimEnd: ms(0), ripple: true }),
          titleOverEarlyFootage(),
        ]),
      )

      expect(result.status).toBe('blocked')
      expect(footageTicks(result.project)).toBe(before)
    })

    it('retracts the cut of a change set blocked by a LATER edit', () => {
      // Accept a mixed set while it is valid, then make it invalid. The cut it
      // carried must leave the footage at the same moment the set is reported
      // blocked, or the two disagree.
      let project = testMultiAssetProject()
      const original = footageTicks(project)

      project = accepted(
        project,
        changeSetOf('changeset_first001', project.revision, [
          testTrim({ operationId: 'operation_cut00003', trimStart: ms(1_000), trimEnd: ms(0), ripple: true }),
          testTitle({ operationId: 'operation_title007', titleId: 'title_0007', sourceInterval: { start: ms(2_000), duration: ms(2_000) } }),
        ]),
      )
      expect(footageTicks(project)).toBe(original - ms(1_000).ticks)

      // A second cut removes the footage the first set's title sits on.
      project = accepted(
        project,
        changeSetOf('changeset_second01', project.revision, [
          testTrim({ operationId: 'operation_cut00004', trimStart: ms(4_000), trimEnd: ms(0), ripple: true, clipId: TEST_CLIP_ID }),
        ]),
      )

      const evaluation = evaluateProject(project)
      const firstRecord = evaluation.records[0]
      expect(firstRecord.blockedReason).not.toBeNull()

      // The blocked set's own 1-second cut must NOT still be in the footage.
      // Only the second set's 4-second cut may remain.
      expect(footageTicks(project)).toBe(original - ms(4_000).ticks)
      expect(activeOperations(project).some((operation) => operation.operationId === 'operation_cut00003')).toBe(false)
    })

    it('always agrees: what the footage is made of and what the operation list says', () => {
      let project = testMultiAssetProject()
      project = accepted(
        project,
        changeSetOf('changeset_agree001', project.revision, [
          testTrim({ operationId: 'operation_cut00005', trimStart: ms(1_000), trimEnd: ms(0), ripple: true }),
          testTitle({ operationId: 'operation_title008', titleId: 'title_0008', sourceInterval: { start: ms(2_000), duration: ms(1_000) } }),
        ]),
      )
      project = accepted(
        project,
        changeSetOf('changeset_agree002', project.revision, [
          testTrim({ operationId: 'operation_cut00006', trimStart: ms(6_000), trimEnd: ms(0), ripple: true, clipId: TEST_CLIP_ID }),
        ]),
      )

      const cutTicksInOperationList = activeOperations(project)
        .filter((operation) => operation.kind === 'trim-clip')
        .reduce((total, operation) => total + (operation as { trimStart: { ticks: number } }).trimStart.ticks, 0)
      const cutTicksInFootage = ms(30_000).ticks - footageTicks(project)

      expect(cutTicksInFootage).toBe(cutTicksInOperationList)
    })

    it('terminates on a project where every change set carries a cut', () => {
      let project = testMultiAssetProject()
      for (let index = 0; index < 5; index += 1) {
        project = accepted(
          project,
          changeSetOf(`changeset_loop0000${index}`, project.revision, [
            testTrim({ operationId: `operation_loop0000${index}`, trimStart: ms(500), trimEnd: ms(0), ripple: true, clipId: TEST_CLIP_ID }),
            testTitle({
              operationId: `operation_loopt000${index}`,
              titleId: `title_loop${index}`,
              sourceInterval: { start: ms(10_000 + index * 1_000), duration: ms(500) },
            }),
          ]),
        )
      }
      expect(evaluateProject(project).records).toHaveLength(5)
      expect(footageTicks(project)).toBe(ms(30_000).ticks - ms(2_500).ticks)
    })
  })

  describe('deterministic identities', () => {
    it('gives the same names for the same change set every time', () => {
      const first = createIdFactory('changeset_aaaaaaaa')
      const second = createIdFactory('changeset_aaaaaaaa')

      expect(first.operation(0)).toBe(second.operation(0))
      expect(first.entity('clip', 2)).toBe(second.entity('clip', 2))
    })

    it('gives different names to different change sets, slots and namespaces', () => {
      const first = createIdFactory('changeset_aaaaaaaa')
      const second = createIdFactory('changeset_bbbbbbbb')

      expect(first.operation(0)).not.toBe(second.operation(0))
      expect(first.operation(0)).not.toBe(first.operation(1))
      expect(first.entity('clip', 0)).not.toBe(first.entity('link', 0))
    })

    it('produces IDs the closed contracts accept', () => {
      const factory = createIdFactory('changeset_aaaaaaaa')
      expect(factory.operation(0)).toMatch(/^operation_[a-z0-9]{8,64}$/)
      expect(factory.entity('clip', 0)).toMatch(/^clip_[a-z0-9]{8,64}$/)
      expect(factory.entity('changeset', 0)).toMatch(/^changeset_[a-z0-9]{8,64}$/)
    })

    it('does not consume an ID when the draft is refused', () => {
      const project = testMultiAssetProject()
      const factory = createIdFactory('changeset_refused1')
      const first = factory.operation(0)

      acceptChangeSetAtomic(
        project,
        changeSetOf('changeset_refused1', project.revision, [
          { ...validCut(), operationId: first },
          overlayOnMissingAsset(),
        ]),
      )

      // The refused attempt is invisible: the same slot still yields the same
      // name, so a retry produces the identical change set rather than a second.
      expect(createIdFactory('changeset_refused1').operation(0)).toBe(first)
      expect(project.issuedChangeSetIds).not.toContain('changeset_refused1')
    })
  })
})
