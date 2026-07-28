import { describe, expect, it } from 'vitest'

import { PROJECT_TIMESCALE, toSeconds } from '../time.ts'
import { TRANSCRIPT_SCHEMA_VERSION, validateTranscript, type Transcript } from '../transcript.ts'
import { DEFAULT_SEGMENTATION, segmentTranscript, wrapIntoLines } from './segment-transcript.ts'

const time = (seconds: number) => ({ ticks: Math.round(seconds * PROJECT_TIMESCALE), timescale: PROJECT_TIMESCALE })
const range = (start: number, duration: number) => ({ start: time(start), duration: time(duration) })

/** Build a transcript from `[text, start, end]` triples, one segment holding all. */
const build = (words: readonly [string, number, number][]): Transcript => {
  const first = words[0][1]
  const last = words[words.length - 1][2]
  const result = validateTranscript({
    schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
    transcriptId: 'transcript_abcd1234',
    assetId: 'asset_abcd1234',
    language: 'en',
    source: 'sidecar',
    segments: [{
      segmentId: 'tseg_0001',
      interval: range(first, last - first),
      text: words.map(([text]) => text).join(' '),
      words: words.map(([text, start, end]) => ({
        text,
        interval: range(start, end - start),
        confidence: 0.9,
      })),
      speaker: null,
    }],
  })
  if (!result.ok) throw new Error(`fixture invalid: ${JSON.stringify(result.error.issues)}`)
  return result.value
}

/** Evenly spaced words, 0.3s each, no gaps. */
const evenly = (texts: readonly string[], startAt = 0): [string, number, number][] =>
  texts.map((text, index) => [text, startAt + index * 0.3, startAt + index * 0.3 + 0.3])

describe('wrapIntoLines', () => {
  it('balances two lines rather than filling the first', () => {
    const lines = wrapIntoLines(['one', 'two', 'three', 'four'], 2, 12)
    expect(lines).toEqual(['one two', 'three four'])
  })

  it('keeps a short phrase on one line', () => {
    expect(wrapIntoLines(['hello', 'there'], 2, 42)).toEqual(['hello there'])
  })

  it('lets one over-long word overflow rather than cutting it in half', () => {
    const long = 'supercalifragilisticexpialidocious'
    const lines = wrapIntoLines([long], 2, 10)
    expect(lines).toEqual([long])
  })

  it('refuses when the words cannot fit the allowed lines', () => {
    expect(wrapIntoLines(['aaaa', 'bbbb', 'cccc', 'dddd', 'eeee'], 2, 8)).toBeNull()
  })

  it('is deterministic: the same input always gives the same break', () => {
    const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
    const first = wrapIntoLines(words, 2, 20)
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(wrapIntoLines(words, 2, 20)).toEqual(first)
    }
  })
})

describe('segmentTranscript', () => {
  it('breaks after a finished sentence', () => {
    const cues = segmentTranscript(build(evenly(['Hello', 'there.', 'How', 'are', 'you?'])))
    expect(cues).toHaveLength(2)
    expect(cues[0].lines.join(' ')).toBe('Hello there.')
    expect(cues[1].lines.join(' ')).toBe('How are you?')
  })

  it('breaks on a real pause in speech', () => {
    const cues = segmentTranscript(build([
      ['So', 0, 0.3],
      ['anyway', 0.3, 0.8],
      // 1.5s of silence — longer than the 0.7s pause threshold
      ['moving', 2.3, 2.7],
      ['on', 2.7, 3.0],
    ]))
    expect(cues).toHaveLength(2)
    expect(cues[0].lines.join(' ')).toBe('So anyway')
    expect(cues[1].lines.join(' ')).toBe('moving on')
  })

  it('never lets a cue exceed the maximum on-screen time', () => {
    const cues = segmentTranscript(build(evenly(Array.from({ length: 60 }, (_, i) => `w${i}`))))
    for (const cue of cues) {
      expect(cue.sourceInterval.duration.ticks).toBeLessThanOrEqual(DEFAULT_SEGMENTATION.maxDurationTicks)
    }
  })

  it('never lets a line exceed the maximum width', () => {
    const cues = segmentTranscript(build(evenly(
      'the quick brown fox jumps over the lazy dog and keeps running for a while longer'.split(' '),
    )))
    for (const cue of cues) {
      expect(cue.lines.length).toBeLessThanOrEqual(DEFAULT_SEGMENTATION.maxLines)
      for (const line of cue.lines) {
        expect([...line].length).toBeLessThanOrEqual(DEFAULT_SEGMENTATION.maxLineLength)
      }
    }
  })

  it('gives a fast-spoken cue enough time to be read', () => {
    // Four words in 1.2s of speech. Reading time, not speaking time, wins.
    const cues = segmentTranscript(build(evenly(['alpha', 'bravo', 'charlie', 'delta'])))
    expect(cues).toHaveLength(1)
    expect(cues[0].sourceInterval.duration.ticks).toBeGreaterThanOrEqual(DEFAULT_SEGMENTATION.minDurationTicks)
  })

  it('starts each cue exactly when its first word is spoken', () => {
    const cues = segmentTranscript(build([
      ['One.', 1.0, 1.4],
      ['Two.', 3.0, 3.4],
    ]))
    expect(toSeconds(cues[0].sourceInterval.start)).toBeCloseTo(1.0, 6)
    expect(toSeconds(cues[1].sourceInterval.start)).toBeCloseTo(3.0, 6)
  })

  it('merges a stranded short word back into the cue before it', () => {
    // "of" alone after a sentence break would read as a mistake.
    const cues = segmentTranscript(build([
      ['Here', 0, 0.3],
      ['is', 0.3, 0.6],
      ['one.', 0.6, 0.9],
      ['of', 0.9, 1.2],
    ]))
    expect(cues).toHaveLength(1)
    expect(cues[0].lines.join(' ')).toBe('Here is one. of')
  })

  it('returns nothing for a transcript with no words', () => {
    const empty = validateTranscript({
      schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
      transcriptId: 'transcript_abcd1234',
      assetId: 'asset_abcd1234',
      language: 'en',
      source: 'sidecar',
      segments: [],
    })
    if (!empty.ok) throw new Error('fixture invalid')
    expect(segmentTranscript(empty.value)).toEqual([])
  })

  it('is deterministic across repeated runs', () => {
    const transcript = build(evenly('one two three four five six seven eight nine ten'.split(' ')))
    const first = JSON.stringify(segmentTranscript(transcript))
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(JSON.stringify(segmentTranscript(transcript))).toBe(first)
    }
  })
})
