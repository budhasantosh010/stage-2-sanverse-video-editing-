import { describe, expect, it } from 'vitest'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import {
  PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE,
  applyCreativeDirectionOperation,
  createCreativeDirective,
} from './index.ts'

const t = (seconds: number) => seconds * PROJECT_TIMESCALE
const apply = (document: typeof PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, operation: Parameters<typeof applyCreativeDirectionOperation>[1]) => {
  const result = applyCreativeDirectionOperation(document, operation)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error.message)
  return result.document
}

describe('Plan B0 Creative Direction exact-tick region operations', () => {
  it('adds and selects a valid exact-tick region by stable ID', () => {
    const directive = createCreativeDirective('note', { id: 'note:new', startTicks: t(10), endTicks: t(11) })
    const document = apply(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, { operationId: 'add', type: 'add-directive', directive })
    expect(document.directives.find((entry) => entry.id === 'note:new')).toMatchObject({ startTicks: t(10), endTicks: t(11), track: 'NOTES' })
  })

  it('moves a region by an exact tick delta without changing its duration', () => {
    const source = PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.directives.find((entry) => entry.id === 'graphic:floating-prompt')!
    const document = apply(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, { operationId: 'move', type: 'move-directive', directiveId: source.id, deltaTicks: t(2) })
    const moved = document.directives.find((entry) => entry.id === source.id)!
    expect(moved.startTicks).toBe(source.startTicks + t(2))
    expect(moved.endTicks - moved.startTicks).toBe(source.endTicks - source.startTicks)
  })

  it('resizes start and end independently in exact ticks', () => {
    let document = apply(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, { operationId: 'resize-start', type: 'resize-directive', directiveId: 'graphic:floating-prompt', edge: 'start', tick: t(20) })
    document = apply(document as typeof PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, { operationId: 'resize-end', type: 'resize-directive', directiveId: 'graphic:floating-prompt', edge: 'end', tick: t(29) })
    expect(document.directives.find((entry) => entry.id === 'graphic:floating-prompt')).toMatchObject({ startTicks: t(20), endTicks: t(29) })
  })

  it('duplicates a region with a new stable ID and offset', () => {
    const document = apply(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, { operationId: 'duplicate', type: 'duplicate-directive', directiveId: 'graphic:callback', duplicateId: 'graphic:callback-copy', offsetTicks: -t(10) })
    expect(document.directives.find((entry) => entry.id === 'graphic:callback-copy')).toMatchObject({ startTicks: t(75), endTicks: t(81) })
  })

  it('changes directive type while preserving ID, source, priority and region', () => {
    const source = PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.directives.find((entry) => entry.id === 'note:simplify-middle')!
    const document = apply(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, { operationId: 'kind', type: 'change-directive-kind', directiveId: source.id, kind: 'motion' })
    const changed = document.directives.find((entry) => entry.id === source.id)!
    expect(changed).toMatchObject({ kind: 'motion', track: 'MOTION', startTicks: source.startTicks, endTicks: source.endTicks, source: source.source, priority: source.priority })
  })

  it('replaces semantic properties without changing stable identity', () => {
    const source = PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.directives.find((entry) => entry.id === 'graphic:workflow-demo')!
    if (source.kind !== 'graphic') throw new Error('fixture mismatch')
    const replacement = Object.freeze({ ...source, communicationIntent: 'product-ui-story-simplified' })
    const document = apply(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, { operationId: 'replace', type: 'replace-directive', directiveId: source.id, directive: replacement })
    expect(document.directives.find((entry) => entry.id === source.id)).toMatchObject({ id: source.id, communicationIntent: 'product-ui-story-simplified' })
  })

  it('deletes a directive and prunes comments that directly reference it', () => {
    const document = apply(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, { operationId: 'remove', type: 'remove-directive', directiveId: 'graphic:workflow-demo' })
    expect(document.directives.some((entry) => entry.id === 'graphic:workflow-demo')).toBe(false)
    expect(document.comments.some((comment) => comment.target.kind === 'directive' && comment.target.directiveId === 'graphic:workflow-demo')).toBe(false)
  })

  it('fails atomically when a move exits document bounds', () => {
    const result = applyCreativeDirectionOperation(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, { operationId: 'bad-move', type: 'move-directive', directiveId: 'graphic:brand-lockup', deltaTicks: t(2) })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RESULT_INVALID')
    expect(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.directives.find((entry) => entry.id === 'graphic:brand-lockup')).toMatchObject({ startTicks: t(91), endTicks: t(95) })
  })

  it('rejects duplicate IDs instead of silently renaming them', () => {
    const result = applyCreativeDirectionOperation(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, { operationId: 'dupe', type: 'duplicate-directive', directiveId: 'graphic:callback', duplicateId: 'graphic:brand-lockup', offsetTicks: 0 })
    expect(result).toMatchObject({ ok: false, error: { code: 'DUPLICATE_ID' } })
  })
})
