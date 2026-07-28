import { describe, expect, it, vi } from 'vitest'
import { TRANSCRIPT_SCHEMA_VERSION } from '@sanverse/edit-domain'

import {
  NullTranscriptionAdapter,
  createFakeTranscriptionAdapter,
  type TranscriptionProviderPort,
} from './transcription-port.ts'
import { DEFAULT_TRANSCRIPTION_CONFIG, transcribeMedia } from './transcription-service.ts'

const ASSET_ID = 'asset_aaaaaaaa'
const TRANSCRIPT_ID = 'transcript_aaaaaaaa'

const request = { mediaRef: 'project/x/source', languageHint: 'en', durationSeconds: 30 }

const goodReply = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
  transcriptId: TRANSCRIPT_ID,
  assetId: ASSET_ID,
  language: 'en',
  source: 'transcription',
  segments: [{
    segmentId: 'tseg_0001',
    interval: { start: { ticks: 0, timescale: 1_440_000 }, duration: { ticks: 1_440_000, timescale: 1_440_000 } },
    text: 'hello',
    words: [{
      text: 'hello',
      interval: { start: { ticks: 0, timescale: 1_440_000 }, duration: { ticks: 720_000, timescale: 1_440_000 } },
      confidence: 0.9,
    }],
    speaker: null,
  }],
  ...overrides,
})

const withProvider = (provider: TranscriptionProviderPort, allow = true) => ({
  ...DEFAULT_TRANSCRIPTION_CONFIG,
  provider,
  userAllowsSendingMediaOffMachine: allow,
})

describe('the transcription boundary', () => {
  it('ships switched off, and says so in plain words', async () => {
    const result = await transcribeMedia(request, ASSET_ID, TRANSCRIPT_ID)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('TRANSCRIPTION_DISABLED')
    expect(result.error.message).toContain('transcript file')
  })

  it('the shipped adapter makes no network call', async () => {
    expect(NullTranscriptionAdapter.sendsMediaOffMachine).toBe(false)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await transcribeMedia(request, ASSET_ID, TRANSCRIPT_ID)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('accepts a well-formed reply', async () => {
    const provider = createFakeTranscriptionAdapter(() => goodReply())
    const result = await transcribeMedia(request, ASSET_ID, TRANSCRIPT_ID, withProvider(provider))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.source).toBe('transcription')
  })

  it('refuses to send media away when the user has not allowed it', async () => {
    const called = vi.fn(() => goodReply())
    const remote: TranscriptionProviderPort = {
      name: 'remote',
      sendsMediaOffMachine: true,
      transcribe: async () => called(),
    }
    const result = await transcribeMedia(request, ASSET_ID, TRANSCRIPT_ID, withProvider(remote, false))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('TRANSCRIPTION_DISABLED')
    // Consent is checked BEFORE the adapter runs, not after.
    expect(called).not.toHaveBeenCalled()
  })

  it('refuses a reply describing a different video', async () => {
    // Otherwise this video gets captioned with another video's words.
    const provider = createFakeTranscriptionAdapter(() => goodReply({ assetId: 'asset_bbbbbbbb' }))
    const result = await transcribeMedia(request, ASSET_ID, TRANSCRIPT_ID, withProvider(provider))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('TRANSCRIPTION_REJECTED')
    expect(result.error.message).toContain('different video')
  })

  it('refuses a remote reply pretending to be a local file', async () => {
    const provider = createFakeTranscriptionAdapter(() => goodReply({ source: 'sidecar' }))
    const result = await transcribeMedia(request, ASSET_ID, TRANSCRIPT_ID, withProvider(provider))
    expect(result.ok).toBe(false)
  })

  it('refuses a reply that is not a transcript at all', async () => {
    const provider = createFakeTranscriptionAdapter(() => ({ words: 'hello world' }))
    const result = await transcribeMedia(request, ASSET_ID, TRANSCRIPT_ID, withProvider(provider))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('TRANSCRIPTION_REJECTED')
  })

  it('never lets a provider error message reach the user', async () => {
    const provider: TranscriptionProviderPort = {
      name: 'leaky',
      sendsMediaOffMachine: false,
      transcribe: async () => { throw new Error('api key sk-secret123 rejected by host') },
    }
    const result = await transcribeMedia(request, ASSET_ID, TRANSCRIPT_ID, withProvider(provider))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).not.toContain('sk-secret123')
    expect(result.error.code).toBe('TRANSCRIPTION_UNAVAILABLE')
  })

  it('gives up on a provider that never answers', async () => {
    const provider: TranscriptionProviderPort = {
      name: 'slow',
      sendsMediaOffMachine: false,
      transcribe: (_request, options) => new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }),
    }
    const result = await transcribeMedia(
      request, ASSET_ID, TRANSCRIPT_ID,
      { ...withProvider(provider), timeoutMs: 20 },
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('TRANSCRIPTION_TIMEOUT')
  })

  it('hands the adapter a reference, never a path or a project', async () => {
    let seen: unknown
    const provider = createFakeTranscriptionAdapter((incoming) => {
      seen = incoming
      return goodReply()
    })
    await transcribeMedia(request, ASSET_ID, TRANSCRIPT_ID, withProvider(provider))
    expect(Object.keys(seen as object).sort()).toEqual(['durationSeconds', 'languageHint', 'mediaRef'])
  })
})
