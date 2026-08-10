import type { VideoUnderstandingDocumentV1 } from './document.ts'
export type SourceUnderstandingLaneV1 = 'shots' | 'visual' | 'transcript' | 'semantics' | 'spatial'
export interface SourceUnderstandingTimelineItemV1 { readonly id: string; readonly lane: SourceUnderstandingLaneV1; readonly startTicks: number; readonly endTicks: number; readonly label: string; readonly confidence?: number; readonly provenance: string }
export const projectSourceUnderstandingTimeline = (document: VideoUnderstandingDocumentV1): readonly SourceUnderstandingTimelineItemV1[] => Object.freeze([
  ...document.shots.map((item) => Object.freeze({ id: item.id, lane: 'shots' as const, startTicks: item.startTicks, endTicks: item.endTicks, label: item.transitionIn, ...(item.confidence !== undefined ? { confidence: item.confidence } : {}), provenance: item.provenance })),
  ...document.visualRegions.map((item) => Object.freeze({ id: item.id, lane: 'visual' as const, startTicks: item.startTicks, endTicks: item.endTicks, label: item.kind, confidence: item.confidence, provenance: item.provenance })),
  ...document.transcript.map((item) => Object.freeze({ id: item.id, lane: 'transcript' as const, startTicks: item.startTicks, endTicks: item.endTicks, label: item.text, provenance: item.provenance })),
  ...document.semanticMoments.map((item) => Object.freeze({ id: item.id, lane: 'semantics' as const, startTicks: item.startTicks, endTicks: item.endTicks, label: item.value !== undefined ? `${item.kind}: ${item.value}${item.unit === '%' ? '%' : ''}` : item.kind, confidence: item.confidence, provenance: item.provenance })),
  ...document.spatialObservations.map((item) => Object.freeze({ id: item.id, lane: 'spatial' as const, startTicks: item.startTicks, endTicks: item.endTicks, label: item.kind, confidence: item.confidence, provenance: item.provenance })),
].sort((a, b) => a.startTicks - b.startTicks || a.lane.localeCompare(b.lane) || a.id.localeCompare(b.id)))
