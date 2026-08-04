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
   * Whether the picture is drawn and the sound is heard, copied straight from
   * the plan the export also reads. The preview never decides this for itself:
   * a second opinion here is exactly how the screen and the file start
   * disagreeing.
   */
  videoEnabled: boolean
  audioEnabled: boolean
}>

export const playbackSegments = (plan: RenderPlan): readonly PlaybackSegment[] =>
  Object.freeze(
    [...plan.segments]
      .sort((left, right) => left.interval.start.ticks - right.interval.start.ticks)
      .map((segment) => Object.freeze({
        startTicks: segment.interval.start.ticks,
        durationTicks: segment.interval.duration.ticks,
        sourceStartTicks: segment.sourceStartTicks,
        videoEnabled: segment.videoEnabled,
        audioEnabled: segment.audioEnabled,
      })),
  )

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
    sourceTicks: segment.sourceStartTicks + (compositionTicks - segment.startTicks),
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
      compositionTicks: segments[index].startTicks + (sourceTicks - segments[index].sourceStartTicks),
      segmentIndex: index,
    })

  const expected = segments[expectedIndex]
  if (expected) {
    const offset = sourceTicks - expected.sourceStartTicks
    if (offset >= 0 && offset < expected.durationTicks) return showing(expectedIndex)
  }

  // The browser's own scrubber is on screen, so the user can drag the recording
  // straight into a different stretch. That is not the end of anything; it is
  // simply a different part of the finished video.
  const scrubbedInto = segments.findIndex(
    (segment) =>
      sourceTicks >= segment.sourceStartTicks &&
      sourceTicks < segment.sourceStartTicks + segment.durationTicks,
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
  segments.length === 1 && segments[0].startTicks === 0 && segments[0].sourceStartTicks === 0
