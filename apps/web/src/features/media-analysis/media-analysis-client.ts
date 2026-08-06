import {
  MEDIA_ANALYSIS_SCHEMA_VERSION,
  type MediaAnalysisKeyV1,
} from './media-analysis-key'

/**
 * Asking the local server for one piece of derived media.
 *
 * This module knows how to WORD the question and how to read the answer. It
 * knows nothing about caching, about how many questions may be asked at once, or
 * about what is on screen — those belong to the controller next door, so there
 * is one place that decides how much work happens and one place that decides how
 * to ask.
 */

/** Why a piece of derived media could not be made. Always one of a closed set. */
export type AnalysisRefusal = Readonly<{
  code: string
  /** A plain sentence for a person. Never a path and never decoder output. */
  message: string
}>

/**
 * The complete life of one piece of derived media, as four possible states.
 *
 * `missing` and `error` are deliberately different. Missing means the file the
 * project points at is not there any more — the user has to do something about
 * it. Error means the attempt failed and trying again may well work. Collapsing
 * them into one state would tell somebody their footage was gone when the disk
 * was merely busy for a second.
 */
export type DerivedMediaResource<T> =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; value: T }>
  | Readonly<{ status: 'missing' }>
  | Readonly<{ status: 'error'; refusal: AnalysisRefusal }>

export const IDLE_RESOURCE: DerivedMediaResource<never> = Object.freeze({ status: 'idle' })
export const LOADING_RESOURCE: DerivedMediaResource<never> = Object.freeze({ status: 'loading' })
export const MISSING_RESOURCE: DerivedMediaResource<never> = Object.freeze({ status: 'missing' })

/** Codes that mean "the file is not there", as opposed to "that did not work". */
const MISSING_CODES: readonly string[] = Object.freeze([
  'ASSET_MISSING',
  'ASSET_NOT_FOUND',
  'PROJECT_NOT_FOUND',
])

export const isMissingRefusal = (code: string): boolean => MISSING_CODES.includes(code)

/**
 * The address for one piece of derived media.
 *
 * Every part of the name goes into the address, including WHICH BYTES the file
 * holds. That is what lets the answer be cached hard: the same address can never
 * describe two different pictures, so nothing has to guess when to throw a
 * cached one away.
 */
export const analysisRequestUrl = (projectId: string, key: MediaAnalysisKeyV1): string => {
  const base = `/api/projects/${encodeURIComponent(projectId)}/media-analysis`
  const shared = `assetId=${encodeURIComponent(key.assetId)}&assetVersion=${encodeURIComponent(key.assetVersion)}`
  if (key.kind === 'image-thumbnail') {
    return `${base}/image-thumbnail?${shared}&width=${key.resolution}&height=${key.resolution}`
  }
  if (key.kind === 'filmstrip-frame') {
    return `${base}/frame?${shared}&sourceTicks=${key.sourceTicks}&width=${key.resolution}`
  }
  return `${base}/waveform?${shared}&sourceTicks=${key.sourceTicks}&spanTicks=${key.spanTicks}&peakCount=${key.resolution}`
}

export const normalizationRequestUrl = (
  projectId: string,
  request: AudioNormalizationRequestV1,
): string => {
  const base = `/api/projects/${encodeURIComponent(projectId)}/media-analysis/normalization`
  return `${base}?assetId=${encodeURIComponent(request.assetId)}`
    + `&assetVersion=${encodeURIComponent(request.assetVersion)}`
    + `&sourceStartTicks=${request.sourceStartTicks}`
    + `&sourceEndTicks=${request.sourceEndTicks}`
}

export class AnalysisRefusalError extends Error {
  readonly refusal: AnalysisRefusal
  constructor(refusal: AnalysisRefusal) {
    super(refusal.message)
    this.refusal = refusal
    this.name = 'AnalysisRefusalError'
  }
}

/**
 * How a picture becomes something that can be drawn.
 *
 * Injected rather than called directly so that the request path can be tested
 * without a real browser image decoder, and so a future `WebCodecs` path can be
 * dropped in without touching anything else.
 */
export type ImageDecoder = (blob: Blob) => Promise<ImageBitmap>

export const defaultImageDecoder: ImageDecoder = (blob) => createImageBitmap(blob)

export const AUDIO_NORMALIZATION_SCHEMA_VERSION = 'sanverse.audio-normalization-evidence/v1' as const

export type AudioNormalizationEvidenceV1 = Readonly<{
  schemaVersion: typeof AUDIO_NORMALIZATION_SCHEMA_VERSION
  assetId: string
  assetVersion: string
  sourceStartTicks: number
  sourceEndTicks: number
  analysisVersion: string
  integratedLufs: number
  loudnessRangeLufs: number
  truePeakDb: number
  recommendedGainDb: number
  targetIntegratedLufs: number
  targetTruePeakDb: number
}>

export type AudioNormalizationRequestV1 = Readonly<{
  assetId: string
  assetVersion: string
  sourceStartTicks: number
  sourceEndTicks: number
}>

export type ReversePreviewRequestV1 = Readonly<{
  assetId: string
  assetVersion: string
  sourceStartTicks: number
  sourceEndTicks: number
}>

export const reversePreviewRequestUrl = (
  projectId: string,
  request: ReversePreviewRequestV1,
): string => {
  const base = `/api/projects/${encodeURIComponent(projectId)}/media-analysis/reverse`
  const params = new URLSearchParams({
    assetId: request.assetId,
    assetVersion: request.assetVersion,
    sourceStartTicks: String(request.sourceStartTicks),
    sourceEndTicks: String(request.sourceEndTicks),
  })
  return `${base}?${params.toString()}`
}

export type MediaAnalysisClient = Readonly<{
  picture(projectId: string, key: MediaAnalysisKeyV1, signal: AbortSignal): Promise<ImageBitmap>
  peaks(projectId: string, key: MediaAnalysisKeyV1, signal: AbortSignal): Promise<readonly number[]>
  normalization?(
    projectId: string,
    request: AudioNormalizationRequestV1,
    signal: AbortSignal,
  ): Promise<AudioNormalizationEvidenceV1>
  reversePreview?(
    projectId: string,
    request: ReversePreviewRequestV1,
    signal: AbortSignal,
  ): Promise<Blob>
}>

type Fetcher = (input: string, init: { signal: AbortSignal }) => Promise<Response>

const refusalFrom = async (response: Response): Promise<AnalysisRefusal> => {
  // A refusal that cannot be read is still a refusal. The status alone is
  // enough to act on, so a broken body must not turn into a thrown surprise.
  const fallback: AnalysisRefusal = Object.freeze({
    code: response.status === 404 ? 'ASSET_NOT_FOUND' : 'DECODER_FAILED',
    message: 'That preview could not be made.',
  })
  try {
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null) return fallback
    const record = body as { code?: unknown; error?: unknown }
    return Object.freeze({
      code: typeof record.code === 'string' ? record.code : fallback.code,
      message: typeof record.error === 'string' ? record.error : fallback.message,
    })
  } catch {
    return fallback
  }
}

export const createMediaAnalysisClient = (options: Readonly<{
  fetchImpl?: Fetcher
  decodeImage?: ImageDecoder
}> = {}): MediaAnalysisClient => {
  const fetchImpl: Fetcher = options.fetchImpl
    ?? ((input, init) => fetch(input, init))
  const decodeImage = options.decodeImage ?? defaultImageDecoder

  return Object.freeze({
    async picture(projectId, key, signal) {
      const response = await fetchImpl(analysisRequestUrl(projectId, key), { signal })
      if (!response.ok) throw new AnalysisRefusalError(await refusalFrom(response))
      const blob = await response.blob()
      // Decoded straight from the response body. The blob is not kept, and no
      // object URL is created for it — an object URL that is never revoked is
      // the classic way a page holds on to megabytes it has finished with.
      return decodeImage(blob)
    },

    async peaks(projectId, key, signal) {
      const response = await fetchImpl(analysisRequestUrl(projectId, key), { signal })
      if (!response.ok) throw new AnalysisRefusalError(await refusalFrom(response))
      const body: unknown = await response.json()
      const parsed = parseWaveformBlock(body)
      if (parsed === null) {
        throw new AnalysisRefusalError(Object.freeze({
          code: 'ANALYSIS_CACHE_CORRUPT',
          message: 'The sound shape came back in a form this editor does not understand.',
        }))
      }
      return parsed
    },

    async normalization(projectId, request, signal) {
      const response = await fetchImpl(normalizationRequestUrl(projectId, request), { signal })
      if (!response.ok) throw new AnalysisRefusalError(await refusalFrom(response))
      const body: unknown = await response.json()
      const parsed = parseAudioNormalizationEvidence(body)
      if (
        parsed === null ||
        parsed.assetId !== request.assetId ||
        parsed.assetVersion !== request.assetVersion ||
        parsed.sourceStartTicks !== request.sourceStartTicks ||
        parsed.sourceEndTicks !== request.sourceEndTicks
      ) {
        throw new AnalysisRefusalError(Object.freeze({
          code: 'ANALYSIS_CACHE_CORRUPT',
          message: 'The loudness measurement came back in a form this editor does not understand.',
        }))
      }
      return parsed
    },

    async reversePreview(projectId, request, signal) {
      const response = await fetchImpl(reversePreviewRequestUrl(projectId, request), { signal })
      if (!response.ok) throw new AnalysisRefusalError(await refusalFrom(response))
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
      const blob = await response.blob()
      if (contentType !== 'video/mp4' || blob.size <= 0 || blob.size > 4 * 1024 * 1024) {
        throw new AnalysisRefusalError(Object.freeze({
          code: 'ANALYSIS_CACHE_CORRUPT',
          message: 'The backwards preview came back in a form this editor does not understand.',
        }))
      }
      return blob
    },
  })
}

/**
 * Read the loudness numbers back, refusing anything that is not exactly what
 * was promised.
 *
 * Numbers that are drawn without being checked are how a waveform ends up
 * spilling out of its lane, or drawing upside down. Every value has to be a real
 * number between 0 and 1.
 */
export const parseWaveformBlock = (value: unknown): readonly number[] | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (record.schemaVersion !== 'sanverse.waveform-block/v1') return null
  if (!Array.isArray(record.peaks) || record.peaks.length === 0) return null
  const peaks: number[] = []
  for (const entry of record.peaks) {
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 1) return null
    peaks.push(entry)
  }
  return Object.freeze(peaks)
}

export const parseAudioNormalizationEvidence = (value: unknown): AudioNormalizationEvidenceV1 | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const expectedKeys = [
    'schemaVersion', 'assetId', 'assetVersion', 'sourceStartTicks', 'sourceEndTicks',
    'analysisVersion', 'integratedLufs', 'loudnessRangeLufs', 'truePeakDb',
    'recommendedGainDb', 'targetIntegratedLufs', 'targetTruePeakDb',
  ] as const
  const keys = Object.keys(record)
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key as typeof expectedKeys[number]))) return null
  if (record.schemaVersion !== AUDIO_NORMALIZATION_SCHEMA_VERSION) return null
  if (typeof record.assetId !== 'string' || typeof record.assetVersion !== 'string' || typeof record.analysisVersion !== 'string') return null
  if (!Number.isSafeInteger(record.sourceStartTicks) || !Number.isSafeInteger(record.sourceEndTicks)) return null
  if ((record.sourceStartTicks as number) < 0 || (record.sourceEndTicks as number) <= (record.sourceStartTicks as number)) return null
  const finite = (entry: unknown): entry is number => typeof entry === 'number' && Number.isFinite(entry)
  if (!finite(record.integratedLufs) || !finite(record.loudnessRangeLufs)) return null
  if (!finite(record.truePeakDb) || !finite(record.recommendedGainDb) || !finite(record.targetIntegratedLufs) || !finite(record.targetTruePeakDb)) return null
  return Object.freeze({
    schemaVersion: AUDIO_NORMALIZATION_SCHEMA_VERSION,
    assetId: record.assetId,
    assetVersion: record.assetVersion,
    sourceStartTicks: record.sourceStartTicks as number,
    sourceEndTicks: record.sourceEndTicks as number,
    analysisVersion: record.analysisVersion,
    integratedLufs: record.integratedLufs,
    loudnessRangeLufs: record.loudnessRangeLufs,
    truePeakDb: record.truePeakDb,
    recommendedGainDb: record.recommendedGainDb,
    targetIntegratedLufs: record.targetIntegratedLufs,
    targetTruePeakDb: record.targetTruePeakDb,
  })
}

/** Kept beside the client so the two things that must agree sit together. */
export const ANALYSIS_KEY_SCHEMA = MEDIA_ANALYSIS_SCHEMA_VERSION
