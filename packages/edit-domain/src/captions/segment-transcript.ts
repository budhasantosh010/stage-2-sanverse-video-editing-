import { mediaTime, PROJECT_TIMESCALE, type TimeRange } from '../time.ts'
import { transcriptWords, type Transcript, type TranscriptWord } from '../transcript.ts'

/**
 * Turn "here are the words and when each was said" into "here is what goes on
 * screen, and when".
 *
 * This is the step that decides whether captions feel professional or amateur,
 * and it is deliberately DETERMINISTIC: the same transcript with the same
 * settings always produces byte-identical cues. No AI, no randomness, no
 * network. The AI's job is to understand what the user wants; deciding where a
 * line breaks is arithmetic, and arithmetic that varies between runs would make
 * a re-render silently different from what the user approved.
 *
 * The rules below are the ones broadcast subtitling has converged on. They are
 * stated as numbers, not opinions, so they can be argued with and changed:
 *
 *   at most 2 lines          three lines cover too much of the picture
 *   at most 42 characters    per line, the long-standing subtitle line width
 *   at least 1.0 seconds     shorter than this and the eye cannot land on it
 *   at most 6.0 seconds      longer and the reader has finished and is waiting
 *   at most 17 chars/second  the reading speed an average adult sustains
 *   split on a 0.7s pause    a real pause in speech is a real place to break
 *   split after . ! ?        a finished sentence is the best break there is
 */

export type CaptionCueDraft = Readonly<{
  /** When it is on screen, on the ORIGINAL footage's clock (ADR-005). */
  sourceInterval: TimeRange
  /** One or two lines, already wrapped. Never contains a newline character. */
  lines: readonly string[]
}>

export type SegmentationOptions = Readonly<{
  maxLines: number
  maxLineLength: number
  minDurationTicks: number
  maxDurationTicks: number
  /** Reading speed ceiling, used to lengthen a cue that is too dense. */
  maxCharactersPerSecond: number
  /** A silence at least this long forces a new cue. */
  pauseSplitTicks: number
}>

export const DEFAULT_SEGMENTATION: SegmentationOptions = Object.freeze({
  maxLines: 2,
  maxLineLength: 42,
  minDurationTicks: PROJECT_TIMESCALE, // 1.0s
  maxDurationTicks: PROJECT_TIMESCALE * 6, // 6.0s
  maxCharactersPerSecond: 17,
  pauseSplitTicks: Math.round(PROJECT_TIMESCALE * 0.7), // 0.7s
})

/** Sentence-ending punctuation, including the full-width forms. */
const SENTENCE_END = /[.!?。！？]["'”’)\]]*$/
/** Clause-ending punctuation — a second-choice break point. */
const CLAUSE_END = /[,;:、，；：]["'”’)\]]*$/

const endTicks = (range: TimeRange): number => range.start.ticks + range.duration.ticks

/**
 * Greedy line wrap that prefers balanced lines.
 *
 * Plain greedy wrapping produces "a very long first line" over "one word",
 * which reads badly. For the two-line case this tries every break point and
 * keeps the one where the longer line is shortest, breaking ties toward the
 * earlier break so the result is stable.
 *
 * Returns null when the words cannot fit in the allowed lines at all.
 */
export const wrapIntoLines = (
  words: readonly string[],
  maxLines: number,
  maxLineLength: number,
): readonly string[] | null => {
  if (words.length === 0) return null

  // Any single word longer than a line makes balanced wrapping impossible; it
  // is placed alone and allowed to overflow rather than being cut in half,
  // because half a word on screen is worse than a slightly wide line.
  const oversized = words.some((word) => [...word].length > maxLineLength)

  const single = words.join(' ')

  // One line always beats two when it fits. Balancing "hello there" into two
  // lines of five characters is technically more even and visibly worse: it
  // covers twice as much of the picture for the same words.
  if (oversized || [...single].length <= maxLineLength) return Object.freeze([single])
  if (maxLines === 1 || words.length === 1) return null

  if (maxLines === 2) {
    let best: { lines: string[]; longest: number } | null = null
    for (let breakAt = 1; breakAt < words.length; breakAt += 1) {
      const first = words.slice(0, breakAt).join(' ')
      const second = words.slice(breakAt).join(' ')
      const firstLength = [...first].length
      const secondLength = [...second].length
      if (firstLength > maxLineLength || secondLength > maxLineLength) continue
      const longest = Math.max(firstLength, secondLength)
      // Strictly-less keeps the earliest break among equals, which is what
      // makes this function deterministic.
      if (best === null || longest < best.longest) {
        best = { lines: [first, second], longest }
      }
    }
    return best ? Object.freeze(best.lines) : null
  }

  // Three or more lines: plain greedy, which is adequate because this product
  // never uses more than two and the case exists only for completeness.
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`
    if ([...candidate].length <= maxLineLength || current.length === 0) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current.length > 0) lines.push(current)
  return lines.length <= maxLines ? Object.freeze(lines) : null
}

/** How many characters a cue holds, which is what limits its reading time. */
const characterCount = (lines: readonly string[]): number =>
  lines.reduce((total, line) => total + [...line].length, 0)

const buildCue = (
  words: readonly TranscriptWord[],
  options: SegmentationOptions,
): CaptionCueDraft | null => {
  if (words.length === 0) return null
  const texts = words.map((word) => word.text.trim()).filter((text) => text.length > 0)
  if (texts.length === 0) return null

  const lines = wrapIntoLines(texts, options.maxLines, options.maxLineLength)
  if (!lines) return null

  const start = words[0].interval.start.ticks
  const spoken = Math.max(endTicks(words[words.length - 1].interval) - start, 0)

  // A cue must stay on screen long enough to be read, even when the words were
  // spoken faster than that. The extra time is taken from the silence that
  // follows; `repairCueTimings` is what stops it colliding with the next cue.
  const readingTicks = Math.ceil(
    (characterCount(lines) / options.maxCharactersPerSecond) * PROJECT_TIMESCALE,
  )
  const duration = Math.min(
    Math.max(spoken, readingTicks, options.minDurationTicks),
    options.maxDurationTicks,
  )

  return Object.freeze({
    sourceInterval: Object.freeze({ start: mediaTime(start), duration: mediaTime(duration) }),
    lines,
  })
}

/**
 * Split a transcript into caption cues.
 *
 * Walks the words once, in order, and closes the current cue when any of these
 * becomes true — checked in this order, which is what makes the output
 * reproducible:
 *
 *   1. the previous word ended a sentence
 *   2. the silence before this word is at least `pauseSplitTicks`
 *   3. adding this word would exceed the on-screen time limit
 *   4. adding this word would no longer fit in the allowed lines
 *
 * Rule 4 is checked by actually attempting the wrap, not by estimating, so the
 * cue that is emitted is exactly the cue that was tested.
 */
export const segmentTranscript = (
  transcript: Transcript,
  options: SegmentationOptions = DEFAULT_SEGMENTATION,
): readonly CaptionCueDraft[] => {
  const words = transcriptWords(transcript).filter((word) => word.text.trim().length > 0)
  if (words.length === 0) return Object.freeze([])

  const cues: CaptionCueDraft[] = []
  let current: TranscriptWord[] = []

  const flush = () => {
    const cue = buildCue(current, options)
    if (cue) cues.push(cue)
    current = []
  }

  for (const word of words) {
    if (current.length === 0) {
      current = [word]
      continue
    }

    const previous = current[current.length - 1]
    const previousText = previous.text.trim()

    if (SENTENCE_END.test(previousText)) {
      flush()
      current = [word]
      continue
    }

    const gap = word.interval.start.ticks - endTicks(previous.interval)
    if (gap >= options.pauseSplitTicks) {
      flush()
      current = [word]
      continue
    }

    const spanTicks = endTicks(word.interval) - current[0].interval.start.ticks
    if (spanTicks > options.maxDurationTicks) {
      flush()
      current = [word]
      continue
    }

    const candidate = [...current, word]
    const candidateTexts = candidate.map((entry) => entry.text.trim()).filter((text) => text.length > 0)
    if (wrapIntoLines(candidateTexts, options.maxLines, options.maxLineLength) === null) {
      flush()
      current = [word]
      continue
    }

    current = candidate
  }
  flush()

  // A single short word left stranded at the end of a cue reads as a mistake.
  // Merging it backwards is only allowed when the merged cue still fits, so
  // this can never produce a cue the wrap rules would have rejected.
  return Object.freeze(mergeOrphans(cues, options))
}

/** Longest word that counts as an "orphan" worth merging backwards. */
const ORPHAN_MAX_CHARACTERS = 3

const mergeOrphans = (
  cues: readonly CaptionCueDraft[],
  options: SegmentationOptions,
): CaptionCueDraft[] => {
  const merged: CaptionCueDraft[] = []
  for (const cue of cues) {
    const previous = merged[merged.length - 1]
    const isOrphan =
      cue.lines.length === 1 &&
      cue.lines[0].split(' ').length === 1 &&
      [...cue.lines[0]].length <= ORPHAN_MAX_CHARACTERS

    if (previous && isOrphan) {
      const words = [...previous.lines.join(' ').split(' '), cue.lines[0]]
      const lines = wrapIntoLines(words, options.maxLines, options.maxLineLength)
      const start = previous.sourceInterval.start.ticks
      const end = endTicks(cue.sourceInterval)
      if (lines && end - start <= options.maxDurationTicks) {
        merged[merged.length - 1] = Object.freeze({
          sourceInterval: Object.freeze({ start: mediaTime(start), duration: mediaTime(end - start) }),
          lines,
        })
        continue
      }
    }
    merged.push(cue)
  }
  return merged
}

/** Exported for tests and for the repair step's tie-breaking. */
export const isSentenceEnd = (text: string): boolean => SENTENCE_END.test(text.trim())
export const isClauseEnd = (text: string): boolean => CLAUSE_END.test(text.trim())
