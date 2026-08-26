import { describe, expect, it } from 'vitest'
import {
  BACKGROUND_TREATMENTS_V1,
  CREATIVE_LOCK_SCOPES_V1,
  LIBRARY_SCOPES_V1,
  MOTION_PRESENTATION_MODES_V1,
  SOURCE_TREATMENTS_V1,
  validateCreativeTickRangeV1,
} from './creative-engine.ts'

describe('Closed-Loop V1 shared vocabulary', () => {
  it('keeps the owner-approved presentation/treatment/lock taxonomies closed', () => {
    expect(MOTION_PRESENTATION_MODES_V1).toEqual(['overlay','split','picture-in-picture','full-screen-motion','tracked-attached','surface-embedded','subject-environment','bridge-takeover'])
    expect(SOURCE_TREATMENTS_V1).toEqual(['normal','dim','blur','reframe','mask','subject-only','hidden'])
    expect(BACKGROUND_TREATMENTS_V1).toEqual(['source-video','solid','gradient','image','video','graphical','procedural','transparent'])
    expect(LIBRARY_SCOPES_V1).toEqual(['sanverse','external','generated','project'])
    expect(CREATIVE_LOCK_SCOPES_V1).toEqual(['content','style','storyboard','animatic','motion'])
  })

  it('validates exact-tick ranges without inventing another clock', () => {
    expect(validateCreativeTickRangeV1({ startTick: 0, endTick: 1 })).toEqual({ ok: true, value: { startTick: 0, endTick: 1 } })
    expect(validateCreativeTickRangeV1({ startTick: 3, endTick: 3 })).toMatchObject({ ok: false, refusal: { code: 'INVALID_TICK_RANGE' } })
    expect(validateCreativeTickRangeV1({ startTick: 0.5, endTick: 2 })).toMatchObject({ ok: false, refusal: { code: 'INVALID_TICK_RANGE' } })
  })
})
