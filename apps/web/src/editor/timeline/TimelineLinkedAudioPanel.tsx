import { useEffect, useState } from 'react'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

export type TimelineLinkedAudioSubject = Readonly<{
  clipId: string
  clipLabel: string
  leadTicks: number
  tailTicks: number
  maxLeadTicks: number
  maxTailTicks: number
}>

const ticksToMs = (ticks: number): number => Math.round(ticks / (PROJECT_TIMESCALE / 1000))
const msToTicks = (ms: number): number => Math.round(ms * (PROJECT_TIMESCALE / 1000))

export function TimelineLinkedAudioPanel({
  open,
  subject,
  busy,
  onApply,
  onClose,
}: Readonly<{
  open: boolean
  subject: TimelineLinkedAudioSubject | null
  busy: boolean
  onApply(leadTicks: number, tailTicks: number): void
  onClose(): void
}>) {
  const [leadMs, setLeadMs] = useState(0)
  const [tailMs, setTailMs] = useState(0)

  useEffect(() => {
    if (!subject) return
    setLeadMs(ticksToMs(subject.leadTicks))
    setTailMs(ticksToMs(subject.tailTicks))
  }, [subject?.clipId, subject?.leadTicks, subject?.tailTicks])

  if (!open) return null
  const maxLeadMs = subject ? ticksToMs(subject.maxLeadTicks) : 0
  const maxTailMs = subject ? ticksToMs(subject.maxTailTicks) : 0
  return (
    <div className="timeline-speed timeline-linked-audio" role="group" aria-label="J and L cuts">
      <div className="timeline-speed__head">
        <strong>Linked audio edges</strong>
        <button type="button" className="timeline-speed__close" onClick={onClose} aria-label="Close linked audio panel">Close</button>
      </div>
      {subject === null ? (
        <p className="timeline-speed__unavailable">Choose a main-video or dialogue piece that contains sound.</p>
      ) : (
        <>
          <p className="timeline-speed__subject">{subject.clipLabel}. Picture and sound stay one linked clip; only A1's edges change.</p>
          <label className="timeline-speed__typed">
            <span>J-cut lead</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, maxLeadMs)}
              step={10}
              value={Math.min(leadMs, maxLeadMs)}
              disabled={busy || maxLeadMs === 0}
              aria-label="J-cut lead handle"
              onChange={(event) => setLeadMs(Number(event.currentTarget.value))}
            />
            <input
              type="number"
              min={0}
              max={maxLeadMs}
              step={10}
              value={leadMs}
              disabled={busy}
              aria-label="J-cut lead milliseconds"
              onChange={(event) => setLeadMs(Math.min(maxLeadMs, Math.max(0, Number(event.currentTarget.value) || 0)))}
            />
            <span>ms</span>
          </label>
          <label className="timeline-speed__typed">
            <span>L-cut tail</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, maxTailMs)}
              step={10}
              value={Math.min(tailMs, maxTailMs)}
              disabled={busy || maxTailMs === 0}
              aria-label="L-cut tail handle"
              onChange={(event) => setTailMs(Number(event.currentTarget.value))}
            />
            <input
              type="number"
              min={0}
              max={maxTailMs}
              step={10}
              value={tailMs}
              disabled={busy}
              aria-label="L-cut tail milliseconds"
              onChange={(event) => setTailMs(Math.min(maxTailMs, Math.max(0, Number(event.currentTarget.value) || 0)))}
            />
            <span>ms</span>
          </label>
          <p className="timeline-speed__range">A J-cut starts this clip's sound before its picture. An L-cut keeps its sound running after its picture.</p>
          <div className="timeline-speed__presets">
            <button
              type="button"
              className="timeline-speed__preset"
              disabled={busy}
              onClick={() => onApply(msToTicks(leadMs), msToTicks(tailMs))}
            >Apply J/L cut</button>
            <button
              type="button"
              className="timeline-speed__preset"
              disabled={busy || (subject.leadTicks === 0 && subject.tailTicks === 0)}
              onClick={() => onApply(0, 0)}
            >Reset edges</button>
          </div>
        </>
      )}
    </div>
  )
}