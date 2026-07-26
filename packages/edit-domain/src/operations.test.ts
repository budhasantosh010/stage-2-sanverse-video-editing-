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

  it('keeps the pointing evidence separate from the visibility instruction', () => {
    const operation = validateOperation(
      testOperation({ sampledClipTime: ms(1_000), compositionInterval: { start: ms(9_000), duration: ms(2_000) } }),
    )
    // They are allowed to differ. In v1 nothing linked them and nothing
    // separated them either, so an AI could set one and mean the other.
    expect(operation).toMatchObject({ ok: true })
    if (!operation.ok) return
    expect(operation.value.sampledClipTime).toEqual(ms(1_000))
    expect(operation.value.compositionInterval.start).toEqual(ms(9_000))
  })
})

describe('nameplate operation against a real video', () => {
  it('refuses a nameplate that starts after the video ends', () => {
    // The exact defect found in v1: a nameplate at minute 83 of a 30-second
    // video passed every check, previewed, and persisted.
    const operation = validateOperation(
      testOperation({ compositionInterval: { start: ms(4_980_000), duration: ms(5_000) } }),
    )
    if (!operation.ok) throw new Error('setup failed')
    const result = validateOperationAgainstComposition(operation.value, composition)
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.error.issues[0].code).toBe('INTERVAL_OUTSIDE_COMPOSITION')
  })

  it('refuses a nameplate whose tail runs past the end of the video', () => {
    const operation = validateOperation(
      testOperation({ compositionInterval: { start: ms(28_000), duration: ms(5_000) } }),
    )
    if (!operation.ok) throw new Error('setup failed')
    expect(validateOperationAgainstComposition(operation.value, composition)).toMatchObject({ ok: false })
  })

  it('accepts a nameplate ending exactly at the last instant of the video', () => {
    const operation = validateOperation(
      testOperation({ compositionInterval: { start: ms(25_000), duration: ms(5_000) } }),
    )
    if (!operation.ok) throw new Error('setup failed')
    expect(validateOperationAgainstComposition(operation.value, composition)).toMatchObject({ ok: true })
  })

  it('refuses a sample taken outside the clip', () => {
    const operation = validateOperation(testOperation({ sampledClipTime: ms(30_000) }))
    if (!operation.ok) throw new Error('setup failed')
    const result = validateOperationAgainstComposition(operation.value, composition)
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.error.issues[0].code).toBe('SAMPLE_OUTSIDE_CLIP')
  })

  it('refuses an operation addressed to a clip that does not exist', () => {
    const operation = validateOperation(testOperation({ clipId: 'clip_zzzzzzzz' }))
    if (!operation.ok) throw new Error('setup failed')
    const result = validateOperationAgainstComposition(operation.value, composition)
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.error.issues[0].code).toBe('CLIP_UNKNOWN')
    expect(TEST_CLIP_ID).not.toBe('clip_zzzzzzzz')
  })
})
