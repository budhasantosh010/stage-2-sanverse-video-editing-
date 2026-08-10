import { describe, expect, it } from 'vitest'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import {
  B1_FIXTURE_PROVENANCE,
  DeterministicTranscriptSemanticAnalyzer,
  analyzeVideoUnderstanding,
  createSyntheticTranscriptFixture,
  projectSourceUnderstandingTimeline,
  serializeVideoUnderstanding,
  validateVideoUnderstanding,
} from './index.ts'

interface B1PerfSample {
  readonly minutes: number
  readonly transcriptSegments: number
  readonly semanticMoments: number
  readonly analyzeMs: number
  readonly validateMs: number
  readonly serializeMs: number
  readonly projectMs: number
  readonly bytes: number
}

const measure = async (minutes: number): Promise<B1PerfSample> => {
  const transcript = createSyntheticTranscriptFixture(minutes)
  const durationTicks = minutes * 60 * PROJECT_TIMESCALE
  const source = Object.freeze({
    sourceId: `source:synthetic:${minutes}m`,
    durationTicks,
    width: 1920,
    height: 1080,
    frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
    sourceLabel: `Synthetic ${minutes}-minute B1 performance fixture`,
  })
  const analyzeStart = performance.now()
  const document = await analyzeVideoUnderstanding({ source, transcript }, { semanticAnalyzer: new DeterministicTranscriptSemanticAnalyzer() }, B1_FIXTURE_PROVENANCE)
  const analyzeMs = performance.now() - analyzeStart
  const validateStart = performance.now()
  const validation = validateVideoUnderstanding(document)
  const validateMs = performance.now() - validateStart
  expect(validation.ok).toBe(true)
  const serializeStart = performance.now()
  const json = serializeVideoUnderstanding(document)
  const serializeMs = performance.now() - serializeStart
  const projectStart = performance.now()
  const timeline = projectSourceUnderstandingTimeline(document)
  const projectMs = performance.now() - projectStart
  expect(timeline.length).toBe(document.transcript.length + document.semanticMoments.length + document.shots.length + document.visualRegions.length + document.spatialObservations.length)
  return Object.freeze({ minutes, transcriptSegments: transcript.length, semanticMoments: document.semanticMoments.length, analyzeMs, validateMs, serializeMs, projectMs, bytes: new TextEncoder().encode(json).byteLength })
}

describe('B1 measured deterministic performance', () => {
  it('records 1/10/30/60-minute analysis, validation, serialization and timeline projection without inventing a hard budget', async () => {
    const samples: B1PerfSample[] = []
    for (const minutes of [1, 10, 30, 60]) samples.push(await measure(minutes))
    for (const sample of samples) {
      expect(sample.transcriptSegments).toBe(sample.minutes * 12)
      expect(sample.analyzeMs).toBeGreaterThanOrEqual(0)
      expect(sample.validateMs).toBeGreaterThanOrEqual(0)
      expect(sample.serializeMs).toBeGreaterThanOrEqual(0)
      expect(sample.projectMs).toBeGreaterThanOrEqual(0)
      expect(sample.bytes).toBeGreaterThan(0)
      console.log(`B1_PERF minutes=${sample.minutes} segments=${sample.transcriptSegments} semantics=${sample.semanticMoments} analyzeMs=${sample.analyzeMs.toFixed(3)} validateMs=${sample.validateMs.toFixed(3)} serializeMs=${sample.serializeMs.toFixed(3)} projectMs=${sample.projectMs.toFixed(3)} bytes=${sample.bytes}`)
    }
  })
})
