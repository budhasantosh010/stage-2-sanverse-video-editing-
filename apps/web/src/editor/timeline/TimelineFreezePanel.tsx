import { useEffect, useState } from 'react'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'
import {
  MAX_FREEZE_FRAME_TICKS,
  MIN_FREEZE_FRAME_TICKS,
} from '@sanverse/edit-domain/timeline-operations'

const MIN_SECONDS = MIN_FREEZE_FRAME_TICKS / PROJECT_TIMESCALE
const MAX_SECONDS = MAX_FREEZE_FRAME_TICKS / PROJECT_TIMESCALE

export function TimelineFreezePanel({
  open,
  clipLabel,
  unavailableReason,
  busy,
  onApply,
  onClose,
}: Readonly<{
  open: boolean
  clipLabel: string | null
  unavailableReason: string | null
  busy: boolean
  onApply(durationTicks: number): void
  onClose(): void
}>) {
  const [seconds, setSeconds] = useState(1)

  useEffect(() => {
    if (open) setSeconds(1)
  }, [open, clipLabel])

  if (!open) return null
  const clamped = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Number.isFinite(seconds) ? seconds : 1))
  return (
    <div className="timeline-speed timeline-freeze" role="group" aria-label="Hold frame">
      <div className="timeline-speed__head">
        <strong>Hold one frame</strong>
        <button type="button" className="timeline-speed__close" onClick={onClose} aria-label="Close hold-frame panel">Close</button>
      </div>
      {unavailableReason !== null ? (
        <p className="timeline-speed__unavailable">{unavailableReason}</p>
      ) : (
        <>
          <p className="timeline-speed__subject">{clipLabel ?? 'This piece'} — the picture pauses while the finished-video clock keeps moving. The held interval is silent.</p>
          <label className="timeline-speed__typed">
            <span>Duration</span>
            <input
              type="range"
              min={MIN_SECONDS}
              max={MAX_SECONDS}
              step={0.1}
              value={clamped}
              disabled={busy}
              aria-label="Hold frame duration handle"
              onChange={(event) => setSeconds(Number(event.currentTarget.value))}
            />
            <input
              type="number"
              min={MIN_SECONDS}
              max={MAX_SECONDS}
              step={0.1}
              value={seconds}
              disabled={busy}
              aria-label="Hold frame duration seconds"
              onChange={(event) => setSeconds(Number(event.currentTarget.value))}
            />
            <span>s</span>
          </label>
          <button
            type="button"
            className="timeline-speed__reset"
            disabled={busy}
            onClick={() => onApply(Math.round(clamped * PROJECT_TIMESCALE))}
          >Insert held frame</button>
          <p className="timeline-speed__range">This is a real freeze segment, not 0× speed. Undo removes it in one step.</p>
        </>
      )}
    </div>
  )
}
