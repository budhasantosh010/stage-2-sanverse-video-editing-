import { describe, expect, it } from 'vitest'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

import {
  AnalysisError,
  analysisCacheName,
  analysisRequestId,
  MAX_ANALYSIS_PIXELS,
  MAX_NORMALIZATION_SPAN_TICKS,
  MAX_PEAK_COUNT,
  MAX_REVERSE_PREVIEW_SPAN_TICKS,
  MAX_WAVEFORM_SPAN_TICKS,
  MIN_NORMALIZATION_SPAN_TICKS,
  MIN_REVERSE_PREVIEW_SPAN_TICKS,
  parseAnalysisRequest,
  ticksToSeconds,
} from './analysis-request.ts'

/**
 * Gate D — what the browser is allowed to ask the server for.
 *
 * Everything here arrived over the network, so every one of these is a security
 * test as much as a correctness one. The rule under test is the same in each
 * case: unknown, missing, or out of range is REFUSED, never repaired.
 */

const params = (query: string) => new URLSearchParams(query)
const VALID = 'assetId=asset_aaaaaaaa&assetVersion=aaaaaaaaaaaaaaaa'

const refusalCode = (run: () => unknown): string => {
  try { run() } catch (error) {
    return error instanceof AnalysisError ? error.code : 'NOT_AN_ANALYSIS_ERROR'
  }
  return 'NO_REFUSAL'
}

describe('reading one request out of a web address', () => {
  it('accepts a complete, in-range request for a frame', () => {
    const request = parseAnalysisRequest('filmstrip-frame', params(`${VALID}&sourceTicks=1440000&width=64`))
    expect(request).toEqual({
      kind: 'filmstrip-frame',
      assetId: 'asset_aaaaaaaa',
      assetVersion: 'aaaaaaaaaaaaaaaa',
      sourceTicks: 1_440_000,
      widthPx: 64,
    })
  })

  it('refuses a request carrying a name it does not know', () => {
    // An ignored parameter is how a caller comes to believe they asked for
    // something they did not get.
    expect(refusalCode(() => parseAnalysisRequest(
      'filmstrip-frame',
      params(`${VALID}&sourceTicks=0&width=64&path=../../etc/passwd`),
    ))).toBe('ANALYSIS_KEY_INVALID')
  })

  it('refuses a request missing any name it needs', () => {
    expect(refusalCode(() => parseAnalysisRequest('filmstrip-frame', params(`${VALID}&width=64`))))
      .toBe('ANALYSIS_KEY_INVALID')
  })

  it('refuses a kind of preview it does not make', () => {
    expect(refusalCode(() => parseAnalysisRequest('spectrogram', params(VALID))))
      .toBe('ANALYSIS_KEY_INVALID')
  })

  it('refuses an asset name that is not an asset name', () => {
    for (const bad of ['../source', 'asset_../..', 'ASSET_AAAAAAAA', 'asset_a', '']) {
      expect(refusalCode(() => parseAnalysisRequest(
        'filmstrip-frame',
        params(`assetId=${encodeURIComponent(bad)}&assetVersion=aaaaaaaaaaaaaaaa&sourceTicks=0&width=64`),
      ))).toBe('ANALYSIS_KEY_INVALID')
    }
  })

  it('refuses a version that is not a checksum', () => {
    for (const bad of ['aaaa', 'a'.repeat(17), 'AAAAAAAAAAAAAAAA', 'zzzzzzzzzzzzzzzz']) {
      expect(refusalCode(() => parseAnalysisRequest(
        'filmstrip-frame',
        params(`assetId=asset_aaaaaaaa&assetVersion=${bad}&sourceTicks=0&width=64`),
      ))).toBe('ANALYSIS_KEY_INVALID')
    }
  })

  it('refuses numbers that are not plain whole numbers', () => {
    for (const bad of ['-1', '1.5', '1e3', ' 1', '0x10', '', '+1']) {
      expect(refusalCode(() => parseAnalysisRequest(
        'filmstrip-frame',
        params(`${VALID}&sourceTicks=${encodeURIComponent(bad)}&width=64`),
      ))).toBe('ANALYSIS_KEY_INVALID')
    }
  })

  it('refuses a picture bigger than this editor ever draws', () => {
    expect(refusalCode(() => parseAnalysisRequest(
      'filmstrip-frame',
      params(`${VALID}&sourceTicks=0&width=${MAX_ANALYSIS_PIXELS + 1}`),
    ))).toBe('ANALYSIS_KEY_INVALID')
    expect(refusalCode(() => parseAnalysisRequest(
      'image-thumbnail',
      params(`${VALID}&width=64&height=99999`),
    ))).toBe('ANALYSIS_KEY_INVALID')
  })

  it('refuses more waveform detail than a screen can draw', () => {
    expect(refusalCode(() => parseAnalysisRequest(
      'waveform-block',
      params(`${VALID}&sourceTicks=0&spanTicks=${PROJECT_TIMESCALE}&peakCount=${MAX_PEAK_COUNT + 1}`),
    ))).toBe('ANALYSIS_KEY_INVALID')
  })

  it('refuses a stretch of sound longer than one request may cover', () => {
    // This is the bound that keeps memory tied to what is on screen rather than
    // to how long the user's music is.
    expect(refusalCode(() => parseAnalysisRequest(
      'waveform-block',
      params(`${VALID}&sourceTicks=0&spanTicks=${MAX_WAVEFORM_SPAN_TICKS + 1}&peakCount=64`),
    ))).toBe('ANALYSIS_KEY_INVALID')
  })

  it('accepts a bounded, exact source interval for loudness normalization', () => {
    const request = parseAnalysisRequest(
      'audio-normalization',
      params(`${VALID}&sourceStartTicks=1440000&sourceEndTicks=2880000`),
    )
    expect(request).toEqual({
      kind: 'audio-normalization',
      assetId: 'asset_aaaaaaaa',
      assetVersion: 'aaaaaaaaaaaaaaaa',
      sourceStartTicks: 1_440_000,
      sourceEndTicks: 2_880_000,
    })
  })

  it('refuses empty, tiny, reversed, or unbounded normalization intervals', () => {
    for (const [start, end] of [
      [0, 0],
      [100, 99],
      [0, MIN_NORMALIZATION_SPAN_TICKS - 1],
      [0, MAX_NORMALIZATION_SPAN_TICKS + 1],
    ]) {
      expect(refusalCode(() => parseAnalysisRequest(
        'audio-normalization',
        params(`${VALID}&sourceStartTicks=${start}&sourceEndTicks=${end}`),
      ))).toBe('ANALYSIS_KEY_INVALID')
    }
  })

  it('accepts an exact backwards-preview interval up to thirty seconds', () => {
    const request = parseAnalysisRequest(
      'reverse-preview',
      params(`${VALID}&sourceStartTicks=1440000&sourceEndTicks=${1_440_000 + MAX_REVERSE_PREVIEW_SPAN_TICKS}`),
    )
    expect(request).toEqual({
      kind: 'reverse-preview',
      assetId: 'asset_aaaaaaaa',
      assetVersion: 'aaaaaaaaaaaaaaaa',
      sourceStartTicks: 1_440_000,
      sourceEndTicks: 1_440_000 + MAX_REVERSE_PREVIEW_SPAN_TICKS,
    })
    expect(analysisRequestId(request)).toContain('ffmpeg-reverse-preview-v1')
  })

  it('refuses empty, tiny, reversed, or over-thirty-second reverse previews', () => {
    for (const [start, end] of [
      [0, 0],
      [100, 99],
      [0, MIN_REVERSE_PREVIEW_SPAN_TICKS - 1],
      [0, MAX_REVERSE_PREVIEW_SPAN_TICKS + 1],
    ]) {
      expect(refusalCode(() => parseAnalysisRequest(
        'reverse-preview',
        params(`${VALID}&sourceStartTicks=${start}&sourceEndTicks=${end}`),
      ))).toBe('ANALYSIS_KEY_INVALID')
    }
  })

  it('refuses a repeated value rather than picking one of them', () => {
    expect(refusalCode(() => parseAnalysisRequest(
      'filmstrip-frame',
      params(`${VALID}&sourceTicks=0&sourceTicks=99&width=64`),
    ))).toBe('ANALYSIS_KEY_INVALID')
  })
})

describe('naming the answer', () => {
  it('gives the same request the same name every time', () => {
    const one = parseAnalysisRequest('filmstrip-frame', params(`${VALID}&sourceTicks=720000&width=64`))
    const two = parseAnalysisRequest('filmstrip-frame', params(`${VALID}&sourceTicks=720000&width=64`))
    expect(analysisRequestId(one)).toBe(analysisRequestId(two))
    expect(analysisCacheName(one)).toBe(analysisCacheName(two))
  })

  it('gives different bytes of the same file different names', () => {
    // This is what makes a replaced file impossible to serve stale.
    const first = parseAnalysisRequest('filmstrip-frame', params(`${VALID}&sourceTicks=0&width=64`))
    const second = parseAnalysisRequest(
      'filmstrip-frame',
      params('assetId=asset_aaaaaaaa&assetVersion=bbbbbbbbbbbbbbbb&sourceTicks=0&width=64'),
    )
    expect(analysisRequestId(first)).not.toBe(analysisRequestId(second))
  })

  it('keys normalization by exact bytes, exact interval, and analysis version', () => {
    const first = parseAnalysisRequest(
      'audio-normalization',
      params(`${VALID}&sourceStartTicks=0&sourceEndTicks=${PROJECT_TIMESCALE}`),
    )
    const later = parseAnalysisRequest(
      'audio-normalization',
      params(`${VALID}&sourceStartTicks=${PROJECT_TIMESCALE}&sourceEndTicks=${2 * PROJECT_TIMESCALE}`),
    )
    expect(analysisRequestId(first)).toContain('ffmpeg-loudnorm-v1')
    expect(analysisRequestId(first)).not.toBe(analysisRequestId(later))
  })

  it('puts nothing a person typed into a filename', () => {
    const request = parseAnalysisRequest('filmstrip-frame', params(`${VALID}&sourceTicks=0&width=64`))
    expect(analysisCacheName(request)).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('the moment handed to the decoder', () => {
  it('is exact rather than rounded to a coarser clock', () => {
    // One tick is 1/1,440,000 of a second. Rounding to milliseconds here drifts
    // far enough on a long recording to show the wrong frame.
    expect(ticksToSeconds(PROJECT_TIMESCALE)).toBe('1.000000000')
    expect(ticksToSeconds(1)).toBe('0.000000694')
    expect(ticksToSeconds(0)).toBe('0.000000000')
  })
})
