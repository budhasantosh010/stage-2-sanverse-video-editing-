import { describe, expect, it } from 'vitest'

import { PROJECT_TIMESCALE } from './time.ts'
import {
  MAX_WORD_LENGTH,
  TRANSCRIPT_SCHEMA_VERSION,
  transcriptWordCount,
  transcriptWords,
  validateTranscript,
} from './transcript.ts'

const time = (seconds: number) => ({ ticks: Math.round(seconds * PROJECT_TIMESCALE), timescale: PROJECT_TIMESCALE })
const range = (startSeconds: number, durationSeconds: number) => ({
  start: time(startSeconds),
  duration: time(durationSeconds),
})

const word = (text: string, start: number, duration: number, confidence: number | null = 0.9) => ({
  text,
  interval: range(start, duration),
  confidence,
})

const transcript = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
  transcriptId: 'transcript_abcd1234',
  assetId: 'asset_abcd1234',
  language: 'en',
  source: 'sidecar',
  segments: [
    {
      segmentId: 'tseg_0001',
      interval: range(0, 2),
      text: 'Hello there friend',
      words: [word('Hello', 0, 0.5), word('there', 0.6, 0.4), word('friend', 1.1, 0.6)],
      speaker: null,
    },
  ],
  ...overrides,
})

describe('validateTranscript', () => {
  it('accepts a well-formed transcript', () => {
    const result = validateTranscript(transcript())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.segments).toHaveLength(1)
    expect(transcriptWordCount(result.value)).toBe(3)
    expect(transcriptWords(result.value).map((entry) => entry.text)).toEqual(['Hello', 'there', 'friend'])
  })

  it('refuses an unknown key rather than dropping it', () => {
    // A key we do not understand may be the one carrying the meaning.
    const result = validateTranscript(transcript({ speakerCount: 2 }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'FIELD_UNKNOWN')).toBe(true)
  })

  it('refuses words that run backwards', () => {
    const result = validateTranscript(transcript({
      segments: [{
        segmentId: 'tseg_0001',
        interval: range(0, 2),
        text: 'a b',
        words: [word('later', 1.0, 0.4), word('earlier', 0.1, 0.4)],
        speaker: null,
      }],
    }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'WORDS_OUT_OF_ORDER')).toBe(true)
  })

  it('refuses a word that sits outside the segment holding it', () => {
    const result = validateTranscript(transcript({
      segments: [{
        segmentId: 'tseg_0001',
        interval: range(0, 1),
        text: 'stray',
        words: [word('stray', 5, 0.4)],
        speaker: null,
      }],
    }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'WORD_OUTSIDE_SEGMENT')).toBe(true)
  })

  it('refuses two segments sharing an id', () => {
    const segment = {
      segmentId: 'tseg_0001',
      interval: range(0, 1),
      text: 'a',
      words: [word('a', 0, 0.5)],
      speaker: null,
    }
    const result = validateTranscript(transcript({
      segments: [segment, { ...segment, interval: range(1, 1), words: [word('b', 1, 0.5)] }],
    }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'DUPLICATE_SEGMENT_ID')).toBe(true)
  })

  it('allows a word with no measured length, because recognisers emit instants', () => {
    const result = validateTranscript(transcript({
      segments: [{
        segmentId: 'tseg_0001',
        interval: range(0, 1),
        text: 'tick',
        words: [word('tick', 0.5, 0)],
        speaker: null,
      }],
    }))
    expect(result.ok).toBe(true)
  })

  it('allows a missing confidence, but not one outside 0 to 1', () => {
    expect(validateTranscript(transcript({
      segments: [{
        segmentId: 'tseg_0001', interval: range(0, 1), text: 'a',
        words: [word('a', 0, 0.5, null)], speaker: null,
      }],
    })).ok).toBe(true)

    expect(validateTranscript(transcript({
      segments: [{
        segmentId: 'tseg_0001', interval: range(0, 1), text: 'a',
        words: [word('a', 0, 0.5, 1.4)], speaker: null,
      }],
    })).ok).toBe(false)
  })

  it('refuses a token too long to be a word', () => {
    const result = validateTranscript(transcript({
      segments: [{
        segmentId: 'tseg_0001', interval: range(0, 1), text: 'x',
        words: [word('x'.repeat(MAX_WORD_LENGTH + 1), 0, 0.5)], speaker: null,
      }],
    }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'TEXT_TOO_LONG')).toBe(true)
  })

  it('refuses a language tag that is not a language tag', () => {
    expect(validateTranscript(transcript({ language: 'English' })).ok).toBe(false)
    expect(validateTranscript(transcript({ language: 'en-GB' })).ok).toBe(true)
    expect(validateTranscript(transcript({ language: 'pt-BR' })).ok).toBe(true)
  })

  it('refuses a source it does not recognise', () => {
    expect(validateTranscript(transcript({ source: 'guessed' })).ok).toBe(false)
  })
})
