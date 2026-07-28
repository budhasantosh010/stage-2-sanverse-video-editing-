import { describe, expect, it } from 'vitest'
import { PROJECT_TIMESCALE, toSeconds, transcriptWordCount } from '@sanverse/edit-domain'

import { importTranscriptSidecar } from './sidecar-import.ts'

const ASSET_ID = 'asset_aaaaaaaa'
const TRANSCRIPT_ID = 'transcript_aaaaaaaa'

const importFile = (value: unknown) =>
  importTranscriptSidecar({
    contents: typeof value === 'string' ? value : JSON.stringify(value),
    assetId: ASSET_ID,
    transcriptId: TRANSCRIPT_ID,
  })

const whisperFile = (overrides: Record<string, unknown> = {}) => ({
  language: 'en',
  segments: [
    {
      start: 0,
      end: 2.4,
      text: ' Hello there friend',
      words: [
        { word: ' Hello', start: 0, end: 0.5, probability: 0.98 },
        { word: ' there', start: 0.6, end: 1.0, probability: 0.95 },
        { word: ' friend', start: 1.1, end: 2.4, probability: 0.91 },
      ],
    },
  ],
  ...overrides,
})

describe('importTranscriptSidecar', () => {
  it('reads a normal Whisper-shaped file', () => {
    const result = importFile(whisperFile())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.transcript.assetId).toBe(ASSET_ID)
    expect(result.value.transcript.language).toBe('en')
    expect(result.value.transcript.source).toBe('sidecar')
    expect(transcriptWordCount(result.value.transcript)).toBe(3)
  })

  it('strips the leading space Whisper puts on every word', () => {
    // Otherwise every caption line comes out with double spaces in it.
    const result = importFile(whisperFile())
    if (!result.ok) throw new Error('import failed')
    const words = result.value.transcript.segments[0].words.map((word) => word.text)
    expect(words).toEqual(['Hello', 'there', 'friend'])
  })

  it('converts seconds to ticks exactly for a clean value', () => {
    const result = importFile(whisperFile())
    if (!result.ok) throw new Error('import failed')
    const first = result.value.transcript.segments[0].words[0]
    expect(first.interval.duration.ticks).toBe(0.5 * PROJECT_TIMESCALE)
  })

  it('reports the worst rounding error rather than hiding it', () => {
    const result = importFile(whisperFile({
      segments: [{
        start: 0, end: 1,
        text: 'x',
        words: [{ word: 'x', start: 0.1234567891, end: 0.9, probability: 0.5 }],
      }],
    }))
    if (!result.ok) throw new Error('import failed')
    expect(result.value.worstResidualSeconds).toBeGreaterThan(0)
    // At 1,440,000 ticks per second the worst possible error is half a tick.
    expect(result.value.worstResidualSeconds).toBeLessThan(1 / PROJECT_TIMESCALE)
  })

  it('keeps a confidence when given one and accepts a file without any', () => {
    const withProbability = importFile(whisperFile())
    if (!withProbability.ok) throw new Error('import failed')
    expect(withProbability.value.transcript.segments[0].words[0].confidence).toBe(0.98)

    const without = importFile(whisperFile({
      segments: [{ start: 0, end: 1, text: 'x', words: [{ word: 'x', start: 0, end: 1 }] }],
    }))
    if (!without.ok) throw new Error('import failed')
    expect(without.value.transcript.segments[0].words[0].confidence).toBeNull()
  })

  it('accepts "text" as well as "word" for the token key', () => {
    const result = importFile(whisperFile({
      segments: [{ start: 0, end: 1, text: 'hi', words: [{ text: 'hi', start: 0, end: 1 }] }],
    }))
    expect(result.ok).toBe(true)
  })

  it('skips a segment with no word timings and says which one', () => {
    const result = importFile(whisperFile({
      segments: [
        { start: 0, end: 1, text: 'no words here', words: [] },
        { start: 2, end: 3, text: 'good', words: [{ word: 'good', start: 2, end: 3 }] },
      ],
    }))
    if (!result.ok) throw new Error('import failed')
    expect(result.value.transcript.segments).toHaveLength(1)
    expect(result.value.skipped).toEqual([{ index: 0, reason: 'SEGMENT_INVALID' }])
  })

  it('skips a segment whose times run backwards', () => {
    const result = importFile(whisperFile({
      segments: [
        { start: 5, end: 1, text: 'backwards', words: [{ word: 'x', start: 5, end: 1 }] },
        { start: 6, end: 7, text: 'fine', words: [{ word: 'fine', start: 6, end: 7 }] },
      ],
    }))
    if (!result.ok) throw new Error('import failed')
    expect(result.value.skipped).toEqual([{ index: 0, reason: 'TIMES_BACKWARDS' }])
  })

  it('nudges an overlapping segment forward rather than discarding the file', () => {
    const result = importFile(whisperFile({
      segments: [
        { start: 0, end: 3, text: 'one', words: [{ word: 'one', start: 0, end: 3 }] },
        { start: 2, end: 5, text: 'two', words: [{ word: 'two', start: 2, end: 5 }] },
      ],
    }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [first, second] = result.value.transcript.segments
    const firstEnd = first.interval.start.ticks + first.interval.duration.ticks
    expect(second.interval.start.ticks).toBeGreaterThanOrEqual(firstEnd)
  })

  it('refuses a file that is not JSON, without quoting it back', () => {
    const result = importFile('this is not json { "secret": "value"')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('JSON_INVALID')
    expect(result.error.message).not.toContain('secret')
  })

  it('refuses a file with no segments list', () => {
    const result = importFile({ language: 'en' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('SEGMENTS_MISSING')
  })

  it('refuses a file where nothing at all was usable', () => {
    const result = importFile(whisperFile({ segments: [{ start: 0, end: 1, text: 'x', words: [] }] }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NO_USABLE_SEGMENTS')
  })

  it('falls back to a sensible language when the file names a nonsense one', () => {
    const result = importFile(whisperFile({ language: 'Klingon (probably)' }))
    if (!result.ok) throw new Error('import failed')
    expect(result.value.transcript.language).toBe('en')
  })

  it('keeps a speaker label when the file has one', () => {
    const result = importFile(whisperFile({
      segments: [{
        start: 0, end: 1, text: 'hi', speaker: 'SPEAKER_01',
        words: [{ word: 'hi', start: 0, end: 1 }],
      }],
    }))
    if (!result.ok) throw new Error('import failed')
    expect(result.value.transcript.segments[0].speaker).toBe('SPEAKER_01')
  })

  it('keeps words inside the segment that holds them', () => {
    // A word claiming to end after its segment would be refused by the domain.
    const result = importFile(whisperFile({
      segments: [{
        start: 0, end: 1, text: 'x',
        words: [{ word: 'x', start: 0, end: 9 }],
      }],
    }))
    if (!result.ok) throw new Error('import failed')
    const segment = result.value.transcript.segments[0]
    const word = segment.words[0]
    expect(toSeconds(word.interval.start) + toSeconds(word.interval.duration))
      .toBeLessThanOrEqual(toSeconds(segment.interval.start) + toSeconds(segment.interval.duration))
  })

  it('produces the same transcript when the same file is imported twice', () => {
    const first = importFile(whisperFile())
    const second = importFile(whisperFile())
    if (!first.ok || !second.ok) throw new Error('import failed')
    expect(JSON.stringify(first.value.transcript)).toBe(JSON.stringify(second.value.transcript))
  })
})
