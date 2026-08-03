import { useEffect, useState } from 'react'

import { exportPhaseMessage, formatExportElapsed, type ProjectExportPhase } from './project-export'

/**
 * What the export is doing, and for how long.
 *
 * The elapsed clock is the point. A spinner alone cannot distinguish an export
 * that is four seconds in from one that has been stuck for nine minutes, and
 * the owner's recording is exactly that: "Rendering and verifying your MP4…"
 * with no way to tell whether waiting longer was reasonable.
 */
export function ExportProgressStatus({
  phase,
  startedAt,
  now = () => Date.now(),
}: Readonly<{
  phase: ProjectExportPhase
  startedAt: number
  /** Injected only by tests. */
  now?: () => number
}>) {
  const [elapsedMs, setElapsedMs] = useState(() => Math.max(0, now() - startedAt))

  useEffect(() => {
    setElapsedMs(Math.max(0, now() - startedAt))
    const timer = window.setInterval(() => {
      setElapsedMs(Math.max(0, now() - startedAt))
    }, 1000)
    return () => { window.clearInterval(timer) }
    // `now` is a stable injection point, not reactive state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, phase])

  return (
    <p className="studio-screen__export-progress" role="status" aria-label="Export status">
      {exportPhaseMessage(phase)} <span data-testid="export-elapsed">{formatExportElapsed(elapsedMs)}</span>
    </p>
  )
}
