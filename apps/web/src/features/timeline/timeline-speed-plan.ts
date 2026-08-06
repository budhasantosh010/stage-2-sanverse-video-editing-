import {
  clipCompositionDurationTicks,
  findClip,
  type Clip,
  type Composition,
} from '@sanverse/edit-domain/composition'
import {
  DEFAULT_CLIP_TIME_TRANSFORM,
  FASTEST_PLAYBACK_RATE,
  NORMAL_PLAYBACK_RATE,
  SLOWEST_PLAYBACK_RATE,
  anchoredCompositionDuration,
  approximatePlaybackRate,
  clipTimeTransformsEqual,
  formatPlaybackRate,
  playbackRateToDecimal,
  playbackRatesEqual,
  rateThatFits,
  validatePlaybackRate,
  type ClipTimeTransformV1,
  type RationalPlaybackRateV1,
} from '@sanverse/edit-domain/clip-time'
import {
  OPERATION_SCHEMA_VERSION,
  validateOperation,
  type EditOperation,
} from '@sanverse/edit-domain'
import { CLIP_SPEED_COMPONENT_ID } from '@sanverse/edit-domain/capabilities'

/**
 * DECIDING A SPEED CHANGE — ONCE, FOR BOTH THE GHOST AND THE EDIT.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------------------------------------------------------
 *
 * While the mouse is down, the user sees a ghost: how long the piece will be,
 * what speed that works out to, and whether anything is in the way. When the
 * mouse comes up, an edit is made.
 *
 * If those two answers come from two pieces of code, they WILL disagree — not
 * on the first day, but on the day somebody fixes one and not the other. The
 * user then drags to a length the ghost says is fine and gets a refusal, or
 * worse, gets a different length from the one they saw.
 *
 * So there is one function, `planSpeedChange`, and the ghost is literally its
 * answer with the operation left off. That is the same arrangement the
 * multi-item planner uses, for the same reason.
 */

/** Which speeds a piece may be given. Copied here only for the messages. */
export const SLOWEST_LABEL = formatPlaybackRate(SLOWEST_PLAYBACK_RATE)
export const FASTEST_LABEL = formatPlaybackRate(FASTEST_PLAYBACK_RATE)

export type SpeedRefusalCode =
  | 'NOTHING_PICKED'
  | 'NOT_A_PIECE_OF_FOOTAGE'
  | 'TRACK_LOCKED'
  | 'NO_CHANGE'
  | 'TOO_SLOW'
  | 'TOO_FAST'
  | 'RATE_INVALID'
  | 'WOULD_COLLIDE'
  | 'TARGET_LENGTH_INVALID'
  | 'REVERSE_NOT_READY'

export type SpeedRefusal = Readonly<{
  code: SpeedRefusalCode
  /** One sentence the user reads. No codes, no jargon, no operation names. */
  message: string
}>

/** What the ghost shows while the mouse is down, and what the edit will do. */
export type SpeedFeedback = Readonly<{
  clipId: string
  /** How long the piece is on screen now. */
  currentDurationTicks: number
  /** How long it will be on screen afterwards. */
  nextDurationTicks: number
  /** How much recording it uses. Unchanged by a speed change. */
  sourceDurationTicks: number
  rate: RationalPlaybackRateV1
  /** "2x", "0.5x" — the same words that will end up on the badge. */
  rateLabel: string
  /** How much later everything after it will sit. Negative means earlier. */
  rippleShiftTicks: number
  /** True when this change moves later pieces. */
  ripples: boolean
}>

export type SpeedPlan =
  | Readonly<{
      ok: true
      feedback: SpeedFeedback
      operations: readonly EditOperation[]
      /** One plain sentence for the history list and for the status line. */
      description: string
    }>
  | Readonly<{ ok: false; refusal: SpeedRefusal }>

export type SpeedPlanInput = Readonly<{
  composition: Composition
  /** The clip the user picked, or null when they picked something that is not footage. */
  clipId: string | null
  rate: RationalPlaybackRateV1
  direction: 'forward' | 'reverse'
  maintainAudioPitch: boolean
  durationPolicy: 'ripple' | 'preserve-start'
  /** Tracks the user has padlocked. */
  lockedTrackIds: readonly string[]
  /** Must match `operation_[a-z0-9]{8,64}`. The caller owns identity. */
  operationId: string
}>

const refuse = (code: SpeedRefusalCode, message: string): SpeedPlan =>
  Object.freeze({ ok: false as const, refusal: Object.freeze({ code, message }) })

const trackOf = (composition: Composition, clipId: string) =>
  composition.tracks.find((track) => track.clips.some((clip) => clip.clipId === clipId))

/**
 * Everything on the same track that this piece could run into, in order.
 *
 * Only the same track: a piece of the main video getting longer cannot collide
 * with music, because they are on different rows and are allowed to overlap by
 * design.
 */
const neighboursAfter = (composition: Composition, clip: Clip): readonly Clip[] => {
  const track = trackOf(composition, clip.clipId)
  if (!track) return Object.freeze([])
  return Object.freeze(
    track.clips
      .filter((candidate) => candidate.clipId !== clip.clipId)
      .filter((candidate) => candidate.compositionStart.ticks >= clip.compositionStart.ticks)
      .sort((left, right) => left.compositionStart.ticks - right.compositionStart.ticks),
  )
}

/**
 * The one decision. Everything else in this file is a thin wrapper on it.
 *
 * Returns either a complete change set ready to send, together with exactly
 * what the ghost should say, or a refusal in one plain sentence.
 */
export const planSpeedChange = (input: SpeedPlanInput): SpeedPlan => {
  if (input.clipId === null) {
    return refuse('NOTHING_PICKED', 'Pick a piece of the main video first, then choose a speed.')
  }
  const clip = findClip(input.composition, input.clipId)
  if (!clip) {
    return refuse(
      'NOT_A_PIECE_OF_FOOTAGE',
      'Speed works on pieces of the main video. B-roll, pictures and music cannot be sped up yet.',
    )
  }
  const track = trackOf(input.composition, clip.clipId)
  if (track && input.lockedTrackIds.includes(track.trackId)) {
    return refuse('TRACK_LOCKED', 'That row is locked. Unlock it and try again.')
  }

  const checkedRate = validatePlaybackRate(input.rate)
  if (!checkedRate.ok) {
    if (checkedRate.error.issue === 'RATE_TOO_SLOW') {
      return refuse('TOO_SLOW', `The slowest this can go is ${SLOWEST_LABEL}.`)
    }
    if (checkedRate.error.issue === 'RATE_TOO_FAST') {
      return refuse('TOO_FAST', `The fastest this can go is ${FASTEST_LABEL}.`)
    }
    return refuse('RATE_INVALID', 'That speed cannot be used.')
  }
  const rate = checkedRate.value

  if (input.direction === 'reverse') {
    // Stated plainly rather than accepted and then quietly shown forwards.
    // The preview has one video player and a browser will not run a file
    // backwards, so until a prepared backwards copy exists the honest answer
    // is that this is not ready.
    return refuse(
      'REVERSE_NOT_READY',
      'Playing a piece backwards is not ready yet. It needs a backwards copy of the footage, which is being built.',
    )
  }

  const nextTransform: ClipTimeTransformV1 = Object.freeze({
    playbackRate: rate,
    direction: input.direction,
    maintainAudioPitch: input.maintainAudioPitch,
  })
  if (clipTimeTransformsEqual(clip.timeTransform, nextTransform)) {
    return refuse('NO_CHANGE', 'That piece is already set that way.')
  }

  const currentDurationTicks = clipCompositionDurationTicks(clip)
  const nextDurationTicks = anchoredCompositionDuration(
    clip.sourceRange.start.ticks,
    clip.sourceRange.duration.ticks,
    rate,
  )
  const shift = nextDurationTicks - currentDurationTicks

  if (input.durationPolicy === 'preserve-start' && shift > 0) {
    // Growing in place. The very next piece is the only thing that can be in
    // the way, because the track is already known not to overlap.
    const [next] = neighboursAfter(input.composition, clip)
    if (next && clip.compositionStart.ticks + nextDurationTicks > next.compositionStart.ticks) {
      return refuse(
        'WOULD_COLLIDE',
        'Slowing this down would run it into the next piece. Choose "push the rest along", or move the next piece first.',
      )
    }
  }

  const operation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId,
    kind: 'set-clip-time-transform' as const,
    capabilityId: CLIP_SPEED_COMPONENT_ID,
    clipId: clip.clipId,
    playbackRate: rate,
    direction: input.direction,
    maintainAudioPitch: input.maintainAudioPitch,
    durationPolicy: input.durationPolicy,
    extensions: Object.freeze({}),
  })
  const validated = validateOperation(operation)
  if (!validated.ok) {
    // Says what the user can do about it, never which field failed. A field
    // path is our vocabulary and tells them nothing they can act on.
    return refuse('RATE_INVALID', 'Sanverse cannot record that speed. Nothing was changed.')
  }

  const rateLabel = formatPlaybackRate(rate)
  return Object.freeze({
    ok: true as const,
    operations: Object.freeze([validated.value]),
    description: playbackRatesEqual(rate, NORMAL_PLAYBACK_RATE)
      ? 'Put a piece back to normal speed'
      : `Changed a piece to ${rateLabel} speed`,
    feedback: Object.freeze({
      clipId: clip.clipId,
      currentDurationTicks,
      nextDurationTicks,
      sourceDurationTicks: clip.sourceRange.duration.ticks,
      rate,
      rateLabel,
      rippleShiftTicks: input.durationPolicy === 'ripple' ? shift : 0,
      ripples: input.durationPolicy === 'ripple' && shift !== 0,
    }),
  })
}

/**
 * What the ghost says, and nothing else.
 *
 * Literally the planner's own answer with the operation dropped, so the two
 * cannot drift. Two tests assert that the ghost and the committed edit report
 * the identical feedback and the identical refusal.
 */
export const previewSpeedChange = (
  input: SpeedPlanInput,
): Readonly<{ ok: true; feedback: SpeedFeedback }> | Readonly<{ ok: false; refusal: SpeedRefusal }> => {
  const plan = planSpeedChange(input)
  return plan.ok
    ? Object.freeze({ ok: true as const, feedback: plan.feedback })
    : Object.freeze({ ok: false as const, refusal: plan.refusal })
}

/**
 * RATE STRETCH — dragging the end of a piece to choose how long it should be,
 * and letting the speed fall out of that.
 *
 * The user is not choosing a speed here; they are choosing a LENGTH. "Make
 * this fit the gap" is the thought. The speed is worked backwards from the two
 * lengths, and shown before the mouse comes up so nothing is a surprise.
 *
 * `rateThatFits` gives the exact fraction where one exists and the closest
 * fraction with small enough numbers where it does not. The maximum size of
 * those numbers is 10,000, and the worst error that can leave is under one
 * part in a million — under four milliseconds on a one-hour piece.
 */
export const rateForTargetDuration = (
  clip: Clip,
  targetCompositionTicks: number,
): Readonly<{ ok: true; rate: RationalPlaybackRateV1 }> | Readonly<{ ok: false; refusal: SpeedRefusal }> => {
  if (!Number.isSafeInteger(targetCompositionTicks) || targetCompositionTicks <= 0) {
    return Object.freeze({
      ok: false as const,
      refusal: Object.freeze({
        code: 'TARGET_LENGTH_INVALID' as const,
        message: 'A piece has to be longer than nothing.',
      }),
    })
  }
  const fitted = rateThatFits(clip.sourceRange.duration.ticks, targetCompositionTicks)
  // `rateThatFits` refuses out-of-range speeds itself, so its reason is passed
  // straight through rather than flattened into "that cannot be reached". The
  // user dragging too far needs to know WHICH way they went too far.
  const checked = fitted.ok ? validatePlaybackRate(fitted.value) : fitted
  if (!checked.ok) {
    if (checked.error.issue === 'RATE_TOO_SLOW') {
      return Object.freeze({
        ok: false as const,
        refusal: Object.freeze({
          code: 'TOO_SLOW' as const,
          message: `That would be slower than ${SLOWEST_LABEL}, which is as slow as this goes.`,
        }),
      })
    }
    if (checked.error.issue === 'RATE_TOO_FAST') {
      return Object.freeze({
        ok: false as const,
        refusal: Object.freeze({
          code: 'TOO_FAST' as const,
          message: `That would be faster than ${FASTEST_LABEL}, which is as fast as this goes.`,
        }),
      })
    }
    return Object.freeze({
      ok: false as const,
      refusal: Object.freeze({ code: 'RATE_INVALID' as const, message: 'That length cannot be reached.' }),
    })
  }
  return Object.freeze({ ok: true as const, rate: checked.value })
}

/**
 * Turn something a person typed — "1.5", "150%", "2x" — into a fraction.
 *
 * Accepts the three ways people actually write a speed and refuses everything
 * else rather than guessing. A percentage is divided by a hundred first, which
 * is why "150%" and "1.5" land on the identical fraction and therefore the
 * identical export.
 */
export const parseTypedSpeed = (
  typed: string,
): Readonly<{ ok: true; rate: RationalPlaybackRateV1; exact: boolean }> | Readonly<{ ok: false; refusal: SpeedRefusal }> => {
  const cleaned = typed.trim().toLowerCase()
  const asPercentage = cleaned.endsWith('%')
  const withoutSuffix = asPercentage ? cleaned.slice(0, -1) : cleaned.endsWith('x') ? cleaned.slice(0, -1) : cleaned
  const value = Number(withoutSuffix.trim())
  if (!Number.isFinite(value) || value <= 0) {
    return Object.freeze({
      ok: false as const,
      refusal: Object.freeze({
        code: 'RATE_INVALID' as const,
        message: 'Type a speed like 2, 0.5, 1.5x or 150%.',
      }),
    })
  }
  const decimal = asPercentage ? value / 100 : value
  if (decimal < playbackRateToDecimal(SLOWEST_PLAYBACK_RATE)) {
    return Object.freeze({
      ok: false as const,
      refusal: Object.freeze({ code: 'TOO_SLOW' as const, message: `The slowest this can go is ${SLOWEST_LABEL}.` }),
    })
  }
  if (decimal > playbackRateToDecimal(FASTEST_PLAYBACK_RATE)) {
    return Object.freeze({
      ok: false as const,
      refusal: Object.freeze({ code: 'TOO_FAST' as const, message: `The fastest this can go is ${FASTEST_LABEL}.` }),
    })
  }
  const approximated = approximatePlaybackRate(decimal)
  if (!approximated.ok) {
    return Object.freeze({
      ok: false as const,
      refusal: Object.freeze({ code: 'RATE_INVALID' as const, message: 'Type a speed like 2, 0.5, 1.5x or 150%.' }),
    })
  }
  return Object.freeze({
    ok: true as const,
    rate: approximated.value.rate,
    exact: approximated.value.exact,
  })
}

/** True when this piece is already at normal speed, forwards, pitch kept. */
export const isAtNormalSpeed = (clip: Clip): boolean =>
  clipTimeTransformsEqual(clip.timeTransform, DEFAULT_CLIP_TIME_TRANSFORM)

/** True when the given rate is the one this piece already has. */
export const clipIsAtRate = (clip: Clip, rate: RationalPlaybackRateV1): boolean =>
  playbackRatesEqual(clip.timeTransform.playbackRate, rate)

export { NORMAL_PLAYBACK_RATE }
