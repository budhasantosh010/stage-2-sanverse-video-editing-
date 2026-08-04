import { createHash } from 'node:crypto'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

/**
 * What the browser is allowed to ask for, and nothing else.
 *
 * ## Why the server parses this itself
 *
 * The browser has its own copy of these names (`media-analysis-key.ts`). This
 * is NOT that code imported — it is a separate, stricter reading of raw text
 * that arrived over the network. Sharing one parser would mean the server
 * trusted a shape the browser produced, and the browser is the one thing a
 * server may never trust: a page can be edited, a request can be replayed by
 * hand, and the same address will one day be reachable from something that is
 * not this editor at all.
 *
 * There is no risk of the two drifting apart, because they do not have to agree
 * on anything except the plain question being asked — which file, which moment,
 * how big. The browser's grid-snapping exists only so IT can reuse answers; the
 * server neither knows nor cares about the grid.
 *
 * ## The rule for every field
 *
 * Unknown field  → refused.
 * Missing field  → refused.
 * Out of range   → refused.
 *
 * Never repaired. A request that is quietly adjusted produces a picture whose
 * name no longer matches what it shows, and that is how the wrong frame ends up
 * under the right clip.
 */

export const ANALYSIS_REFUSAL_CODES = Object.freeze([
  'PROJECT_NOT_FOUND',
  'ASSET_NOT_FOUND',
  'ASSET_MISSING',
  'ASSET_KIND_UNSUPPORTED',
  'ANALYSIS_KEY_INVALID',
  'SOURCE_TIME_OUT_OF_RANGE',
  'ANALYSIS_LIMIT_EXCEEDED',
  'DECODER_UNAVAILABLE',
  'DECODER_FAILED',
  'ANALYSIS_CANCELLED',
  'ANALYSIS_CACHE_CORRUPT',
] as const)

export type AnalysisRefusalCode = (typeof ANALYSIS_REFUSAL_CODES)[number]

/**
 * A refusal the browser can act on, with NOTHING a caller could learn from.
 *
 * No filesystem path, no FFmpeg command text, no decoder diagnostic. Those go
 * to the local log at most; they never travel. A refusal is a code and one
 * plain sentence.
 */
export class AnalysisError extends Error {
  readonly code: AnalysisRefusalCode
  readonly status: number

  constructor(code: AnalysisRefusalCode, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
    this.name = 'AnalysisError'
  }
}

const refuse = (code: AnalysisRefusalCode, message: string, status: number): AnalysisError =>
  new AnalysisError(code, message, status)

export const analysisKeyInvalid = (message = 'That request for a preview picture is not valid.'): AnalysisError =>
  refuse('ANALYSIS_KEY_INVALID', message, 400)

export const ASSET_ID_PATTERN = /^asset_[a-z0-9]{8,64}$/
export const ASSET_VERSION_PATTERN = /^[a-f0-9]{16}$/

/**
 * How big a produced picture may be.
 *
 * A timeline thumbnail is drawn at well under 200 pixels wide. The ceiling is
 * generous enough for a high-density screen at maximum zoom and low enough that
 * a caller cannot ask the machine to render a poster-sized image thousands of
 * times. 640 × 640 at 4 bytes a pixel is about 1.6 MB in the worst case.
 */
export const MIN_ANALYSIS_PIXELS = 16
export const MAX_ANALYSIS_PIXELS = 640

/**
 * How many loudness numbers one block of sound may be summarised into.
 *
 * More than 256 across one second is finer than any screen can draw, so it
 * would be work and memory spent on detail nobody can see. This matches the
 * browser's own `MAX_PEAKS_PER_BLOCK` for the same reason, not by coupling.
 */
export const MAX_PEAK_COUNT = 256

/**
 * The longest stretch of sound one request may cover.
 *
 * Ten seconds. Sound is decoded into memory to be measured, so this is what
 * keeps memory tied to what is on screen instead of to how long the user's
 * music is. Ten seconds of stereo 48 kHz 16-bit is under 2 MB.
 */
export const MAX_WAVEFORM_SPAN_TICKS = 10 * PROJECT_TIMESCALE

export type AnalysisRequest =
  | Readonly<{
      kind: 'filmstrip-frame'
      assetId: string
      assetVersion: string
      sourceTicks: number
      widthPx: number
    }>
  | Readonly<{
      kind: 'image-thumbnail'
      assetId: string
      assetVersion: string
      widthPx: number
      heightPx: number
    }>
  | Readonly<{
      kind: 'waveform-block'
      assetId: string
      assetVersion: string
      sourceTicks: number
      spanTicks: number
      peakCount: number
    }>

/** A whole number written in plain decimal. No signs, no exponents, no spaces. */
const wholeNumber = (value: string | null): number | null => {
  if (value === null || !/^(0|[1-9]\d{0,15})$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

const bounded = (value: number | null, low: number, high: number): number | null =>
  value === null || value < low || value > high ? null : value

/**
 * Read one request out of a web address.
 *
 * The list of allowed names is closed and checked BEFORE anything is read, so a
 * request carrying an extra name is refused rather than having the extra name
 * silently ignored. An ignored parameter is how a caller comes to believe they
 * asked for something they did not get.
 */
export const parseAnalysisRequest = (
  kind: string,
  params: URLSearchParams,
): AnalysisRequest => {
  const allowedByKind: Readonly<Record<string, readonly string[]>> = Object.freeze({
    'filmstrip-frame': Object.freeze(['assetId', 'assetVersion', 'sourceTicks', 'width']),
    'image-thumbnail': Object.freeze(['assetId', 'assetVersion', 'width', 'height']),
    'waveform-block': Object.freeze(['assetId', 'assetVersion', 'sourceTicks', 'spanTicks', 'peakCount']),
  })
  const allowed = allowedByKind[kind]
  if (!allowed) throw analysisKeyInvalid('That kind of preview is not something this editor makes.')

  const seen = [...params.keys()]
  if (seen.length !== new Set(seen).size) throw analysisKeyInvalid('That request repeats a value.')
  if (seen.some((name) => !allowed.includes(name))) throw analysisKeyInvalid()
  if (allowed.some((name) => !params.has(name))) throw analysisKeyInvalid()

  const assetId = params.get('assetId') ?? ''
  const assetVersion = params.get('assetVersion') ?? ''
  if (!ASSET_ID_PATTERN.test(assetId)) throw analysisKeyInvalid()
  if (!ASSET_VERSION_PATTERN.test(assetVersion)) throw analysisKeyInvalid()

  if (kind === 'image-thumbnail') {
    const widthPx = bounded(wholeNumber(params.get('width')), MIN_ANALYSIS_PIXELS, MAX_ANALYSIS_PIXELS)
    const heightPx = bounded(wholeNumber(params.get('height')), MIN_ANALYSIS_PIXELS, MAX_ANALYSIS_PIXELS)
    if (widthPx === null || heightPx === null) throw analysisKeyInvalid('That preview size is outside what this editor makes.')
    return Object.freeze({ kind: 'image-thumbnail' as const, assetId, assetVersion, widthPx, heightPx })
  }

  const sourceTicks = wholeNumber(params.get('sourceTicks'))
  if (sourceTicks === null) throw analysisKeyInvalid()

  if (kind === 'filmstrip-frame') {
    const widthPx = bounded(wholeNumber(params.get('width')), MIN_ANALYSIS_PIXELS, MAX_ANALYSIS_PIXELS)
    if (widthPx === null) throw analysisKeyInvalid('That preview size is outside what this editor makes.')
    return Object.freeze({ kind: 'filmstrip-frame' as const, assetId, assetVersion, sourceTicks, widthPx })
  }

  const spanTicks = bounded(wholeNumber(params.get('spanTicks')), 1, MAX_WAVEFORM_SPAN_TICKS)
  const peakCount = bounded(wholeNumber(params.get('peakCount')), 1, MAX_PEAK_COUNT)
  if (spanTicks === null) throw analysisKeyInvalid('That stretch of sound is longer than one request may cover.')
  if (peakCount === null) throw analysisKeyInvalid('That level of waveform detail is outside what this editor makes.')
  return Object.freeze({ kind: 'waveform-block' as const, assetId, assetVersion, sourceTicks, spanTicks, peakCount })
}

/**
 * One string that means exactly this request and nothing else.
 *
 * Used both as the in-flight sharing key (two identical requests become one
 * job) and, hashed, as the name of the file on disk. Every field that changes
 * the ANSWER is in it; nothing that does not is.
 */
export const analysisRequestId = (request: AnalysisRequest): string => {
  if (request.kind === 'image-thumbnail') {
    return `image-thumbnail:${request.assetId}:${request.assetVersion}:${request.widthPx}x${request.heightPx}`
  }
  if (request.kind === 'filmstrip-frame') {
    return `filmstrip-frame:${request.assetId}:${request.assetVersion}:${request.sourceTicks}:${request.widthPx}`
  }
  return `waveform-block:${request.assetId}:${request.assetVersion}:${request.sourceTicks}:${request.spanTicks}:${request.peakCount}`
}

/**
 * The name of the file this request's answer is kept under.
 *
 * A HASH, never anything a person typed. A cache path built from a filename
 * would carry a user's characters into the filesystem, and a filesystem is
 * exactly where a stray `..` or a colon does damage. A hash is 64 characters of
 * `[a-f0-9]`, which is safe on every system this will ever run on.
 */
export const analysisCacheName = (request: AnalysisRequest): string =>
  createHash('sha256').update(analysisRequestId(request)).digest('hex')

/**
 * Exact whole ticks to the seconds FFmpeg wants, with no rounding to a coarser
 * clock on the way.
 *
 * The project counts in 1,440,000ths of a second. Nine decimal places is finer
 * than that, so the number FFmpeg receives is the exact moment the project
 * meant — not a moment rounded to milliseconds, which on a long recording drifts
 * far enough to show the wrong frame.
 */
export const ticksToSeconds = (ticks: number): string =>
  (ticks / PROJECT_TIMESCALE).toFixed(9)
