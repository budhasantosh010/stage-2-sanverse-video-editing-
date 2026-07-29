import { describe, expect, it } from 'vitest'
import {
  acceptChangeSet,
  type EditOperation,
  type EditProject,
} from '@sanverse/edit-domain'
import {
  testChangeSet,
  testOperation,
  testProject,
  testSetAudio,
  testSplit,
  testTitle,
} from '@sanverse/edit-domain/test-fixtures'

import { buildAssistChangeItems } from './assist-change-model'

function accept(project: EditProject, changeSetId: string, operations: readonly EditOperation[]) {
  const result = acceptChangeSet(project, {
    ...testChangeSet({ changeSetId, baseRevision: project.revision }),
    operations,
  })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('buildAssistChangeItems', () => {
  it('returns no changes for a fresh project', () => {
    expect(buildAssistChangeItems({ project: testProject(), proposal: null })).toEqual([])
  })

  it('preserves accepted operation order and derives trustworthy timing', () => {
    const project = accept(testProject(), 'changeset_assist01', [
      testSplit(),
      testSetAudio(),
      testTitle(),
    ])

    const items = buildAssistChangeItems({ project, proposal: null })

    expect(items.map((item) => item.operationKind)).toEqual([
      'split-clip',
      'set-clip-audio',
      'add-title',
    ])
    expect(items[0]).toMatchObject({ status: 'accepted', seekTicks: 10 * 1_440_000 })
    expect(items[1]).toMatchObject({
      status: 'accepted',
      label: 'Sound: 6 dB quieter, faded in, faded out',
    })
    expect(items[2]).toMatchObject({ status: 'accepted', seekTicks: 0 })
  })

  it('appends one detached pending proposal without mutating either input', () => {
    const project = accept(testProject(), 'changeset_assist02', [testOperation()])
    const proposal = Object.freeze({
      operation: testOperation({
        operationId: 'operation_pending1',
        primaryText: 'Pending title',
      }),
      origin: Object.freeze({
        source: 'ai' as const,
        requestId: 'request_assist01',
        explanation: 'Shows a title.',
        note: null,
      }),
    })
    const projectBefore = JSON.stringify(project)
    const proposalBefore = JSON.stringify(proposal)

    const items = buildAssistChangeItems({ project, proposal })

    expect(items.map((item) => item.status)).toEqual(['accepted', 'pending'])
    expect(items.at(-1)).toMatchObject({
      changeSetId: null,
      operationId: 'operation_pending1',
      label: 'Pending title — Mathematician',
      seekTicks: 2 * 1_440_000,
    })
    expect(JSON.stringify(project)).toBe(projectBefore)
    expect(JSON.stringify(proposal)).toBe(proposalBefore)
  })

  it('keeps every operation in a blocked multi-operation record visible', () => {
    const project = accept(testProject(), 'changeset_assist03', [
      testOperation({ operationId: 'operation_blocked1' }),
      testTitle({ operationId: 'operation_blocked2' }),
    ])
    const blocked = {
      ...project,
      changeSets: project.changeSets.map((record) => ({
        ...record,
        blockedReason: 'SOURCE_SPAN_REMOVED',
      })),
    } as EditProject

    const items = buildAssistChangeItems({ project: blocked, proposal: null })

    expect(items).toHaveLength(2)
    expect(items.every((item) => item.status === 'blocked')).toBe(true)
    expect(items.every((item) => item.blockedReason === 'SOURCE_SPAN_REMOVED')).toBe(true)
  })
})
