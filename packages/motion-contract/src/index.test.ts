import { describe, expect, it } from 'vitest'
import { MOTION_ASPECT_RATIOS, MOTION_COMPONENT_CATEGORIES, MOTION_PERFORMANCE_CLASSES, motionValidationError, motionValidationOk } from './index.ts'

describe('motion contract closed sets', () => {
  it('keeps the approved ratio family closed', () => expect(MOTION_ASPECT_RATIOS).toEqual(['16:9','9:16','1:1','4:5']))
  it('keeps categories and performance classes explicit', () => {
    expect(MOTION_PERFORMANCE_CLASSES).toEqual(['light','medium','heavy'])
    expect(MOTION_COMPONENT_CATEGORIES).toHaveLength(13)
  })
  it('provides typed validation success and refusal shapes', () => {
    expect(motionValidationOk({ value: 1 })).toEqual({ ok: true, value: { value: 1 } })
    expect(motionValidationError({ path: '$.value', code: 'VALUE_INVALID', message: 'bad' })).toEqual({ ok: false, issues: [{ path: '$.value', code: 'VALUE_INVALID', message: 'bad' }] })
  })
})
