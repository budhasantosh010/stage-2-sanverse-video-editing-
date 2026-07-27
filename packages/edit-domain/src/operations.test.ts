import { describe, expect, it } from 'vitest'

import { NAMEPLATE_PRIMITIVE_ID } from './capabilities'
import {
  MAX_PRIMARY_TEXT_LENGTH,
  validateOperation,
  validateOperationAgainstComposition,
} from './operations'
import { TEST_CLIP_ID, ms, testOperation, testProject } from './test-fixtures'

const composition = testProject().composition

describe('nameplate operation structure', () => {
  it('accepts a well-formed operation', () => {
    expect(validateOperation(testOperation())).toMatchObject({ ok: true })
  })

  it('refuses an unknown executable kind loudly instead of skipping it', () => {
    // Skipping an edit it does not understand would mean exporting a video the
    // user never approved and then saving that loss over their project.
    const result = validateOperation({ ...testOperation(), kind: 'apply-lut' })
    expect(result).toEqual({
      ok: false,
      error: { code: 'OPERATION_INVALID', issues: [{ path: '$.kind', code: 'OPERATION_KIND_UNKNOWN' }] },
    })
  })

  it('refuses an unknown field rather than dropping it', () => {
    expect(validateOperation({ ...testOperation(), speed: 2 })).toMatchObject({ ok: false })
  })

  it('refuses a capability that cannot produce this operation kind', () => {
    expect(validateOperation({ ...testOperation(), capabilityId: 'sanverse.caption/v1' })).toMatchObject({ ok: false })
    expect(validateOperation({ ...testOperation(), capabilityId: NAMEPLATE_PRIMITIVE_ID })).toMatchObject({ ok: true })
  })

  it('bounds text length in the domain, not only in the renderer', () => {
    // v1 enforced this only inside FFmpeg, so an oversized nameplate was
    // accepted, previewed, and saved, and failed only at export.
    const tooLong = 'x'.repeat(MAX_PRIMARY_TEXT_LENGTH + 1)
    expect(validateOperation(testOperation({ primaryText: tooLong }))).toMatchObject({ ok: false })
    expect(validateOperation(testOperation({ primaryText: '   ' }))).toMatchObject({ ok: false })
  })

  it('anchors visibility to the footage, not to the finished video', () => {
    const operation = validateOperation(
      testOperation({ sourceInterval: { start: ms(9_000), duration: ms(2_000) } }),
    )
    expect(operation).toMatchObject({ ok: true })
    if (!operation.ok || operation.value.kind !== 'add-nameplate') return
    expect(operation.value.sourceInterval.start).toEqual(ms(9_000))
    // The field that used to hold a finished-video time is gone entirely, so
    // no caller can accidentally keep writing one.
    expect(Object.keys(operation.value)).not.toContain('compositionInterval')
  })
})

describe('nameplate operation against a real video', () => {
  it('refuses a nameplate anchored past the end of the footage', () => {
    // The exact defect found in v1: a nameplate at minute 83 of a 30-second
    // video passed every check, previewed, and persisted.
    const operation = validateOperation(
      testOperation({ sourceInterval: { start: ms(4_980_000), duration: ms(5_000) } }),
    )
    if (!operation.ok) throw new Error('setup failed')
    const result = validateOperationAgainstComposition(operation.value, composition)
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.error.issues[0].code).toBe('SOURCE_SPAN_REMOVED')
  })

  it('keeps the part of a nameplate that overlaps footage that is still present', () => {
    // A nameplate running past the end is trimmed to what survives rather than
    // refused outright, because the user can see the part that does show.
    const operation = validateOperation(
      testOperation({ sourceInterval: { start: ms(28_000), duration: ms(5_000) } }),
    )
    if (!operation.ok) throw new Error('setup failed')
    expect(validateOperationAgainstComposition(operation.value, composition)).toMatchObject({ ok: true })
  })

  it('accepts a nameplate ending exactly at the last instant of the video', () => {
    const operation = validateOperation(
      testOperation({ sourceInterval: { start: ms(25_000), duration: ms(5_000) } }),
    )
    if (!operation.ok) throw new Error('setup failed')
    expect(validateOperationAgainstComposition(operation.value, composition)).toMatchObject({ ok: true })
  })

  it('refuses a nameplate anchored to footage this project does not use', () => {
    const operation = validateOperation(testOperation({ assetId: 'asset_zzzzzzzz' }))
    if (!operation.ok) throw new Error('setup failed')
    const result = validateOperationAgainstComposition(operation.value, composition)
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.error.issues[0].code).toBe('ASSET_NOT_IN_COMPOSITION')
    expect(TEST_CLIP_ID).not.toBe('clip_zzzzzzzz')
  })
})
