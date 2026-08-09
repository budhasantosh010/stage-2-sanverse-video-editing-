import { describe, expect, it } from 'vitest'
import {
  PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE,
  compareCreativeDirectionVersions,
  createCreativeDirectionVersion,
  restoreCreativeDirectionVersionContent,
} from './index.ts'

describe('Plan B0 creative-plan versions', () => {
  it('stores a frozen snapshot that survives later source-array changes', () => {
    const tracks = [...PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.tracks]
    const directives = [...PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.directives]
    const version = createCreativeDirectionVersion({ id: 'version:test', label: 'Test', sequence: 2, parentVersionId: 'version:product-launch-v1', reason: 'manual-save', summary: 'snapshot', tracks, directives })
    directives.pop()
    expect(version.directivesSnapshot).toHaveLength(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.directives.length)
    expect(Object.isFrozen(version.directivesSnapshot)).toBe(true)
  })

  it('compares added, removed and changed directive IDs', () => {
    const initial = PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.versions[0]!
    const changedDirectives = PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.directives
      .filter((directive) => directive.id !== 'note:simplify-middle')
      .map((directive) => directive.id === 'graphic:callback' && directive.kind === 'graphic' ? Object.freeze({ ...directive, communicationIntent: 'conversation-callback' }) : directive)
    const next = createCreativeDirectionVersion({ id: 'version:v2', label: 'V2', sequence: 2, parentVersionId: initial.id, reason: 'graphics-revision', summary: 'callback revision', tracks: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.tracks, directives: [...changedDirectives, Object.freeze({ ...PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.directives[2]!, id: 'graphic:new' })] })
    expect(compareCreativeDirectionVersions(initial, next)).toEqual({
      addedDirectiveIds: ['graphic:new'],
      removedDirectiveIds: ['note:simplify-middle'],
      changedDirectiveIds: ['graphic:callback'],
    })
  })

  it('restores version content without sharing mutable array identity', () => {
    const version = PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.versions[0]!
    const restored = restoreCreativeDirectionVersionContent(version)
    expect(restored.directives).toEqual(version.directivesSnapshot)
    expect(restored.directives).not.toBe(version.directivesSnapshot)
    expect(restored.tracks).not.toBe(version.tracksSnapshot)
  })
})
