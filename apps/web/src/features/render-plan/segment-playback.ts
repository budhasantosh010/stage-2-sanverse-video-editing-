import type { RenderPlan } from '@sanverse/render-contract'

/**
 * Playing a cut video from one untouched source file.
 *
 * The browser has exactly one `<video>` element holding the whole recording.
 * The finished video is a list of stretches of that recording, in an order that
 * may not match the recording's own. So the preview cannot simply press play:
 * it has to jump to the start of each stretch as the previous one ends, and
 * show black where a stretch was deliberately left empty.
 *
 * Every decision about that lives here as a pure function of numbers, with no
 * reference to the DOM, so it can be tested exhaustively. The screen only
 * carries the decisions out. Getting this wrong is not cosmetic: it makes the
 * preview show a different video from the export, which is the exact class of
 * failure that made a whole day's work worthless once before.
 */

export type PlaybackSegment = Readonly<{
  /** Where this stretch begins in the finished video. */
  startTicks: number
  durationTicks: number
  /** Where this stretch begins in the original recording. */
  sourceStartTicks: number
  /**
   * WHICH recording. The main sequence can hold more than one, and the single
   * `<video>` element has to be pointed at the right file before it can be
   * pointed at the right moment inside it.
   *
   * Still ONE element. Never one per clip: twenty clips would be twenty
   * decoders, twenty buffers, and a browser tab that runs out of memory on a
   * long video.
   */
  assetId: string
  /**
   * Whether the picture is drawn and the sound is heard, copied straight from
   * the plan the export also reads. The preview never decides this for itself:
   * a second opinion here is exactly how the screen and the file start
   * disagreeing.
   */
  videoEnabled: boolean
  audioEnabled: boolean
  /**
   * How much RECORDING this stretch uses.
   *
   * Until speed existed this was always the same number as `durationTicks`,
   * and the code below simply used one for both. A stretch at 2x lasts three
   * seconds on screen and uses six seconds of recording, so the two are now
   * carried separately and every sum says which one it means.
   *
   * OPTIONAL, and absent means "the same as `durationTicks`" - which is what
   * every stretch meant before speed existed, and what every stretch nobody
   * has retimed still means. Same reasoning as the render plan's own optional
   * retiming fields: a default that is exactly the old behaviour costs nobody
   * anything, and no existing caller had to change.
   */
  sourceDurationTicks?: number
  /** Speed as a fraction: recording ticks used per on-screen tick. Absent means 1/1. */
  rateNumerator?: number
  rateDenominator?: number
  /** Backwards playback. Absent means forwards. See `unpreviewableSegmentIndexes`. */
  reversed?: boolean
  /** Whether a sped-up voice keeps its normal pitch. Absent means yes. */
  maintainAudioPitch?: boolean
  /** True only for a v8 held-frame segment. Its source tick never advances. */
  freeze?: boolean
}>

/** How much recording a stretch uses. Absent means the same as its on-screen length. */
export const sourceSpanOf = (segment: PlaybackSegment): number =>
  typeof segment.sourceDurationTicks === 'number' && segment.sourceDurationTicks > 0
    ? segment.sourceDurationTicks
    : segment.durationTicks

/** The speed fraction of a stretch. Absent means normal. */
export const rateOf = (segment: PlaybackSegment): Readonly<{ numerator: number; denominator: number }> => {
  const numerator = segment.rateNumerator
  const denominator = segment.rateDenominator
  if (typeof numerator !== 'number' || typeof denominator !== 'number' || numerator <= 0 || denominator <= 0) {
    return Object.freeze({ numerator: 1, denominator: 1 })
  }
  return Object.freeze({ numerator, denominator })
}

export const playbackSegments = (plan: RenderPlan): readonly PlaybackSegment[] =>
  Object.freeze(
    [...plan.segments]
      .sort((left, right) => left.interval.start.ticks - right.interval.start.ticks)
      .map((segment) => Object.freeze({
        startTicks: segment.interval.start.ticks,
        durationTicks: segment.interval.duration.ticks,
        sourceStartTicks: segment.sourceStartTicks,
        assetId: segment.assetId,
        videoEnabled: segment.videoEnabled,
        audioEnabled: segment.audioEnabled,
        // A plan that says nothing about speed means normal speed, which is
        // what every plan meant before speed existed.
        sourceDurationTicks:
          typeof segment.sourceDurationTicks === 'number' && segment.sourceDurationTicks > 0
            ? segment.sourceDurationTicks
            : segment.interval.duration.ticks,
        rateNumerator:
          typeof segment.playbackRateNumerator === 'number' && segment.playbackRateNumerator > 0
            ? segment.playbackRateNumerator
            : 1,
        rateDenominator:
          typeof segment.playbackRateDenominator === 'number' && segment.playbackRateDenominator > 0
            ? segment.playbackRateDenominator
            : 1,
        reversed: segment.direction === 'reverse',
        maintainAudioPitch: segment.maintainAudioPitch !== false,
        freeze: segment.kind === 'freeze-segment',
      })),
  )

/**
 * How far into the RECORDING a given distance into a stretch is.
 *
 * One place, used by everything below, so the preview cannot apply the speed
 * in one sum and forget it in another. Rounding is half-up on whole numbers,
 * matching the domain exactly.
 */
const sourceOffsetFor = (segment: PlaybackSegment, screenOffsetTicks: number): number => {
  const rate = rateOf(segment)
  if (rate.numerator === rate.denominator) return screenOffsetTicks
  return Math.floor((2 * screenOffsetTicks * rate.numerator + rate.denominator) / (2 * rate.denominator))
}

/** The exact opposite question: how far into the stretch a point in the recording is. */
const screenOffsetFor = (segment: PlaybackSegment, sourceOffsetTicks: number): number => {
  const rate = rateOf(segment)
  if (rate.numerator === rate.denominator) return sourceOffsetTicks
  return Math.floor((2 * sourceOffsetTicks * rate.denominator + rate.numerator) / (2 * rate.numerator))
}

/**
 * How fast to run the video element at one moment of the finished video.
 *
 * This is the ONE place a decimal appears, and it appears at the very last
 * step: the browser's `playbackRate` takes a decimal and there is no way
 * round that. Every tick has already been decided exactly by then.
 *
 * Inside a hole the answer is normal speed. Nothing is playing there, and
 * leaving the element at 4x through a gap would make the moment it resumes
 * lurch.
 */
export const playbackRateAt = (
  segments: readonly PlaybackSegment[],
  compositionTicks: number,
): number => {
  const index = segmentIndexAt(segments, compositionTicks)
  if (index === -1) return 1
  const rate = rateOf(segments[index])
  return rate.numerator / rate.denominator
}

/** Whether a sped-up voice should keep its pitch at one moment. */
export const maintainPitchAt = (
  segments: readonly PlaybackSegment[],
  compositionTicks: number,
): boolean => {
  const index = segmentIndexAt(segments, compositionTicks)
  return index === -1 ? true : segments[index].maintainAudioPitch !== false
}

export type PreparedReversePreview = Readonly<{
  segmentIndex: number
  preparedAssetId: string
}>

/**
 * Replace one canonical reverse stretch with its prepared forward-playing proxy.
 *
 * The proxy contains exactly that source interval already reversed. From the
 * browser's point of view it begins at source tick zero and plays forwards at
 * the same rational rate. Every other segment remains byte-for-byte the same,
 * and the canonical render plan is never changed.
 */
export const withPreparedReversePreview = (
  segments: readonly PlaybackSegment[],
  prepared: PreparedReversePreview | null,
): readonly PlaybackSegment[] => {
  if (prepared === null) return segments
  if (prepared.segmentIndex < 0 || prepared.segmentIndex >= segments.length) return segments
  const target = segments[prepared.segmentIndex]
  if (target.reversed !== true) return segments
  return Object.freeze(segments.map((segment, index) => index === prepared.segmentIndex
    ? Object.freeze({
        ...segment,
        assetId: prepared.preparedAssetId,
        sourceStartTicks: 0,
        reversed: false,
      })
    : segment))
}

/**
 * Anything the preview genuinely cannot show, named plainly.
 *
 * Backwards playback is the only member of this list. A browser video element
 * will not run a file backwards — a negative `playbackRate` is either ignored
 * or silently treated as a pause by every engine — so the only truthful way
 * to show it is to play a prepared backwards copy of the file. Until that
 * exists, this reports the fact instead of showing forwards footage and
 * pretending.
 */
export const unpreviewableSegmentIndexes = (segments: readonly PlaybackSegment[]): readonly number[] =>
  Object.freeze(segments.map((segment, index) => (segment.reversed === true ? index : -1)).filter((index) => index !== -1))

/**
 * Which recording is on screen at one moment, and whether that is a change.
 *
 * The `<video>` element's file is only swapped when the answer is a DIFFERENT
 * recording from the one already loaded. Swapping it inside one recording would
 * make the picture stutter every few seconds for no reason, because every swap
 * throws away what the browser had already buffered.
 */
export const assetAt = (
  segments: readonly PlaybackSegment[],
  compositionTicks: number,
): string | null => {
  const index = segmentIndexAt(segments, compositionTicks)
  return index === -1 ? null : segments[index].assetId
}

/** Every recording the finished video is made of, in the order they first appear. */
export const playbackAssetIds = (segments: readonly PlaybackSegment[]): readonly string[] =>
  Object.freeze([...new Set(segments.map((segment) => segment.assetId))])

const endOf = (segment: PlaybackSegment): number => segment.startTicks + segment.durationTicks

/** The stretch showing at a moment of the finished video, or -1 inside a hole. */
export const segmentIndexAt = (segments: readonly PlaybackSegment[], compositionTicks: number): number =>
  segments.findIndex(
    (segment) => compositionTicks >= segment.startTicks && compositionTicks < endOf(segment),
  )

/**
 * Where to move the recording's playhead to show a given moment of the
 * finished video. Null means that moment is a hole, and nothing should be shown.
 */
export const sourceTimeFor = (
  segments: readonly PlaybackSegment[],
  compositionTicks: number,
): Readonly<{ segmentIndex: number; sourceTicks: number }> | null => {
  const index = segmentIndexAt(segments, compositionTicks)
  if (index === -1) return null
  const segment = segments[index]
  return Object.freeze({
    segmentIndex: index,
    sourceTicks: segment.freeze === true
      ? segment.sourceStartTicks
      : segment.sourceStartTicks + sourceOffsetFor(segment, compositionTicks - segment.startTicks),
  })
}

/**
 * Whether the picture is drawn and the sound is heard at one moment.
 *
 * Read from the plan the exporter also reads, never from the project, so the
 * screen and the file cannot form separate opinions. A hole shows black and
 * plays nothing anyway, so it answers no to both.
 */
export const outputStateAt = (
  segments: readonly PlaybackSegment[],
  compositionTicks: number,
): Readonly<{ videoEnabled: boolean; audioEnabled: boolean }> => {
  const index = segmentIndexAt(segments, compositionTicks)
  if (index === -1) return Object.freeze({ videoEnabled: false, audioEnabled: false })
  return Object.freeze({
    videoEnabled: segments[index].videoEnabled,
    audioEnabled: segments[index].audioEnabled,
  })
}

/** The first moment of the finished video at or after `compositionTicks` that shows something. */
export const nextVisibleTick = (
  segments: readonly PlaybackSegment[],
  compositionTicks: number,
): number | null => {
  if (segmentIndexAt(segments, compositionTicks) !== -1) return compositionTicks
  let best: number | null = null
  for (const segment of segments) {
    if (segment.startTicks >= compositionTicks && (best === null || segment.startTicks < best)) {
      best = segment.startTicks
    }
  }
  return best
}

export type PlaybackAction =
  /** The recording is in the right place; this is the moment now on screen. */
  | Readonly<{ kind: 'show'; compositionTicks: number; segmentIndex: number }>
  /** Move the recording's playhead here before showing anything. */
  | Readonly<{ kind: 'seek'; sourceTicks: number; compositionTicks: number; segmentIndex: number }>
  /** Hold one exact source frame while the composition clock keeps moving. */
  | Readonly<{ kind: 'hold'; sourceTicks: number; compositionTicks: number; untilTicks: number; segmentIndex: number }>
  /** Show black: this moment was deliberately left empty. */
  | Readonly<{ kind: 'hole'; compositionTicks: number; untilTicks: number }>
  /** The finished video is over. */
  | Readonly<{ kind: 'ended'; compositionTicks: number }>

/**
 * What to do next, given where the recording's playhead actually is.
 *
 * `expectedIndex` is the stretch the screen believed it was playing. Passing it
 * in is what lets one stretch end and the next begin without the caller having
 * to search: the recording running past the end of the expected stretch is the
 * signal to jump, and it is the only signal, so ordinary playback inside a
 * stretch costs nothing.
 */
export const advancePlayback = (
  segments: readonly PlaybackSegment[],
  expectedIndex: number,
  sourceTicks: number,
  totalTicks: number,
): PlaybackAction => {
  if (segments.length === 0) return Object.freeze({ kind: 'ended', compositionTicks: 0 })

  const showing = (index: number): PlaybackAction =>
    Object.freeze({
      kind: 'show',
      compositionTicks:
        segments[index].startTicks +
        screenOffsetFor(segments[index], sourceTicks - segments[index].sourceStartTicks),
      segmentIndex: index,
    })

  const expected = segments[expectedIndex]
  if (expected?.freeze === true) {
    return Object.freeze({
      kind: 'hold' as const,
      sourceTicks: expected.sourceStartTicks,
      compositionTicks: expected.startTicks,
      untilTicks: endOf(expected),
      segmentIndex: expectedIndex,
    })
  }
  if (expected) {
    // Measured against how much RECORDING the stretch uses, because that is
    // the clock the video element's own playhead is on. Comparing it against
    // the on-screen length would end a 2x stretch halfway through.
    const offset = sourceTicks - expected.sourceStartTicks
    if (offset >= 0 && offset < sourceSpanOf(expected)) return showing(expectedIndex)
  }

  // The browser's own scrubber is on screen, so the user can drag the recording
  // straight into a different stretch. That is not the end of anything; it is
  // simply a different part of the finished video.
  const scrubbedInto = segments.findIndex(
    (segment) =>
      segment.freeze !== true &&
      sourceTicks >= segment.sourceStartTicks &&
      sourceTicks < segment.sourceStartTicks + sourceSpanOf(segment),
  )
  if (scrubbedInto !== -1) return showing(scrubbedInto)

  // The recording is parked BEFORE the stretch that should be playing. This is
  // what a cut looks like from here: the footage changed underneath a playhead
  // that did not move. Returning to the start of that stretch shows the user
  // the new beginning, where declaring the video over would leave them staring
  // at a frozen frame wondering what they broke.
  if (expected && sourceTicks < expected.sourceStartTicks) {
    return Object.freeze({
      kind: 'seek',
      sourceTicks: expected.sourceStartTicks,
      compositionTicks: expected.startTicks,
      segmentIndex: expectedIndex,
    })
  }

  // The recording has run past the end of the stretch that was playing, so the
  // finished video has moved on to whatever comes next — which may be a hole,
  // may be earlier in the recording, and may be nothing at all.
  const continueFrom = expected ? endOf(expected) : 0
  if (continueFrom >= totalTicks) return Object.freeze({ kind: 'ended', compositionTicks: totalTicks })

  const nextVisible = nextVisibleTick(segments, continueFrom)
  if (nextVisible === null) return Object.freeze({ kind: 'ended', compositionTicks: totalTicks })
  if (nextVisible > continueFrom) {
    return Object.freeze({ kind: 'hole', compositionTicks: continueFrom, untilTicks: nextVisible })
  }

  const target = sourceTimeFor(segments, nextVisible)
  if (!target) return Object.freeze({ kind: 'ended', compositionTicks: totalTicks })
  const targetSegment = segments[target.segmentIndex]
  if (targetSegment.freeze === true) {
    return Object.freeze({
      kind: 'hold' as const,
      sourceTicks: target.sourceTicks,
      compositionTicks: nextVisible,
      untilTicks: endOf(targetSegment),
      segmentIndex: target.segmentIndex,
    })
  }
  return Object.freeze({
    kind: 'seek',
    sourceTicks: target.sourceTicks,
    compositionTicks: nextVisible,
    segmentIndex: target.segmentIndex,
  })
}

/**
 * True when the recording can simply be played through, because the finished
 * video is the recording: one stretch, starting at zero, in original order.
 *
 * This is every project before its first cut, so the common case pays nothing
 * for machinery it does not need.
 */
export const isUncutPassthrough = (segments: readonly PlaybackSegment[]): boolean =>
  segments.length === 1 &&
  segments[0].startTicks === 0 &&
  segments[0].sourceStartTicks === 0 &&
  // A retimed stretch is never a straight play-through: the element has to be
  // told how fast to run, and its own clock no longer matches the timeline's.
  rateOf(segments[0]).numerator === rateOf(segments[0]).denominator &&
  segments[0].reversed !== true &&
  segments[0].freeze !== true

