import { describe, expect, it } from 'vitest'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

import {
  assetVersionFromSha256,
  filmstripFrameKey,
  imageThumbnailKey,
  MEDIA_ANALYSIS_KINDS,
  mediaAnalysisKeyId,
  parseMediaAnalysisKey,
  waveformBlockKey,
} from './media-analysis-key'
import {
  analysisRequestUrl,
  createMediaAnalysisClient,
  normalizationRequestUrl,
  parseAudioNormalizationEvidence,
  reversePreviewRequestUrl,
  parseWaveformBlock,
} from './media-analysis-client'

/**
 * Gate D — that a piece of derived media can only ever be found by the exact
 * thing it describes.
 *
 * The failure this prevents is the worst kind: a picture of the OLD footage
 * shown under a clip that now holds new footage. It looks completely plausible,
 * so nobody notices until they cut using it.
 */

const T = PROJECT_TIMESCALE
const A = 'a'.repeat(16)
const B = 'b'.repeat(16)
const NORMALIZATION_REQUEST = Object.freeze({
  assetId: 'asset_aaaaaaaa',
  assetVersion: A,
  sourceStartTicks: T,
  sourceEndTicks: 3 * T,
})
const NORMALIZATION_EVIDENCE = Object.freeze({
  schemaVersion: 'sanverse.audio-normalization-evidence/v1',
  ...NORMALIZATION_REQUEST,
  analysisVersion: 'ffmpeg-loudnorm-v1',
  integratedLufs: -23.2,
  loudnessRangeLufs: 4.1,
  truePeakDb: -7.5,
  recommendedGainDb: 6.5,
  targetIntegratedLufs: -16,
  targetTruePeakDb: -1,
})

describe('which bytes a name refers to', () => {
  it('takes the version from the file checksum the project already records', () => {
    expect(assetVersionFromSha256('f'.repeat(64))).toBe('f'.repeat(16))
  })

  it('refuses anything that is not a checksum, rather than inventing one', () => {
    expect(assetVersionFromSha256('short')).toBe('')
    expect(assetVersionFromSha256('Z'.repeat(64))).toBe('')
    expect(assetVersionFromSha256('')).toBe('')
  })

  it('carries no path, no URL, and nothing a person typed', () => {
    const version = assetVersionFromSha256('0123456789abcdef'.repeat(4))
    expect(version).toMatch(/^[a-f0-9]{16}$/)
  })

  it('gives the same file with different bytes a different name', () => {
    const before = filmstripFrameKey({ assetId: 'asset_x', assetVersion: A, sourceTicks: T, widthPx: 64 })
    const after = filmstripFrameKey({ assetId: 'asset_x', assetVersion: B, sourceTicks: T, widthPx: 64 })
    expect(mediaAnalysisKeyId(before)).not.toBe(mediaAnalysisKeyId(after))
  })
})

describe('the closed list of things that can be derived', () => {
  it('is exactly three kinds', () => {
    expect([...MEDIA_ANALYSIS_KINDS]).toEqual(['filmstrip-frame', 'waveform-block', 'image-thumbnail'])
  })

  it('gives a picture a name with no moment in it, because a picture has none', () => {
    const key = imageThumbnailKey({ assetId: 'asset_p', assetVersion: A, widthPx: 64 })
    expect(key.sourceTicks).toBe(0)
    expect(key.spanTicks).toBe(0)
    expect(key.kind).toBe('image-thumbnail')
  })

  it('keeps a picture and a video frame of the same file apart', () => {
    expect(mediaAnalysisKeyId(imageThumbnailKey({ assetId: 'asset_p', assetVersion: A, widthPx: 64 })))
      .not.toBe(mediaAnalysisKeyId(filmstripFrameKey({ assetId: 'asset_p', assetVersion: A, sourceTicks: 0, widthPx: 64 })))
  })
})

describe('reading a name back from somewhere less trusted', () => {
  const valid = {
    schemaVersion: 'sanverse.media-analysis/v1',
    kind: 'filmstrip-frame',
    assetId: 'asset_aaaaaaaa',
    assetVersion: A,
    sourceTicks: 0,
    spanTicks: 0,
    resolution: 64,
  }

  it('accepts one that is exactly right', () => {
    expect(parseMediaAnalysisKey(valid)).not.toBeNull()
  })

  it('refuses an unknown kind', () => {
    expect(parseMediaAnalysisKey({ ...valid, kind: 'spectrogram' })).toBeNull()
  })

  it('refuses an extra field rather than ignoring it', () => {
    expect(parseMediaAnalysisKey({ ...valid, path: '../secrets' })).toBeNull()
  })

  it('refuses a missing field', () => {
    const { assetVersion: _dropped, ...withoutVersion } = valid
    expect(parseMediaAnalysisKey(withoutVersion)).toBeNull()
  })

  it('refuses numbers that are not whole and not positive', () => {
    expect(parseMediaAnalysisKey({ ...valid, sourceTicks: -1 })).toBeNull()
    expect(parseMediaAnalysisKey({ ...valid, sourceTicks: 1.5 })).toBeNull()
    expect(parseMediaAnalysisKey({ ...valid, resolution: 0 })).toBeNull()
  })

  it('refuses a picture that claims to have a moment', () => {
    expect(parseMediaAnalysisKey({ ...valid, kind: 'image-thumbnail', sourceTicks: 5 })).toBeNull()
  })

  it('refuses a stretch of sound with no length', () => {
    expect(parseMediaAnalysisKey({ ...valid, kind: 'waveform-block', spanTicks: 0 })).toBeNull()
  })

  it('refuses an older or newer schema', () => {
    expect(parseMediaAnalysisKey({ ...valid, schemaVersion: 'sanverse.media-analysis/v2' })).toBeNull()
  })
})

describe('the address a name becomes', () => {
  it('puts every part of the name into it, and nothing else', () => {
    expect(analysisRequestUrl('project_a', filmstripFrameKey({
      assetId: 'asset_x', assetVersion: A, sourceTicks: 2 * T, widthPx: 64,
    }))).toBe('/api/projects/project_a/media-analysis/frame?assetId=asset_x&assetVersion=aaaaaaaaaaaaaaaa&sourceTicks=2880000&width=64')
  })

  it('asks for sound at its own address, with its length and its detail', () => {
    expect(analysisRequestUrl('project_a', waveformBlockKey({
      assetId: 'asset_m', assetVersion: B, sourceTicks: 3 * T, peaksPerBlock: 64,
    }))).toContain('/media-analysis/waveform?assetId=asset_m&assetVersion=bbbbbbbbbbbbbbbb&sourceTicks=4320000&spanTicks=1440000&peakCount=64')
  })

  it('names normalization by exact source interval and file bytes', () => {
    expect(normalizationRequestUrl('project_a', NORMALIZATION_REQUEST)).toBe(
      '/api/projects/project_a/media-analysis/normalization?assetId=asset_aaaaaaaa&assetVersion=aaaaaaaaaaaaaaaa&sourceStartTicks=1440000&sourceEndTicks=4320000',
    )
  })

  it('names a backwards proxy by exact source interval and file bytes', () => {
    expect(reversePreviewRequestUrl('project_a', NORMALIZATION_REQUEST)).toBe(
      '/api/projects/project_a/media-analysis/reverse?assetId=asset_aaaaaaaa&assetVersion=aaaaaaaaaaaaaaaa&sourceStartTicks=1440000&sourceEndTicks=4320000',
    )
  })
})

describe('reading loudness numbers back off the wire', () => {
  it('accepts a well-formed block', () => {
    expect(parseWaveformBlock({
      schemaVersion: 'sanverse.waveform-block/v1',
      peaks: [0, 0.5, 1],
    })).toEqual([0, 0.5, 1])
  })

  it('refuses numbers that would draw outside the lane', () => {
    // Drawn unchecked, these spill out of the row or draw upside down.
    expect(parseWaveformBlock({ schemaVersion: 'sanverse.waveform-block/v1', peaks: [1.4] })).toBeNull()
    expect(parseWaveformBlock({ schemaVersion: 'sanverse.waveform-block/v1', peaks: [-0.2] })).toBeNull()
    expect(parseWaveformBlock({ schemaVersion: 'sanverse.waveform-block/v1', peaks: ['loud'] })).toBeNull()
  })

  it('refuses a body of another shape entirely', () => {
    expect(parseWaveformBlock({ peaks: [0.5] })).toBeNull()
    expect(parseWaveformBlock(null)).toBeNull()
    expect(parseWaveformBlock([0.5])).toBeNull()
  })
})

describe('reading a prepared backwards preview off the wire', () => {
  it('accepts only a bounded MP4 response', async () => {
    const bytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])
    const client = createMediaAnalysisClient({
      fetchImpl: async () => new Response(bytes, { status: 200, headers: { 'content-type': 'video/mp4' } }),
    })
    const result = await client.reversePreview?.('project_a', NORMALIZATION_REQUEST, new AbortController().signal)
    expect(result).toBeInstanceOf(Blob)
    expect(result?.size).toBe(bytes.byteLength)
    expect(result?.type).toBe('video/mp4')
  })

  it('refuses the wrong media type instead of attaching it to the video element', async () => {
    const client = createMediaAnalysisClient({
      fetchImpl: async () => new Response('not video', { status: 200, headers: { 'content-type': 'text/plain' } }),
    })
    await expect(client.reversePreview?.('project_a', NORMALIZATION_REQUEST, new AbortController().signal))
      .rejects.toMatchObject({ refusal: { code: 'ANALYSIS_CACHE_CORRUPT' } })
  })
})

describe('reading normalization evidence back off the wire', () => {
  it('accepts only the exact, finite evidence contract', () => {
    expect(parseAudioNormalizationEvidence(NORMALIZATION_EVIDENCE)).toEqual(NORMALIZATION_EVIDENCE)
    expect(parseAudioNormalizationEvidence({ ...NORMALIZATION_EVIDENCE, integratedLufs: Number.NaN })).toBeNull()
    expect(parseAudioNormalizationEvidence({ ...NORMALIZATION_EVIDENCE, extra: 'field' })).toBeNull()
    expect(parseAudioNormalizationEvidence({ ...NORMALIZATION_EVIDENCE, sourceEndTicks: T })).toBeNull()
  })

  it('rejects valid-looking evidence for a different source interval', async () => {
    const client = createMediaAnalysisClient({
      fetchImpl: async () => new Response(JSON.stringify({
        ...NORMALIZATION_EVIDENCE,
        sourceStartTicks: 0,
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    })
    expect(client.normalization).toBeTypeOf('function')
    await expect(client.normalization?.('project_a', NORMALIZATION_REQUEST, new AbortController().signal))
      .rejects.toMatchObject({ refusal: { code: 'ANALYSIS_CACHE_CORRUPT' } })
  })
})
