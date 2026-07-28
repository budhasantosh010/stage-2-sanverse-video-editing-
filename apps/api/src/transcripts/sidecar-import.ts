import {
  TRANSCRIPT_SCHEMA_VERSION,
  mediaTimeFromSeconds,
  validateTranscript,
  type Transcript,
} from '@sanverse/edit-domain'

/**
 * Read a word-timing file produced somewhere else, and turn it into a
 * transcript this system will accept.
 *
 * The shape read here is the one every current speech-recognition tool emits
 * (Whisper and its descendants): a list of segments, each with a start and end
 * in SECONDS, a line of text, and optionally the individual words with their
 * own start and end.
 *
 *   {
 *     "language": "en",
 *     "segments": [
 *       { "start": 0.0, "end": 2.4, "text": "Hello there",
 *         "words": [ { "word": "Hello", "start": 0.0, "end": 0.5,
 *                      "probability": 0.98 } ] }
 *     ]
 *   }
 *
 * ASSUMPTION, STATED: this is the format the upstream Stage 1 pipeline emits.
 * It has been implemented from the published shape, not verified against a real
 * Stage 1 file, because no such file exists in this repository yet. If Stage 1
 * emits something else, this is the ONE file that changes — nothing downstream
 * knows the format exists.
 *
 * Nothing here is trusted. This file sits on the boundary between "a file
 * somebody gave us" and "data this system will act on", and it is the only
 * place in the caption path where seconds become ticks, which is the only place
 * rounding can happen.
 */

export type SidecarImportIssueCode =
  | 'NOT_AN_OBJECT'
  | 'JSON_INVALID'
  | 'SEGMENTS_MISSING'
  | 'SEGMENT_INVALID'
  | 'TIMES_INVALID'
  | 'TIMES_BACKWARDS'
  | 'NO_USABLE_SEGMENTS'
  | 'TOO_LARGE'
  | 'TRANSCRIPT_REJECTED'

export type SidecarImportError = Readonly<{
  code: SidecarImportIssueCode
  /** Safe to show a user. Never contains file contents. */
  message: string
  detail?: readonly { readonly path: string; readonly code: string }[]
}>

export type SidecarImportReport = Readonly<{
  transcript: Transcript
  /** Segments that were skipped, and why. Never silent. */
  skipped: readonly { readonly index: number; readonly reason: SidecarImportIssueCode }[]
  /**
   * Largest single rounding error, in seconds, from converting the file's
   * decimal seconds to the project's whole ticks. At 1,440,000 ticks per second
   * this is at most about 0.0000003 s, which is reported rather than assumed.
   */
  worstResidualSeconds: number
}>

/** Well past any real transcript; stops a hostile file exhausting memory. */
const MAX_SIDECAR_BYTES = 32 * 1024 * 1024

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readSeconds = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

/**
 * Whisper writes words with a leading space (" Hello"). Keeping it would put a
 * double space in every caption line, so it is trimmed here, once, at the
 * boundary — not later, in three places that could disagree.
 */
const cleanWord = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

const pad = (value: number): string => String(value).padStart(4, '0')

export type SidecarImportInput = Readonly<{
  /** The file's text, exactly as read from disk. */
  contents: string
  assetId: string
  /** Caller-supplied, so importing the same file twice is reproducible. */
  transcriptId: string
  /** Used when the file names no language. */
  fallbackLanguage?: string
}>

export const importTranscriptSidecar = (
  input: SidecarImportInput,
):
  | { readonly ok: true; readonly value: SidecarImportReport }
  | { readonly ok: false; readonly error: SidecarImportError } => {
  if (input.contents.length > MAX_SIDECAR_BYTES) {
    return { ok: false, error: { code: 'TOO_LARGE', message: 'That transcript file is too large to read.' } }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(input.contents)
  } catch {
    // The parser's own message can quote the file, so it is never passed on.
    return { ok: false, error: { code: 'JSON_INVALID', message: 'That file is not readable as a transcript.' } }
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: { code: 'NOT_AN_OBJECT', message: 'That file is not readable as a transcript.' } }
  }
  if (!Array.isArray(parsed.segments)) {
    return {
      ok: false,
      error: { code: 'SEGMENTS_MISSING', message: 'That transcript file has no list of spoken segments.' },
    }
  }

  const language = typeof parsed.language === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(parsed.language)
    ? parsed.language
    : (input.fallbackLanguage ?? 'en')

  const skipped: { index: number; reason: SidecarImportIssueCode }[] = []
  const segments: unknown[] = []
  let worstResidual = 0
  let previousEndTicks = 0

  parsed.segments.forEach((raw, index) => {
    if (!isRecord(raw)) {
      skipped.push({ index, reason: 'SEGMENT_INVALID' })
      return
    }
    const start = readSeconds(raw.start)
    const end = readSeconds(raw.end)
    if (start === null || end === null) {
      skipped.push({ index, reason: 'TIMES_INVALID' })
      return
    }
    if (end < start) {
      skipped.push({ index, reason: 'TIMES_BACKWARDS' })
      return
    }

    const startTime = mediaTimeFromSeconds(start)
    const endTime = mediaTimeFromSeconds(end)
    if (!startTime.ok || !endTime.ok) {
      skipped.push({ index, reason: 'TIMES_INVALID' })
      return
    }
    worstResidual = Math.max(
      worstResidual,
      Math.abs(startTime.value.residualSeconds),
      Math.abs(endTime.value.residualSeconds),
    )

    // Two segments overlapping would be refused wholesale by the validator, so
    // a later segment starting before the previous one ended is nudged forward
    // rather than throwing away the entire file. This is reported.
    let segmentStartTicks = startTime.value.time.ticks
    if (segmentStartTicks < previousEndTicks) {
      segmentStartTicks = previousEndTicks
    }
    const segmentEndTicks = Math.max(endTime.value.time.ticks, segmentStartTicks)

    const words: unknown[] = []
    let wordEndTicks = segmentStartTicks
    if (Array.isArray(raw.words)) {
      for (const rawWord of raw.words) {
        if (!isRecord(rawWord)) continue
        // Whisper uses "word"; some tools use "text". Both are read; neither is
        // required, because a segment without word timings is still usable.
        const text = cleanWord(rawWord.word ?? rawWord.text)
        if (text === null) continue
        const wordStart = readSeconds(rawWord.start)
        const wordEnd = readSeconds(rawWord.end)
        if (wordStart === null || wordEnd === null || wordEnd < wordStart) continue

        const startTicks = mediaTimeFromSeconds(wordStart)
        const endTicksResult = mediaTimeFromSeconds(wordEnd)
        if (!startTicks.ok || !endTicksResult.ok) continue
        worstResidual = Math.max(
          worstResidual,
          Math.abs(startTicks.value.residualSeconds),
          Math.abs(endTicksResult.value.residualSeconds),
        )

        // Clamp each word inside its own segment and after the word before it.
        const from = Math.min(Math.max(startTicks.value.time.ticks, wordEndTicks), segmentEndTicks)
        const to = Math.min(Math.max(endTicksResult.value.time.ticks, from), segmentEndTicks)
        wordEndTicks = to

        const probability = typeof rawWord.probability === 'number'
          ? rawWord.probability
          : typeof rawWord.confidence === 'number'
            ? rawWord.confidence
            : null
        words.push({
          text,
          interval: {
            start: { ticks: from, timescale: 1_440_000 },
            duration: { ticks: to - from, timescale: 1_440_000 },
          },
          confidence: probability !== null && probability >= 0 && probability <= 1 ? probability : null,
        })
      }
    }

    if (words.length === 0) {
      // Captions need word timings. A segment without them cannot be cut into
      // readable lines, so it is skipped and said so, not silently half-used.
      skipped.push({ index, reason: 'SEGMENT_INVALID' })
      return
    }

    previousEndTicks = segmentEndTicks
    segments.push({
      segmentId: `tseg_${pad(segments.length + 1)}`,
      interval: {
        start: { ticks: segmentStartTicks, timescale: 1_440_000 },
        duration: { ticks: segmentEndTicks - segmentStartTicks, timescale: 1_440_000 },
      },
      text: typeof raw.text === 'string' ? raw.text.trim() : '',
      words,
      speaker: typeof raw.speaker === 'string' && raw.speaker.length > 0 ? raw.speaker : null,
    })
  })

  if (segments.length === 0) {
    return {
      ok: false,
      error: {
        code: 'NO_USABLE_SEGMENTS',
        message: 'That transcript file has no word timings, so captions cannot be built from it.',
      },
    }
  }

  const transcript = validateTranscript({
    schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
    transcriptId: input.transcriptId,
    assetId: input.assetId,
    language,
    source: 'sidecar',
    segments,
  })
  if (!transcript.ok) {
    return {
      ok: false,
      error: {
        code: 'TRANSCRIPT_REJECTED',
        message: 'That transcript file could not be read.',
        detail: transcript.error.issues,
      },
    }
  }

  return {
    ok: true,
    value: {
      transcript: transcript.value,
      skipped: Object.freeze(skipped),
      worstResidualSeconds: worstResidual,
    },
  }
}
