import { err, isRecord, ok, type Result } from './result.ts'
import { validateTimeRange, type TimeRange } from './time.ts'

/**
 * What was said, and exactly when each word was said.
 *
 * A transcript is EVIDENCE ABOUT one piece of footage, not an edit. It is never
 * stored inside the project, for two reasons that both bite hard:
 *
 *   1. Size. A ten-minute talk is roughly 1,500 words. The project file is
 *      rewritten every time the user changes anything, so carrying the words
 *      inside it would rewrite 60 kB on every click for data that never
 *      changes.
 *   2. Meaning. The project records DECISIONS the user made. What a microphone
 *      picked up is not a decision, and undoing an edit must not undo the
 *      knowledge of what was said.
 *
 * Captions ARE stored in the project, because a caption is a decision: this
 * text, at this moment, on screen. The transcript is only the raw material the
 * captions were cut from, and once they are cut the project no longer needs it.
 *
 *   transcript (sidecar, per asset)  ──segmentation──►  caption cues (project)
 *   never edited, never in undo                        edited, undoable
 *
 * Times are on the ORIGINAL footage's own clock, exactly like every other
 * anchored thing in this system (ADR-005). A word spoken 8 seconds into the
 * recording says "8 seconds", and stays right whatever is cut later.
 */
export const TRANSCRIPT_SCHEMA_VERSION = 'sanverse.transcript/v1'

/** Longest single token accepted. Beyond this the input is not speech. */
export const MAX_WORD_LENGTH = 128
export const MAX_WORDS = 100_000
export const MAX_TRANSCRIPT_SEGMENTS = 20_000
export const MAX_SEGMENT_TEXT_LENGTH = 4_096
/** BCP-47-ish. Deliberately permissive on region, strict on shape. */
export const LANGUAGE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

export type TranscriptWord = Readonly<{
  text: string
  /** When this word was spoken, on the footage's own clock. */
  interval: TimeRange
  /**
   * How sure the recogniser was, 0 to 1, or null when it did not say.
   *
   * Kept because low-confidence words are exactly the ones a user will want to
   * correct, and throwing the number away means never being able to point at
   * them.
   */
  confidence: number | null
}>

export type TranscriptSegment = Readonly<{
  segmentId: string
  interval: TimeRange
  text: string
  words: readonly TranscriptWord[]
  /** Who was speaking, when the source said so. Null otherwise. */
  speaker: string | null
}>

export type Transcript = Readonly<{
  schemaVersion: typeof TRANSCRIPT_SCHEMA_VERSION
  transcriptId: string
  /** The footage these words belong to. */
  assetId: string
  language: string
  /** Where the words came from. Recorded so a user can always tell. */
  source: 'sidecar' | 'transcription'
  segments: readonly TranscriptSegment[]
}>

export type TranscriptIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'TEXT_TOO_LONG'
  | 'TOO_MANY_WORDS'
  | 'TOO_MANY_SEGMENTS'
  | 'WORDS_OUT_OF_ORDER'
  | 'WORD_OUTSIDE_SEGMENT'
  | 'SEGMENTS_OUT_OF_ORDER'
  | 'DUPLICATE_SEGMENT_ID'

export type TranscriptError = {
  readonly code: 'TRANSCRIPT_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: TranscriptIssueCode }[]
}

export const TRANSCRIPT_ID_PATTERN = /^transcript_[a-z0-9]{8,64}$/
export const TRANSCRIPT_SEGMENT_ID_PATTERN = /^tseg_[a-z0-9]{4,64}$/

type Issue = TranscriptError['issues'][number]

const TRANSCRIPT_KEYS = [
  'schemaVersion',
  'transcriptId',
  'assetId',
  'language',
  'source',
  'segments',
] as const
const SEGMENT_KEYS = ['segmentId', 'interval', 'text', 'words', 'speaker'] as const
const WORD_KEYS = ['text', 'interval', 'confidence'] as const

const rangeEndTicks = (range: TimeRange): number => range.start.ticks + range.duration.ticks

const validateWord = (
  input: unknown,
  path: string,
  issues: Issue[],
): TranscriptWord | null => {
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  for (const key of WORD_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(WORD_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }

  if (typeof input.text !== 'string' || input.text.length === 0) {
    issues.push({ path: `${path}.text`, code: 'VALUE_OUT_OF_RANGE' })
  } else if ([...input.text].length > MAX_WORD_LENGTH) {
    issues.push({ path: `${path}.text`, code: 'TEXT_TOO_LONG' })
  }

  if (input.confidence !== null) {
    if (
      typeof input.confidence !== 'number' ||
      !Number.isFinite(input.confidence) ||
      input.confidence < 0 ||
      input.confidence > 1
    ) {
      issues.push({ path: `${path}.confidence`, code: 'VALUE_OUT_OF_RANGE' })
    }
  }

  // A word may legitimately have zero measured length when a recogniser reports
  // an instant rather than a span, so zero duration is allowed here and given a
  // real length later, during segmentation.
  const interval = validateTimeRange(input.interval, `${path}.interval`, { allowZeroDuration: true })
  if (!interval.ok) {
    issues.push({ path: `${path}.interval`, code: 'VALUE_OUT_OF_RANGE' })
    return null
  }

  if (issues.length > 0) return null
  return Object.freeze({
    text: input.text as string,
    interval: interval.value,
    confidence: input.confidence as number | null,
  })
}

const validateSegment = (
  input: unknown,
  path: string,
  issues: Issue[],
): TranscriptSegment | null => {
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  for (const key of SEGMENT_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(SEGMENT_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }

  if (typeof input.segmentId !== 'string' || !TRANSCRIPT_SEGMENT_ID_PATTERN.test(input.segmentId)) {
    issues.push({ path: `${path}.segmentId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.text !== 'string') {
    issues.push({ path: `${path}.text`, code: 'TYPE_INVALID' })
  } else if ([...input.text].length > MAX_SEGMENT_TEXT_LENGTH) {
    issues.push({ path: `${path}.text`, code: 'TEXT_TOO_LONG' })
  }
  if (input.speaker !== null && (typeof input.speaker !== 'string' || input.speaker.length > MAX_WORD_LENGTH)) {
    issues.push({ path: `${path}.speaker`, code: 'VALUE_OUT_OF_RANGE' })
  }

  const interval = validateTimeRange(input.interval, `${path}.interval`, { allowZeroDuration: true })
  if (!interval.ok) {
    issues.push({ path: `${path}.interval`, code: 'VALUE_OUT_OF_RANGE' })
    return null
  }

  if (!Array.isArray(input.words)) {
    issues.push({ path: `${path}.words`, code: 'TYPE_INVALID' })
    return null
  }

  const words: TranscriptWord[] = []
  let previousEnd = -1
  input.words.forEach((raw, index) => {
    const word = validateWord(raw, `${path}.words[${index}]`, issues)
    if (!word) return
    // Words must run forwards. A recogniser that emits them out of order would
    // otherwise produce captions whose text does not match their timing, and
    // nothing downstream could detect it.
    if (word.interval.start.ticks < previousEnd) {
      issues.push({ path: `${path}.words[${index}].interval`, code: 'WORDS_OUT_OF_ORDER' })
    }
    if (
      word.interval.start.ticks < interval.value.start.ticks ||
      rangeEndTicks(word.interval) > rangeEndTicks(interval.value)
    ) {
      issues.push({ path: `${path}.words[${index}].interval`, code: 'WORD_OUTSIDE_SEGMENT' })
    }
    previousEnd = rangeEndTicks(word.interval)
    words.push(word)
  })

  if (issues.length > 0) return null
  return Object.freeze({
    segmentId: input.segmentId as string,
    interval: interval.value,
    text: input.text as string,
    words: Object.freeze(words),
    speaker: input.speaker as string | null,
  })
}

/**
 * Validate a transcript arriving from anywhere: a file the user chose, an
 * upstream pipeline, or a transcription service. None of those are trusted.
 *
 * An unknown key is a refusal, never a silent strip, for the same reason it is
 * everywhere else in this system: a key we do not understand may be the one
 * carrying the meaning, and quietly dropping it produces a result the user did
 * not ask for while reporting success.
 */
export const validateTranscript = (input: unknown, path = '$'): Result<Transcript, TranscriptError> => {
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'TRANSCRIPT_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  for (const key of TRANSCRIPT_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(TRANSCRIPT_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }

  if (input.schemaVersion !== TRANSCRIPT_SCHEMA_VERSION) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.transcriptId !== 'string' || !TRANSCRIPT_ID_PATTERN.test(input.transcriptId)) {
    issues.push({ path: `${path}.transcriptId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.assetId !== 'string' || input.assetId.trim().length === 0) {
    issues.push({ path: `${path}.assetId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.language !== 'string' || !LANGUAGE_PATTERN.test(input.language)) {
    issues.push({ path: `${path}.language`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (input.source !== 'sidecar' && input.source !== 'transcription') {
    issues.push({ path: `${path}.source`, code: 'VALUE_OUT_OF_RANGE' })
  }

  if (!Array.isArray(input.segments)) {
    issues.push({ path: `${path}.segments`, code: 'TYPE_INVALID' })
    return err({ code: 'TRANSCRIPT_INVALID', issues })
  }
  if (input.segments.length > MAX_TRANSCRIPT_SEGMENTS) {
    issues.push({ path: `${path}.segments`, code: 'TOO_MANY_SEGMENTS' })
    return err({ code: 'TRANSCRIPT_INVALID', issues })
  }

  const segments: TranscriptSegment[] = []
  const seenIds = new Set<string>()
  let wordCount = 0
  let previousEnd = -1
  input.segments.forEach((raw, index) => {
    const segment = validateSegment(raw, `${path}.segments[${index}]`, issues)
    if (!segment) return
    if (seenIds.has(segment.segmentId)) {
      issues.push({ path: `${path}.segments[${index}].segmentId`, code: 'DUPLICATE_SEGMENT_ID' })
    }
    seenIds.add(segment.segmentId)
    if (segment.interval.start.ticks < previousEnd) {
      issues.push({ path: `${path}.segments[${index}].interval`, code: 'SEGMENTS_OUT_OF_ORDER' })
    }
    previousEnd = rangeEndTicks(segment.interval)
    wordCount += segment.words.length
    segments.push(segment)
  })

  if (wordCount > MAX_WORDS) {
    issues.push({ path: `${path}.segments`, code: 'TOO_MANY_WORDS' })
  }

  if (issues.length > 0) return err({ code: 'TRANSCRIPT_INVALID', issues })

  return ok(Object.freeze({
    schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
    transcriptId: input.transcriptId as string,
    assetId: input.assetId as string,
    language: input.language as string,
    source: input.source as 'sidecar' | 'transcription',
    segments: Object.freeze(segments),
  }))
}

/** Every word in speaking order, flattened across segments. */
export const transcriptWords = (transcript: Transcript): readonly TranscriptWord[] =>
  Object.freeze(transcript.segments.flatMap((segment) => [...segment.words]))

/** Total number of words, without building the flattened list. */
export const transcriptWordCount = (transcript: Transcript): number =>
  transcript.segments.reduce((total, segment) => total + segment.words.length, 0)
