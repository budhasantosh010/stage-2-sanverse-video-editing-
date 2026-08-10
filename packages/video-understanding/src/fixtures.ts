import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import { DeterministicTranscriptSemanticAnalyzer, analyzeVideoUnderstanding } from './analyzers.ts'
import type { VideoUnderstandingDocumentV1 } from './document.ts'
import type { AnalysisProvenanceV1 } from './provenance.ts'
import { transcriptFromStructuredJson } from './transcript.ts'
import type { SpatialObservationV1, TemporalVisualRegionV1, VideoShotV1 } from './observations.ts'
import type { VideoSourceDescriptorV1 } from './source.ts'

const t = (seconds: number) => Math.round(seconds * PROJECT_TIMESCALE)
export const B1_FIXTURE_PROVENANCE: readonly AnalysisProvenanceV1[] = Object.freeze([
  Object.freeze({ id: 'provenance:transcript-import:v1', kind: 'imported-metadata', analyzerId: 'fixture.transcript.v1' }),
  Object.freeze({ id: 'provenance:semantic-rules:v1', kind: 'transcript-rule', analyzerId: 'sanverse.semantic-rules.v1' }),
  Object.freeze({ id: 'provenance:fixture-analyzer:v1', kind: 'fixture-analyzer', analyzerId: 'sanverse.fixture-understanding.v1' }),
  Object.freeze({ id: 'provenance:system-derived:v1', kind: 'system-derived', analyzerId: 'sanverse.pipeline.v1' }),
])

export const PRODUCT_LAUNCH_SOURCE: VideoSourceDescriptorV1 = Object.freeze({ sourceId: 'source:generic-product-launch', durationTicks: t(72), width: 1920, height: 1080, frameRate: Object.freeze({ numerator: 30, denominator: 1 }), audioChannels: 2, sourceLabel: 'Original generic product launch fixture' })
export const PRODUCT_LAUNCH_TRANSCRIPT = transcriptFromStructuredJson([
  { startSeconds: 4, endSeconds: 8, text: 'Our agent now completes 68% of requests automatically.', speakerId: 'speaker:host' },
  { startSeconds: 15, endSeconds: 20, text: 'The biggest change is shared project context, so the feature can see the work you selected.', speakerId: 'speaker:host' },
  { startSeconds: 28, endSeconds: 31, text: "Here's how it works.", speakerId: 'speaker:host' },
  { startSeconds: 32, endSeconds: 42, text: 'First, open the project. Second, choose the task. Third, review the result.', speakerId: 'speaker:host' },
  { startSeconds: 49, endSeconds: 57, text: 'Your private workspace stays separate from your team workspace for better security.', speakerId: 'speaker:host' },
  { startSeconds: 62, endSeconds: 67, text: 'Try it on your next project and let us know what changes.', speakerId: 'speaker:host' },
], 'provenance:transcript-import:v1')

const SHOTS: readonly VideoShotV1[] = Object.freeze([
  Object.freeze({ id: 'shot:1', startTicks: t(0), endTicks: t(12), transitionIn: 'cut', confidence: 1, provenance: 'provenance:fixture-analyzer:v1' }),
  Object.freeze({ id: 'shot:2', startTicks: t(12), endTicks: t(28), transitionIn: 'cut', confidence: 1, provenance: 'provenance:fixture-analyzer:v1' }),
  Object.freeze({ id: 'shot:3', startTicks: t(28), endTicks: t(49), transitionIn: 'cut', confidence: 1, provenance: 'provenance:fixture-analyzer:v1' }),
  Object.freeze({ id: 'shot:4', startTicks: t(49), endTicks: t(72), transitionIn: 'cut', confidence: 1, provenance: 'provenance:fixture-analyzer:v1' }),
])
const VISUAL: readonly TemporalVisualRegionV1[] = Object.freeze([
  Object.freeze({ id: 'visual:host-a', startTicks: t(0), endTicks: t(32), kind: 'talking-head', confidence: .99, provenance: 'provenance:fixture-analyzer:v1' }),
  Object.freeze({ id: 'visual:demo', startTicks: t(32), endTicks: t(49), kind: 'screen-demo', confidence: .99, provenance: 'provenance:fixture-analyzer:v1' }),
  Object.freeze({ id: 'visual:host-b', startTicks: t(49), endTicks: t(72), kind: 'talking-head', confidence: .99, provenance: 'provenance:fixture-analyzer:v1' }),
])
const SPATIAL: readonly SpatialObservationV1[] = Object.freeze([
  Object.freeze({ id: 'spatial:speaker-right', startTicks: t(0), endTicks: t(32), kind: 'speaker', bounds: Object.freeze({ x: .62, y: .14, width: .28, height: .72 }), confidence: .95, provenance: 'provenance:fixture-analyzer:v1' }),
  Object.freeze({ id: 'spatial:safe-left', startTicks: t(0), endTicks: t(32), kind: 'safe-region', bounds: Object.freeze({ x: .05, y: .12, width: .48, height: .7 }), confidence: .82, provenance: 'provenance:fixture-analyzer:v1' }),
  Object.freeze({ id: 'spatial:screen-full', startTicks: t(32), endTicks: t(49), kind: 'screen-content', bounds: Object.freeze({ x: .03, y: .04, width: .94, height: .9 }), confidence: .99, provenance: 'provenance:fixture-analyzer:v1' }),
])

export const createProductLaunchUnderstandingFixture = async (): Promise<VideoUnderstandingDocumentV1> => analyzeVideoUnderstanding({ source: PRODUCT_LAUNCH_SOURCE, transcript: PRODUCT_LAUNCH_TRANSCRIPT }, {
  semanticAnalyzer: new DeterministicTranscriptSemanticAnalyzer(),
  shotAnalyzer: { analyze: async () => SHOTS }, visualRegionAnalyzer: { analyze: async () => VISUAL }, spatialAnalyzer: { analyze: async () => SPATIAL },
}, B1_FIXTURE_PROVENANCE)

export const createSyntheticTranscriptFixture = (minutes: number) => transcriptFromStructuredJson(Array.from({ length: Math.max(1, minutes * 12) }, (_, index) => ({ startSeconds: index * 5, endSeconds: index * 5 + 4, text: index % 12 === 0 ? `At minute ${Math.floor(index / 12) + 1}, 65% of teams save $500 automatically.` : `This is synthetic transcript segment ${index + 1}.` })), 'provenance:transcript-import:v1')
