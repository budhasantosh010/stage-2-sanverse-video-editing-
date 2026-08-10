import { describe, expect, it } from 'vitest'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import {
  B1_FIXTURE_PROVENANCE,
  DeterministicTranscriptSemanticAnalyzer,
  PRODUCT_LAUNCH_SOURCE,
  PRODUCT_LAUNCH_TRANSCRIPT,
  analyzeVideoUnderstanding,
  createProductLaunchUnderstandingFixture,
  normalizeTranscriptSegments,
  parseSrtOrVttTranscript,
  parseVideoUnderstanding,
  projectSourceUnderstandingTimeline,
  serializeVideoUnderstanding,
  transcriptFromStructuredJson,
  validateVideoUnderstanding,
} from './index.ts'

const t = (seconds: number) => Math.round(seconds * PROJECT_TIMESCALE)

describe('B1 transcript ingestion and normalization', () => {
  it('uses the canonical Sanverse tick authority for structured input', () => {
    const result = transcriptFromStructuredJson([{ startSeconds: 1.5, endSeconds: 2.75, text: '  hello   world  ' }], 'provenance:transcript-import:v1')
    expect(result[0]).toMatchObject({ startTicks: t(1.5), endTicks: t(2.75), text: 'hello world' })
  })
  it('parses SRT and VTT timing without making milliseconds authoritative', () => {
    const source = `WEBVTT\n\n00:00:04.000 --> 00:00:08.500\nOur agent completes 68% automatically.\n\n00:00:15,000 --> 00:00:18,000\nTry it now.`
    const result = parseSrtOrVttTranscript(source, 'provenance:transcript-import:v1')
    expect(result).toHaveLength(2)
    expect(result[0]?.startTicks).toBe(t(4))
    expect(result[0]?.endTicks).toBe(t(8.5))
  })
  it('preserves optional word timing and normalizes text only', () => {
    const result = normalizeTranscriptSegments([{ id: 's1', startTicks: 0, endTicks: t(2), text: '  Keep   meaning. ', provenance: 'p1', words: [{ id: 'w1', startTicks: 0, endTicks: t(1), text: ' Keep ', confidence: .9 }] }])
    expect(result[0]?.text).toBe('Keep meaning.')
    expect(result[0]?.words?.[0]).toMatchObject({ id: 'w1', text: 'Keep', confidence: .9 })
  })
})

describe('B1 deterministic semantic analysis', () => {
  const analyze = async (text: string) => new DeterministicTranscriptSemanticAnalyzer().analyze({ source: PRODUCT_LAUNCH_SOURCE, transcript: transcriptFromStructuredJson([{ startSeconds: 1, endSeconds: 3, text }], 'provenance:transcript-import:v1') })
  it('detects percentages conservatively', async () => expect((await analyze('We now complete 65% of requests.')).map((m) => m.kind)).toContain('percentage'))
  it('detects money', async () => expect((await analyze('This costs $500 per project.')).map((m) => m.kind)).toContain('money'))
  it('detects explicit questions', async () => expect((await analyze('What if the workflow changed?')).map((m) => m.kind)).toContain('question'))
  it('detects comparisons and security language independently', async () => {
    const kinds = (await analyze('Your private workspace stays separate from your team workspace for security.')).map((m) => m.kind)
    expect(kinds).toContain('comparison'); expect(kinds).toContain('security')
  })
  it('detects process/list language and calls to action', async () => {
    const process = (await analyze("Here's how it works. First, open it. Second, review it.")).map((m) => m.kind)
    const cta = (await analyze('Try it on your next project and let us know.')).map((m) => m.kind)
    expect(process).toContain('process'); expect(cta).toContain('cta')
  })
  it('returns no fabricated semantic moment for ordinary neutral text', async () => expect(await analyze('The room is quiet today.')).toEqual([]))
})

describe('B1 document, validation, serialization and projection', () => {
  it('builds the original product-launch understanding with traceable semantic moments', async () => {
    const document = await createProductLaunchUnderstandingFixture()
    const validation = validateVideoUnderstanding(document)
    expect(validation.ok).toBe(true)
    expect(document.semanticMoments.some((moment) => moment.kind === 'percentage' && moment.value === 68)).toBe(true)
    expect(document.semanticMoments.some((moment) => moment.kind === 'feature')).toBe(true)
    expect(document.semanticMoments.some((moment) => moment.kind === 'security')).toBe(true)
    expect(document.semanticMoments.some((moment) => moment.kind === 'cta')).toBe(true)
    expect(document.visualRegions.some((region) => region.kind === 'screen-demo' && region.startTicks === t(32))).toBe(true)
  })
  it('round trips validated JSON without changing stable IDs or ticks', async () => {
    const document = await createProductLaunchUnderstandingFixture()
    expect(parseVideoUnderstanding(serializeVideoUnderstanding(document))).toEqual(document)
  })
  it('projects source understanding into five development lanes', async () => {
    const lanes = new Set(projectSourceUnderstandingTimeline(await createProductLaunchUnderstandingFixture()).map((item) => item.lane))
    expect([...lanes].sort()).toEqual(['semantics', 'shots', 'spatial', 'transcript', 'visual'])
  })
  it('allows partial shot coverage but rejects overlapping shots', async () => {
    const document = await createProductLaunchUnderstandingFixture()
    const broken = { ...document, shots: [...document.shots, { ...document.shots[0]!, id: 'shot:overlap', startTicks: t(2), endTicks: t(5) }] }
    const result = validateVideoUnderstanding(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((entry) => entry.code === 'CONFLICT')).toBe(true)
  })
  it('rejects invalid confidence and normalized bounds', async () => {
    const document = await createProductLaunchUnderstandingFixture()
    const broken = { ...document, spatialObservations: [{ ...document.spatialObservations[0]!, confidence: 2, bounds: { x: .8, y: .1, width: .4, height: .4 } }] }
    const result = validateVideoUnderstanding(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.map((entry) => entry.path).join(' ')).toContain('bounds')
  })
  it('rejects semantic references to missing transcript', async () => {
    const document = await createProductLaunchUnderstandingFixture()
    const broken = { ...document, semanticMoments: [{ ...document.semanticMoments[0]!, transcriptSegmentIds: ['missing'] }] }
    const result = validateVideoUnderstanding(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((entry) => entry.code === 'REFERENCE_INVALID')).toBe(true)
  })
  it('composes analyzers independently when some are absent', async () => {
    const document = await analyzeVideoUnderstanding({ source: PRODUCT_LAUNCH_SOURCE, transcript: PRODUCT_LAUNCH_TRANSCRIPT }, { semanticAnalyzer: new DeterministicTranscriptSemanticAnalyzer() }, B1_FIXTURE_PROVENANCE)
    expect(document.shots).toEqual([])
    expect(document.semanticMoments.length).toBeGreaterThan(0)
  })
})
