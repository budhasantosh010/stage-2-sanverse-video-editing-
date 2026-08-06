import { describe, expect, it } from 'vitest'

import { validateComposition, type Composition } from '@sanverse/edit-domain/composition'
import { NORMAL_PLAYBACK_RATE } from '@sanverse/edit-domain/clip-time'
import type { MediaAsset } from '@sanverse/edit-domain'

import {
  clipIsAtRate,
  isAtNormalSpeed,
  parseTypedSpeed,
  planRateStretch,
  planSpeedChange,
  previewRateStretch,
  previewSpeedChange,
  rateForTargetDuration,
  type SpeedPlanInput,
} from './timeline-speed-plan'

const S = 1_440_000
const time = (ticks: number) => ({ ticks, timescale: 1_440_000 as const })
const rate = (numerator: number, denominator: number) => ({ numerator, denominator })

const asset = Object.freeze({
  schemaVersion: 'sanverse.asset/v1',
  assetId: 'asset_plan0001',
  mediaKind: 'video',
  storageRef: 'project:plan/source',
  byteLength: 1_000_000,
  durationResidualSeconds: 0,
  width: 1920,
  height: 1080,
  duration: time(60 * S),
  frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
  hasAudio: true,
}) as unknown as MediaAsset

const clip = (clipId: string, sourceStart: number, sourceDuration: number, compositionStart: number) => ({
  clipId,
  assetId: asset.assetId,
  sourceRange: { start: time(sourceStart), duration: time(sourceDuration) },
  compositionStart: time(compositionStart),
  enabled: true,
  gainDb: 0,
  fadeIn: time(0),
  fadeOut: time(0),
})

const twoClips = (): Composition => {
  const built = validateComposition(
    {
      compositionId: 'composition_plan0001',
      width: 1920,
      height: 1080,
      tracks: [{
        trackId: 'track_plan0001',
        kind: 'video',
        order: 0,
        clips: [clip('clip_plan0001', 0, 10 * S, 0), clip('clip_plan0002', 10 * S, 10 * S, 10 * S)],
      }],
    },
    [asset],
  )
  if (!built.ok) throw new Error(`fixture invalid: ${JSON.stringify(built.error.issues)}`)
  return built.value
}

const longReverseClip = (): Composition => {
  const built = validateComposition(
    {
      compositionId: 'composition_planlong1',
      width: 1920,
      height: 1080,
      tracks: [{
        trackId: 'track_planlong1',
        kind: 'video',
        order: 0,
        clips: [clip('clip_planlong1', 0, 31 * S, 0)],
      }],
    },
    [asset],
  )
  if (!built.ok) throw new Error(`fixture invalid: ${JSON.stringify(built.error.issues)}`)
  return built.value
}

const input = (overrides: Partial<SpeedPlanInput> = {}): SpeedPlanInput => ({
  composition: twoClips(),
  clipId: 'clip_plan0001',
  rate: rate(2, 1),
  direction: 'forward',
  maintainAudioPitch: true,
  durationPolicy: 'ripple',
  lockedTrackIds: [],
  operationId: 'operation_planspeed01',
  ...overrides,
})

describe('planning a speed change', () => {
  it('produces exactly one operation, so one gesture is one Undo', () => {
    const plan = planSpeedChange(input())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.operations).toHaveLength(1)
    expect((plan.operations[0] as { kind: string }).kind).toBe('set-clip-time-transform')
  })

  it('says what will happen, in the numbers the ghost shows', () => {
    const plan = planSpeedChange(input())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.feedback.currentDurationTicks).toBe(10 * S)
    expect(plan.feedback.nextDurationTicks).toBe(5 * S)
    expect(plan.feedback.sourceDurationTicks).toBe(10 * S)
    expect(plan.feedback.rateLabel).toBe('2x')
    expect(plan.feedback.ripples).toBe(true)
    expect(plan.feedback.rippleShiftTicks).toBe(-5 * S)
  })

  it('reports a positive shift when the piece gets longer', () => {
    const plan = planSpeedChange(input({ rate: rate(1, 2) }))
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.feedback.nextDurationTicks).toBe(20 * S)
    expect(plan.feedback.rippleShiftTicks).toBe(10 * S)
  })

  it('reports no shift at all when the user chose not to push the rest along', () => {
    const plan = planSpeedChange(input({ durationPolicy: 'preserve-start' }))
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.feedback.ripples).toBe(false)
    expect(plan.feedback.rippleShiftTicks).toBe(0)
  })

  it('writes a plain sentence for the history list', () => {
    const faster = planSpeedChange(input())
    expect(faster.ok && faster.description).toBe('Changed a piece to 2x speed')
    const composition = twoClips()
    const back = planSpeedChange(input({
      composition,
      rate: NORMAL_PLAYBACK_RATE,
      maintainAudioPitch: false,
    }))
    expect(back.ok && back.description).toBe('Put a piece back to normal speed')
  })
})

describe('the refusals, in words the user can act on', () => {
  const refusalOf = (overrides: Partial<SpeedPlanInput>) => {
    const plan = planSpeedChange(input(overrides))
    expect(plan.ok).toBe(false)
    return plan.ok ? null : plan.refusal
  }

  it('says to pick something first', () => {
    expect(refusalOf({ clipId: null })?.code).toBe('NOTHING_PICKED')
  })

  it('says B-roll, pictures and music cannot be sped up yet', () => {
    const refusal = refusalOf({ clipId: 'clip_notthere1' })
    expect(refusal?.code).toBe('NOT_A_PIECE_OF_FOOTAGE')
    expect(refusal?.message).toContain('B-roll')
  })

  it('says which row is locked', () => {
    expect(refusalOf({ lockedTrackIds: ['track_plan0001'] })?.code).toBe('TRACK_LOCKED')
  })

  it('says nothing would change, rather than spending an Undo step on nothing', () => {
    expect(refusalOf({ rate: NORMAL_PLAYBACK_RATE })?.code).toBe('NO_CHANGE')
  })

  it('names the slowest and fastest it will go', () => {
    const tooSlow = refusalOf({ rate: rate(1, 20) })
    expect(tooSlow?.code).toBe('TOO_SLOW')
    expect(tooSlow?.message).toContain('0.1x')
    const tooFast = refusalOf({ rate: rate(20, 1) })
    expect(tooFast?.code).toBe('TOO_FAST')
    expect(tooFast?.message).toContain('16x')
  })

  it('refuses to run a piece into the next one, and says what to do instead', () => {
    const refusal = refusalOf({ rate: rate(1, 2), durationPolicy: 'preserve-start' })
    expect(refusal?.code).toBe('WOULD_COLLIDE')
    expect(refusal?.message).toContain('push the rest along')
  })

  it('accepts a bounded backwards clip through the same one-operation planner', () => {
    const plan = planSpeedChange(input({ direction: 'reverse' }))
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.operations).toHaveLength(1)
    expect(plan.operations[0]).toMatchObject({
      kind: 'set-clip-time-transform',
      direction: 'reverse',
    })
    expect(plan.description).toContain('backwards')
  })

  it('refuses a backwards span over thirty seconds and says to split it first', () => {
    const refusal = refusalOf({
      composition: longReverseClip(),
      clipId: 'clip_planlong1',
      direction: 'reverse',
    })
    expect(refusal?.code).toBe('REVERSE_TOO_LONG')
    expect(refusal?.message).toContain('thirty seconds')
    expect(refusal?.message).toContain('Split')
  })

  it('never mentions a field path, an operation name or a code', () => {
    for (const overrides of [
      { clipId: null },
      { clipId: 'clip_notthere1' },
      { lockedTrackIds: ['track_plan0001'] },
      { rate: NORMAL_PLAYBACK_RATE },
      { rate: rate(20, 1) },
      { composition: longReverseClip(), clipId: 'clip_planlong1', direction: 'reverse' as const },
    ]) {
      const message = refusalOf(overrides)?.message ?? ''
      expect(message, message).not.toMatch(/set-clip|operation_|\$\.|_INVALID|clipId/)
      expect(message.length, message).toBeGreaterThan(10)
    }
  })
})

describe('the ghost and the edit cannot disagree', () => {
  it('shows exactly the feedback the edit will produce', () => {
    const shared = input()
    const ghost = previewSpeedChange(shared)
    const committed = planSpeedChange(shared)
    expect(ghost.ok).toBe(true)
    expect(committed.ok).toBe(true)
    if (!ghost.ok || !committed.ok) return
    expect(ghost.feedback).toEqual(committed.feedback)
  })

  it('refuses with exactly the same words the edit would refuse with', () => {
    const shared = input({ rate: rate(1, 2), durationPolicy: 'preserve-start' })
    const ghost = previewSpeedChange(shared)
    const committed = planSpeedChange(shared)
    expect(ghost.ok).toBe(false)
    expect(committed.ok).toBe(false)
    if (ghost.ok || committed.ok) return
    expect(ghost.refusal).toEqual(committed.refusal)
  })
})

describe('dragging the end of a piece to choose its length', () => {
  const first = () => twoClips().tracks[0].clips[0]

  it('works the speed out backwards from the length asked for', () => {
    const fitted = rateForTargetDuration(first(), 5 * S)
    expect(fitted.ok).toBe(true)
    if (fitted.ok) expect(fitted.rate).toEqual(rate(2, 1))
  })

  it('handles a stretch as well as a squeeze', () => {
    const fitted = rateForTargetDuration(first(), 20 * S)
    expect(fitted.ok).toBe(true)
    if (fitted.ok) expect(fitted.rate).toEqual(rate(1, 2))
  })

  it('refuses a length of nothing', () => {
    expect(rateForTargetDuration(first(), 0).ok).toBe(false)
    expect(rateForTargetDuration(first(), -1).ok).toBe(false)
  })

  it('says which end of the range was passed', () => {
    const tooFast = rateForTargetDuration(first(), Math.floor(S / 2))
    expect(tooFast.ok).toBe(false)
    if (!tooFast.ok) expect(tooFast.refusal.code).toBe('TOO_FAST')
    const tooSlow = rateForTargetDuration(first(), 200 * S)
    expect(tooSlow.ok).toBe(false)
    if (!tooSlow.ok) expect(tooSlow.refusal.code).toBe('TOO_SLOW')
  })

  it('commits the same rational operation the speed panel would use', () => {
    const stretched = planRateStretch({
      ...input(),
      targetDurationTicks: 5 * S,
    })
    expect(stretched.ok).toBe(true)
    if (!stretched.ok) return
    expect(stretched.operations).toHaveLength(1)
    expect(stretched.feedback.rate).toEqual(rate(2, 1))
    expect(stretched.feedback.targetDurationTicks).toBe(5 * S)
    expect(stretched.feedback.approximationErrorTicks).toBe(0)
    expect(stretched.operations[0]).toMatchObject({
      kind: 'set-clip-time-transform',
      playbackRate: rate(2, 1),
    })
  })

  it('uses one planner for the pointer ghost and the committed edit', () => {
    const shared = { ...input(), targetDurationTicks: 7 * S }
    const ghost = previewRateStretch(shared)
    const edit = planRateStretch(shared)
    expect(ghost.ok).toBe(true)
    expect(edit.ok).toBe(true)
    if (!ghost.ok || !edit.ok) return
    expect(ghost.feedback).toEqual(edit.feedback)
  })

  it('returns no operation when the requested length is outside the supported speed range', () => {
    const refused = planRateStretch({
      ...input(),
      targetDurationTicks: 200 * S,
    })
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.refusal.code).toBe('TOO_SLOW')
  })
})

describe('typing a speed into the box', () => {
  it('takes the three ways people actually write one', () => {
    for (const [typed, expected] of [
      ['2', rate(2, 1)],
      ['2x', rate(2, 1)],
      ['200%', rate(2, 1)],
      ['0.5', rate(1, 2)],
      ['1.5x', rate(3, 2)],
      ['150%', rate(3, 2)],
      ['  0.25  ', rate(1, 4)],
    ] as const) {
      const parsed = parseTypedSpeed(typed)
      expect(parsed.ok, typed).toBe(true)
      if (parsed.ok) expect(parsed.rate, typed).toEqual(expected)
    }
  })

  it('lands a percentage and its decimal on the IDENTICAL fraction', () => {
    // Which is what stops "150%" and "1.5" producing two different exports of
    // the same video.
    const percentage = parseTypedSpeed('150%')
    const decimal = parseTypedSpeed('1.5')
    expect(percentage.ok && decimal.ok).toBe(true)
    if (percentage.ok && decimal.ok) expect(percentage.rate).toEqual(decimal.rate)
  })

  it('refuses words, nothing, and zero, and says what to type instead', () => {
    for (const typed of ['', '   ', 'fast', 'x', '0', '-2', 'NaN']) {
      const parsed = parseTypedSpeed(typed)
      expect(parsed.ok, typed).toBe(false)
      if (!parsed.ok) expect(parsed.refusal.message, typed).toMatch(/2, 0\.5, 1\.5x or 150%|slowest|fastest/)
    }
  })

  it('names the limit when the number is out of range', () => {
    const tooFast = parseTypedSpeed('50')
    expect(tooFast.ok).toBe(false)
    if (!tooFast.ok) expect(tooFast.refusal.code).toBe('TOO_FAST')
    const tooSlow = parseTypedSpeed('0.01')
    expect(tooSlow.ok).toBe(false)
    if (!tooSlow.ok) expect(tooSlow.refusal.code).toBe('TOO_SLOW')
  })
})

describe('reading a piece back', () => {
  it('knows an untouched piece is at normal speed', () => {
    const clipValue = twoClips().tracks[0].clips[0]
    expect(isAtNormalSpeed(clipValue)).toBe(true)
    expect(clipIsAtRate(clipValue, NORMAL_PLAYBACK_RATE)).toBe(true)
    expect(clipIsAtRate(clipValue, rate(2, 1))).toBe(false)
  })
})
