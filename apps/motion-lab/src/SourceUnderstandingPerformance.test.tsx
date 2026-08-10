import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import {
  B1_FIXTURE_PROVENANCE,
  DeterministicTranscriptSemanticAnalyzer,
  analyzeVideoUnderstanding,
  createSyntheticTranscriptFixture,
} from '@sanverse/video-understanding'
import { SourceUnderstandingPanel } from './SourceUnderstandingPanel.tsx'

const build = async (minutes: number) => {
  const transcript = createSyntheticTranscriptFixture(minutes)
  return analyzeVideoUnderstanding({
    source: Object.freeze({
      sourceId: `source:lab-perf:${minutes}m`,
      durationTicks: minutes * 60 * PROJECT_TIMESCALE,
      width: 1920,
      height: 1080,
      frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
      sourceLabel: `Synthetic ${minutes}-minute Lab fixture`,
    }),
    transcript,
  }, { semanticAnalyzer: new DeterministicTranscriptSemanticAnalyzer() }, B1_FIXTURE_PROVENANCE)
}

describe('B1 Source Understanding Lab measured rendering', () => {
  it('records React render construction for 1/10/30/60-minute source-understanding documents', async () => {
    for (const minutes of [1, 10, 30, 60]) {
      const document = await build(minutes)
      const start = performance.now()
      const html = renderToStaticMarkup(<SourceUnderstandingPanel documentOverride={document} />)
      const renderMs = performance.now() - start
      expect(html).toContain('Source Understanding')
      expect(html).toContain('SEMANTICS')
      expect(renderMs).toBeGreaterThanOrEqual(0)
      console.log(`B1_LAB_PERF minutes=${minutes} segments=${document.transcript.length} semantics=${document.semanticMoments.length} renderMs=${renderMs.toFixed(3)} htmlBytes=${new TextEncoder().encode(html).byteLength}`)
    }
  })
})
