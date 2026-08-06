import type { RenderPlan } from '@sanverse/render-contract'

/**
 * TURNING SPEED, DIRECTION, PITCH AND LEFT/RIGHT INTO FFMPEG INSTRUCTIONS.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SEPARATE FILE
 * ---------------------------------------------------------------------------
 *
 * Everything here is a pure function: a piece of the plan goes in, a list of
 * text instructions comes out. Nothing here starts a process, touches a file,
 * or knows what an export is. That means every one of these decisions can be
 * checked by a test that reads the resulting text, instead of by exporting a
 * video and squinting at it.
 *
 * ---------------------------------------------------------------------------
 * THE THREE THINGS SPEED CHANGES
 * ---------------------------------------------------------------------------
 *
 *   1. WHICH PART OF THE RECORDING IS TAKEN.
 *      Before speed, a piece three seconds long on the timeline took three
 *      seconds of recording. Now a three-second piece at 2x takes SIX. The
 *      exporter used to work the second number out from the first, and that
 *      is exactly the sum that stops being true.
 *
 *   2. HOW FAST THE PICTURE IS REPLAYED.
 *      FFmpeg calls a frame's moment its "presentation timestamp". Halving
 *      every timestamp makes the picture play twice as fast. That is the
 *      `setpts` instruction below.
 *
 *   3. HOW FAST THE SOUND IS REPLAYED, AND WHETHER IT GOES SQUEAKY.
 *      Two completely different instructions, chosen by one switch — see
 *      `audioSpeedSteps`.
 */

type Segment = RenderPlan['segments'][number]

/** Emitted decimals are fixed-precision so the same plan always writes the same text. */
const decimal = (value: number): string => {
  const rounded = Number(value.toFixed(9))
  return String(rounded)
}

/**
 * How much RECORDING this piece uses.
 *
 * A plan that says nothing about speed means the piece uses exactly as much
 * recording as it occupies on screen — which is what every plan meant before
 * speed existed, and what every untouched piece still means.
 */
export const segmentSourceDurationTicks = (segment: Segment): number =>
  typeof segment.sourceDurationTicks === 'number' && segment.sourceDurationTicks > 0
    ? segment.sourceDurationTicks
    : segment.interval.duration.ticks

/** The speed as a fraction. Absent means normal. */
export const segmentRate = (segment: Segment): { numerator: number; denominator: number } => {
  const numerator = segment.playbackRateNumerator
  const denominator = segment.playbackRateDenominator
  if (typeof numerator !== 'number' || typeof denominator !== 'number' || numerator <= 0 || denominator <= 0) {
    return { numerator: 1, denominator: 1 }
  }
  return { numerator, denominator }
}

export const segmentIsReversed = (segment: Segment): boolean => segment.direction === 'reverse'

export const segmentKeepsPitch = (segment: Segment): boolean => segment.maintainAudioPitch !== false

export const segmentIsRetimed = (segment: Segment): boolean => {
  const rate = segmentRate(segment)
  return rate.numerator !== rate.denominator || segmentIsReversed(segment)
}

/**
 * THE PICTURE.
 *
 * `setpts` rewrites every frame's moment. The multiplier is the ratio of how
 * long the piece lasts ON SCREEN to how much RECORDING it uses — which is the
 * speed fraction turned upside down.
 *
 *   2x   uses 2 ticks of recording per screen tick   ->  setpts = 0.5 * PTS
 *   0.5x uses half a tick per screen tick            ->  setpts = 2   * PTS
 *
 * `reverse` plays the frames back to front. It has to hold the whole piece in
 * memory to do that, which is why reversal is capped and why the preview uses
 * a prepared file rather than doing it live — see `MAX_REVERSE_TICKS`.
 *
 * The order matters and is not arbitrary: reverse FIRST, then change the
 * speed. Reversing a stream whose timestamps have already been stretched
 * would reverse the stretched version, and the last frame would land at the
 * wrong moment.
 */
export const videoSpeedSteps = (segment: Segment): readonly string[] => {
  const steps: string[] = []
  if (segmentIsReversed(segment)) steps.push('reverse')
  const rate = segmentRate(segment)
  if (rate.numerator !== rate.denominator) {
    steps.push(`setpts=${decimal(rate.denominator / rate.numerator)}*PTS`)
  }
  return Object.freeze(steps)
}

/**
 * The most recording one reversed piece may use: two minutes.
 *
 * Reversing means holding every frame of the piece at once. Two minutes of
 * 1080p is already a few gigabytes of decoded frames. Above this the answer is
 * a plain refusal rather than a machine that stops responding, because a
 * refusal the user can read is better than an export that never finishes.
 */
export const MAX_REVERSE_TICKS = 1_440_000 * 120

/**
 * THE SOUND, AT A DIFFERENT SPEED.
 *
 * There are two honestly different things a person can mean by "play this
 * faster", and this product does whichever one they picked rather than
 * guessing:
 *
 *   KEEP THE PITCH (the default, `maintainAudioPitch: true`)
 *     A voice at 2x sounds like someone talking quickly. It does NOT go
 *     squeaky. This is what a viewer expects and what nearly every use of
 *     speed wants. FFmpeg's `atempo` does it: it chops the sound into small
 *     grains and drops or repeats them, leaving the pitch alone.
 *
 *     `atempo` only accepts a factor between 0.5 and 2.0 in one step, so
 *     anything outside that is built as a CHAIN whose factors multiply to
 *     exactly the speed asked for. 4x becomes 2.0 x 2.0. 0.1x becomes
 *     0.5 x 0.5 x 0.4. The chain is built the same way every time, so the
 *     same project always produces the same instructions and therefore the
 *     same file.
 *
 *   LET IT GO SQUEAKY (`maintainAudioPitch: false`)
 *     The tape-recorder effect: faster also means higher, slower also means
 *     lower. Done by lying to FFmpeg about the recording's sample rate and
 *     then resampling back, which is exactly what speeding up a record does.
 *     Creators genuinely want this, so it is offered rather than prevented.
 *
 * WHAT IS GIVEN UP by keeping the pitch: `atempo` is a real effect on the
 * sound, and at extreme speeds it can add a faint fluttering. That is the
 * price of not sounding like a chipmunk, and it is the same price every other
 * editor pays.
 */
export const audioSpeedSteps = (segment: Segment, sampleRate: number): readonly string[] => {
  const steps: string[] = []
  if (segmentIsReversed(segment)) steps.push('areverse')
  const rate = segmentRate(segment)
  if (rate.numerator === rate.denominator) return Object.freeze(steps)

  if (!segmentKeepsPitch(segment)) {
    // Faster AND higher. `asetrate` claims the recording was made at a
    // different sample rate; `aresample` puts it back to the rate everything
    // else in this export uses, so `concat` still joins cleanly.
    const claimedRate = Math.round((sampleRate * rate.numerator) / rate.denominator)
    steps.push(`asetrate=${claimedRate}`)
    steps.push(`aresample=${sampleRate}`)
    return Object.freeze(steps)
  }

  for (const factor of atempoChain(rate.numerator, rate.denominator)) {
    steps.push(`atempo=${decimal(factor)}`)
  }
  return Object.freeze(steps)
}

/**
 * Break a speed into factors `atempo` will each accept, multiplying to the
 * whole.
 *
 * Halve or double as many times as needed, then finish with whatever is left.
 * Built from the fraction rather than from a running decimal, so no error can
 * creep in across the steps.
 */
export const atempoChain = (numerator: number, denominator: number): readonly number[] => {
  const factors: number[] = []
  let n = numerator
  let d = denominator
  // Too fast: peel off doublings until what remains is at most 2x.
  while (n > 2 * d) {
    factors.push(2)
    d *= 2
  }
  // Too slow: peel off halvings until what remains is at least 0.5x.
  while (2 * n < d) {
    factors.push(0.5)
    n *= 2
  }
  const remainder = n / d
  // A remainder of exactly 1 happens when the speed was a clean power of two,
  // and `atempo=1` is a filter that does nothing, so it is left out.
  if (Math.abs(remainder - 1) > 1e-12) factors.push(remainder)
  return Object.freeze(factors)
}

/**
 * LEFT AND RIGHT.
 *
 * `pan` is a whole number from -10000 (hard left) through 0 (centred) to
 * +10000 (hard right).
 *
 * The law used is "constant power": as the sound moves left, the left speaker
 * rises along a curve rather than a straight line, and the right one falls
 * along the mirror image, so the TOTAL loudness stays the same all the way
 * across. A straight line would make anything centred sound about 3 decibels
 * quieter than the same thing hard left, which listeners hear as the sound
 * ducking as it passes the middle.
 *
 *   position   left gain   right gain
 *   ---------  ---------   ----------
 *   -10000     1.000       0.000
 *        0     0.707       0.707        (0.707 = one over the square root of 2)
 *   +10000     0.000       1.000
 *
 * WHAT IS SUPPORTED AND WHAT IS NOT, stated plainly:
 *   - A recording with one channel is spread into two and then positioned.
 *   - A recording with two channels is positioned as a pair.
 *   - Anything with more channels than two is mixed down to two by FFmpeg's
 *     own standard rules FIRST — every export already forces two channels
 *     before this point — so surround recordings are not silently mangled
 *     here; they were already made two-channel upstream.
 */
export const panFilter = (pan: number): string | null => {
  if (!Number.isFinite(pan) || pan === 0) return null
  const clamped = Math.max(-10_000, Math.min(10_000, Math.round(pan)))
  // 0 at hard left, a quarter turn at hard right.
  const angle = ((clamped + 10_000) / 20_000) * (Math.PI / 2)
  const left = Math.cos(angle)
  const right = Math.sin(angle)
  return `pan=stereo|c0=${decimal(left)}*c0|c1=${decimal(right)}*c1`
}

/**
 * The colour a transition fades through. Absent means black, which is what
 * every project made before white existed already did.
 */
export const segmentTransitionColor = (segment: Segment): 'black' | 'white' =>
  segment.transitionColor === 'white' ? 'white' : 'black'
