import { useEffect, useRef } from 'react'

import { useMediaAnalysisController, useMediaAnalysisVersion } from '../../features/media-analysis'
import { formatTimelineTime } from './timeline-ruler-model'
import type { TimelineTrimViewFrameV1 } from './timeline-trim-view-plan'

const drawContained = (canvas: HTMLCanvasElement, bitmap: ImageBitmap): void => {
  const width = Math.max(1, canvas.clientWidth || 224)
  const height = Math.max(1, canvas.clientHeight || 126)
  const ratio = typeof window === 'undefined' ? 1 : Math.min(3, Math.max(1, window.devicePixelRatio || 1))
  const targetWidth = Math.max(1, Math.round(width * ratio))
  const targetHeight = Math.max(1, Math.round(height * ratio))
  if (canvas.width !== targetWidth) canvas.width = targetWidth
  if (canvas.height !== targetHeight) canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  const scale = Math.min(width / bitmap.width, height / bitmap.height)
  const drawWidth = bitmap.width * scale
  const drawHeight = bitmap.height * scale
  context.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

function TrimFrame({ frame, timescale }: Readonly<{ frame: TimelineTrimViewFrameV1; timescale: number }>) {
  const controller = useMediaAnalysisController()
  const version = useMediaAnalysisVersion(controller)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const resource = controller?.picture(frame.keyId) ?? Object.freeze({ status: 'idle' as const })

  useEffect(() => {
    if (resource.status !== 'ready' || !canvasRef.current) return
    drawContained(canvasRef.current, resource.value)
  }, [resource, version])

  return (
    <figure className="timeline-v1__trim-view-frame" data-trim-frame-role={frame.role}>
      <div className="timeline-v1__trim-view-picture">
        <canvas
          ref={canvasRef}
          aria-label={`${frame.label} frame from ${frame.clipLabel}`}
          role="img"
        />
        {resource.status === 'loading' || resource.status === 'idle' ? <span>Loading frame…</span> : null}
        {resource.status === 'missing' ? <span>Source frame missing</span> : null}
        {resource.status === 'error' ? <span>Frame unavailable</span> : null}
      </div>
      <figcaption>
        <strong>{frame.label}</strong>
        <span>{frame.clipLabel}</span>
        <span>{formatTimelineTime(frame.sourceTicks, timescale, true)} source</span>
      </figcaption>
    </figure>
  )
}

export function TimelineTrimView({
  frames,
  timescale,
  mode,
  deltaTicks,
}: Readonly<{
  frames: readonly TimelineTrimViewFrameV1[]
  timescale: number
  mode: string
  deltaTicks: number
}>) {
  if (frames.length === 0) return null
  return (
    <aside className="timeline-v1__trim-view" aria-label="Trim View" data-trim-view-mode={mode}>
      <div className="timeline-v1__trim-view-heading">
        <strong>Trim View</strong>
        <span>{mode.replaceAll('-', ' ')}</span>
        <span aria-live="polite">Δ {deltaTicks < 0 ? '−' : '+'}{formatTimelineTime(Math.abs(deltaTicks), timescale, true)}</span>
      </div>
      <div className="timeline-v1__trim-view-frames">
        {frames.map((frame) => <TrimFrame key={`${frame.role}:${frame.clipId}:${frame.sourceTicks}`} frame={frame} timescale={timescale} />)}
      </div>
    </aside>
  )
}
