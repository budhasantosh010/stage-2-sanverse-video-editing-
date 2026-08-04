import { useEffect, useRef } from 'react'

import {
  useMediaAnalysisController,
  useMediaAnalysisVersion,
  type ClipDerivedMedia,
} from '../../features/media-analysis'

/**
 * The row of small pictures drawn inside a piece of video, and the single
 * picture drawn inside a still image.
 *
 * ## Why one canvas rather than one image element per thumbnail
 *
 * A sixty-minute project with filmstrips would be tens of thousands of picture
 * elements. Each one is a node the browser lays out, styles, and paints. One
 * drawing surface per clip is a fixed cost per clip however much detail is on
 * it — so zooming in makes the pictures finer without making the page heavier.
 *
 * It also means no object URL is ever created. A picture is decoded once,
 * straight from the response, and drawn. An object URL that is never released
 * is the classic way a page keeps hold of megabytes it has finished with.
 *
 * ## Why it cannot be interacted with
 *
 * `pointer-events: none`. The filmstrip is decoration; every click, drag and
 * trim belongs to the clip underneath. A decoration that swallowed a drag would
 * make a clip that simply refuses to move, with nothing on screen explaining
 * why.
 */

export type TimelineFilmstripProps = Readonly<{
  media: ClipDerivedMedia
  /** How tall the strip is drawn, in pixels. */
  heightPx: number
  /** How wide the clip is, so the last picture can be cropped to its end. */
  widthPx: number
  /** Told plainly when a picture is gone, rather than left blank. */
  onStateChange?: (state: 'loading' | 'ready' | 'missing' | 'error' | 'none') => void
}>

/** A device with two physical pixels per drawn pixel gets a sharp filmstrip. */
const devicePixelRatio = (): number => {
  const raw = typeof window === 'undefined' ? 1 : window.devicePixelRatio
  return Number.isFinite(raw) && raw > 0 ? Math.min(3, raw) : 1
}

export function TimelineFilmstrip({ media, heightPx, widthPx, onStateChange }: TimelineFilmstripProps) {
  const controller = useMediaAnalysisController()
  // Reading the version is what makes this redraw when a picture arrives. It is
  // read even when nothing is drawn, because hooks may not be conditional.
  const version = useMediaAnalysisVersion(controller)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const cells = media.kind === 'filmstrip' ? media.cells : []
  const singleKeyId = media.kind === 'image' ? media.keyId : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || controller === null) return
    const width = Math.max(1, Math.floor(widthPx))
    const height = Math.max(1, Math.floor(heightPx))
    const ratio = devicePixelRatio()
    // Only resized when it actually changed: assigning width or height clears
    // the canvas, so doing it every render would flash the strip empty.
    if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
    }
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)

    let ready = 0
    let missing = 0
    let failed = 0
    let pending = 0

    const drawContained = (bitmap: ImageBitmap, left: number, cellWidth: number): void => {
      // Contained, never stretched. A thumbnail of the wrong shape is a lie
      // about what the footage looks like.
      const scale = Math.min(cellWidth / bitmap.width, height / bitmap.height)
      const drawWidth = Math.max(1, bitmap.width * scale)
      const drawHeight = Math.max(1, bitmap.height * scale)
      context.drawImage(
        bitmap,
        left + (cellWidth - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      )
    }

    if (singleKeyId !== null) {
      const resource = controller.picture(singleKeyId)
      if (resource.status === 'ready') { drawContained(resource.value, 0, width); ready += 1 }
      else if (resource.status === 'missing') missing += 1
      else if (resource.status === 'error') failed += 1
      else pending += 1
    } else {
      for (const cell of cells) {
        const resource = controller.picture(cell.keyId)
        if (resource.status === 'ready') {
          drawContained(resource.value, cell.offsetPx, cell.widthPx)
          ready += 1
        } else if (resource.status === 'missing') missing += 1
        else if (resource.status === 'error') failed += 1
        else pending += 1
      }
    }

    const total = ready + missing + failed + pending
    onStateChange?.(
      total === 0 ? 'none'
        : missing === total ? 'missing'
          : failed === total ? 'error'
            : pending > 0 && ready === 0 ? 'loading'
              : 'ready',
    )
    // `version` is in the list because a picture arriving is exactly when this
    // has to run again. It is otherwise unused, which is deliberate.
  }, [controller, version, cells, singleKeyId, widthPx, heightPx, onStateChange])

  if (media.kind !== 'filmstrip' && media.kind !== 'image') return null

  return (
    <canvas
      ref={canvasRef}
      className="timeline-v1__filmstrip"
      data-testid="timeline-filmstrip"
      data-cell-count={media.kind === 'filmstrip' ? media.cells.length : 1}
      data-truncated={media.kind === 'filmstrip' && media.truncated ? 'true' : undefined}
      aria-hidden="true"
      style={{ width: `${Math.max(1, widthPx)}px`, height: `${Math.max(1, heightPx)}px` }}
    />
  )
}
