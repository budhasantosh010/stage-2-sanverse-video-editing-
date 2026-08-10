import { useEffect, useMemo, useState } from 'react'
import {
  createProductLaunchUnderstandingFixture,
  projectSourceUnderstandingTimeline,
  videoUnderstandingTicksToSeconds,
} from '@sanverse/video-understanding'
import type {
  SourceUnderstandingTimelineItemV1,
  VideoUnderstandingDocumentV1,
} from '@sanverse/video-understanding'

const laneOrder = ['shots', 'visual', 'transcript', 'semantics', 'spatial'] as const
const laneLabels = Object.freeze({ shots: 'SHOTS', visual: 'VISUAL', transcript: 'TRANSCRIPT', semantics: 'SEMANTICS', spatial: 'SPATIAL' })
const seconds = (ticks: number, durationTicks: number, durationSeconds: number) => durationTicks === 0 ? 0 : (ticks / durationTicks) * durationSeconds

const detailFor = (document: VideoUnderstandingDocumentV1, selected: SourceUnderstandingTimelineItemV1 | null) => {
  if (!selected) return null
  const semantic = document.semanticMoments.find((entry) => entry.id === selected.id)
  const spatial = document.spatialObservations.find((entry) => entry.id === selected.id)
  const transcript = document.transcript.find((entry) => entry.id === selected.id)
  const provenance = document.provenance.find((entry) => entry.id === selected.provenance)
  return { semantic, spatial, transcript, provenance }
}

export function SourceUnderstandingPanel({ documentOverride = null }: Readonly<{ documentOverride?: VideoUnderstandingDocumentV1 | null }> = {}) {
  const [document, setDocument] = useState<VideoUnderstandingDocumentV1 | null>(documentOverride)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (documentOverride) {
      setDocument(documentOverride)
      setSelectedId(documentOverride.semanticMoments.find((entry) => entry.kind === 'percentage')?.id ?? documentOverride.semanticMoments[0]?.id ?? null)
      return
    }
    let active = true
    createProductLaunchUnderstandingFixture().then((fixture) => {
      if (!active) return
      setDocument(fixture)
      setSelectedId(fixture.semanticMoments.find((entry) => entry.kind === 'percentage')?.id ?? fixture.semanticMoments[0]?.id ?? null)
    })
    return () => { active = false }
  }, [documentOverride])
  const items = useMemo(() => document ? projectSourceUnderstandingTimeline(document) : [], [document])
  const selected = items.find((entry) => entry.id === selectedId) ?? null
  const detail = document ? detailFor(document, selected) : null
  if (!document) return <section className="source-understanding" aria-label="Source Understanding"><strong>SOURCE UNDERSTANDING</strong><p>Analyzing deterministic fixture…</p></section>
  const durationSeconds = videoUnderstandingTicksToSeconds(document.source.durationTicks)
  return (
    <section className="source-understanding" aria-label="Source Understanding" data-source-understanding="true">
      <header className="source-understanding__header">
        <div><small>SANVERSE CREATIVE ENGINE · PLAN B1</small><h2>Source Understanding</h2></div>
        <div><strong>{document.source.sourceLabel}</strong><span>{durationSeconds.toFixed(0)}s · {document.source.width}×{document.source.height}</span></div>
      </header>
      <div className="source-understanding__body">
        <div className="source-understanding__timeline">
          <div className="source-understanding__ruler"><span>0s</span><span>{(durationSeconds / 2).toFixed(0)}s</span><span>{durationSeconds.toFixed(0)}s</span></div>
          {laneOrder.map((lane) => (
            <div className="source-understanding__lane" key={lane} data-source-lane={lane}>
              <strong>{laneLabels[lane]}</strong>
              <div className="source-understanding__lane-track">
                {items.filter((item) => item.lane === lane).map((item) => {
                  const left = (item.startTicks / document.source.durationTicks) * 100
                  const width = ((item.endTicks - item.startTicks) / document.source.durationTicks) * 100
                  return <button key={item.id} type="button" aria-pressed={selectedId === item.id} className={selectedId === item.id ? 'is-selected' : ''} style={{ left: `${left}%`, width: `${Math.max(width, 1.2)}%` }} onClick={() => setSelectedId(item.id)} title={`${item.id}: ${item.label}`}><span>{item.label}</span></button>
                })}
              </div>
            </div>
          ))}
        </div>
        <aside className="source-understanding__inspector" aria-label="Source observation inspector">
          <h3>Observation</h3>
          {selected && detail ? <>
            <strong>{selected.label}</strong>
            <code>{selected.id}</code>
            <dl>
              <div><dt>Type</dt><dd>{selected.lane}</dd></div>
              <div><dt>Time</dt><dd>{seconds(selected.startTicks, document.source.durationTicks, durationSeconds).toFixed(2)}s → {seconds(selected.endTicks, document.source.durationTicks, durationSeconds).toFixed(2)}s</dd></div>
              <div><dt>Confidence</dt><dd>{selected.confidence === undefined ? 'not supplied' : selected.confidence.toFixed(2)}</dd></div>
              <div><dt>Provenance</dt><dd>{detail.provenance?.kind ?? 'unknown'} · {detail.provenance?.analyzerId ?? selected.provenance}</dd></div>
              {detail.semantic ? <><div><dt>Transcript refs</dt><dd>{detail.semantic.transcriptSegmentIds.join(', ')}</dd></div><div><dt>Value</dt><dd>{detail.semantic.value === undefined ? '—' : `${detail.semantic.value}${detail.semantic.unit === '%' ? '%' : detail.semantic.unit ? ` ${detail.semantic.unit}` : ''}`}</dd></div></> : null}
              {detail.transcript ? <div><dt>Transcript</dt><dd>{detail.transcript.text}</dd></div> : null}
              {detail.spatial ? <div><dt>Bounds</dt><dd>x {detail.spatial.bounds.x.toFixed(2)} · y {detail.spatial.bounds.y.toFixed(2)} · w {detail.spatial.bounds.width.toFixed(2)} · h {detail.spatial.bounds.height.toFixed(2)}</dd></div> : null}
            </dl>
          </> : <p>Select a source observation.</p>}
        </aside>
      </div>
    </section>
  )
}
