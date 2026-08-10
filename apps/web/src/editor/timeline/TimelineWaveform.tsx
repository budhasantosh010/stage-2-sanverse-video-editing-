import { useEffect, useRef } from 'react'

import {
  slicePeaks,
  useMediaAnalysisController,
  useMediaAnalysisVersion,
  type ClipDerivedMedia,
} from '../../features/media-analysis'
import type { AudioChannelDisplayMode } from '../../features/timeline/timeline-waveform-presentation'

/**
 * The shape of the sound drawn inside a piece of audio.
 *
 * ## Why Canvas rather than an SVG path
 *
 * At full detail one second of sound is 256 loudness numbers. A fourteen-second
 * clip is therefore about 3,600 numbers, and a timeline can show fifty such
 * clips. As an SVG path that is a string of some 180,000 characters that the
 * browser must parse, keep in memory, and re-parse on every zoom step.
 *
 * A canvas is one element and one drawing pass whatever the detail, so zooming
 * in makes the waveform finer without making the page heavier. That is the same
 * reason the filmstrip uses one, which means there is ONE way decorations are
 * drawn rather than two that behave differently under load.
 *
 * ## Why there is no animation loop
 *
 * A waveform does not move. It is drawn once and redrawn only when something it
 * depends on actually changes: the numbers arrive, the clip is resized or
 * trimmed, the zoom changes, the lane changes height, or the track is muted. A
 * loop redrawing sixty times a second would spend a whole processor core drawing
 * an identical picture.
 *
 * ## Why it starts at the right place
 *
 * The numbers are named by their moment in the FILE. A piece of music starting
 * four seconds into the song draws the song FROM four seconds. That is what
 * makes trimming truthful: pull the left edge in and the shape that remains is
 * the shape that was under the part you kept, not the whole shape squashed.
 */

export type TimelineWaveformProps = Readonly<{
  media: ClipDerivedMedia
  widthPx: number
  heightPx: number
  /** A muted track still shows its shape, drawn faintly. */
  muted: boolean
  channelDisplayMode: AudioChannelDisplayMode
  selected: boolean
  onStateChange?: (state: 'loading' | 'ready' | 'missing' | 'error' | 'none') => void
}>

const devicePixelRatio = (): number => {
  const raw = typeof window === 'undefined' ? 1 : window.devicePixelRatio
  return Number.isFinite(raw) && raw > 0 ? Math.min(3, raw) : 1
}

export function TimelineWaveform({
  media,
  widthPx,
  heightPx,
  muted,
  channelDisplayMode,
  selected,
  onStateChange,
}: TimelineWaveformProps) {
  const controller = useMediaAnalysisController()
  const version = useMediaAnalysisVersion(controller)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const blocks = media.kind === 'waveform' ? media.blocks : []
  const fromTicks = media.kind === 'waveform' ? media.fromTicks : 0
  const toTicks = media.kind === 'waveform' ? media.toTicks : 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || controller === null || toTicks <= fromTicks) return
    const width = Math.max(1, Math.floor(widthPx))
    const height = Math.max(1, Math.floor(heightPx))
    const ratio = devicePixelRatio()
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

    // A muted track is still readable — the user has to be able to find the
    // moment they want in a track they have silenced. Faint, not hidden.
    context.fillStyle = muted
      ? 'rgba(255, 255, 255, 0.32)'
      : selected
        ? 'rgba(255, 255, 255, 0.92)'
        : 'rgba(255, 255, 255, 0.72)'

    const spanTicks = toTicks - fromTicks
    const middle = height / 2

    for (const block of blocks) {
      const resource = controller.peaks(block.keyId)
      if (resource.status !== 'ready') {
        if (resource.status === 'missing') missing += 1
        else if (resource.status === 'error') failed += 1
        else pending += 1
        continue
      }
      ready += 1
      // Only the part of this block the clip actually shows. A block covers a
      // whole second of the file; a trimmed clip may show a third of it.
      const sliceFrom = Math.max(fromTicks, block.blockStartTicks)
      const sliceTo = Math.min(toTicks, block.blockStartTicks + block.blockSpanTicks)
      if (sliceTo <= sliceFrom) continue
      const value = resource.value
      const detailed = Array.isArray(value)
        ? null
        : value as Exclude<typeof value, readonly number[]>
      const combined = detailed?.peaks ?? value as readonly number[]
      const stereoChannels = detailed?.channels ?? []
      const leftPx = ((sliceFrom - fromTicks) / spanTicks) * width
      const sliceWidthPx = ((sliceTo - sliceFrom) / spanTicks) * width

      const drawPeaks = (source: readonly number[], centerY: number, availableHeight: number): void => {
        const peaks = slicePeaks(source, {
          blockStartTicks: block.blockStartTicks,
          blockSpanTicks: block.blockSpanTicks,
          fromTicks: sliceFrom,
          toTicks: sliceTo,
        })
        if (peaks.length === 0) return
        const barWidth = sliceWidthPx / peaks.length
        for (let index = 0; index < peaks.length; index += 1) {
          const halfHeight = Math.max(0.5, (peaks[index] * availableHeight) / 2)
          context.fillRect(leftPx + index * barWidth, centerY - halfHeight, Math.max(0.5, barWidth), halfHeight * 2)
        }
      }

      if (channelDisplayMode === 'separate' && stereoChannels.length === 2) {
        const half = height / 2
        drawPeaks(stereoChannels[0].peaks, half / 2, half * 0.82)
        drawPeaks(stereoChannels[1].peaks, half + half / 2, half * 0.82)
        // These are decoder-probed stereo channels, not duplicated Combined
        // peaks. If the layout is unknown we intentionally draw Combined only.
        context.save()
        context.font = '9px system-ui, sans-serif'
        context.globalAlpha = muted ? 0.45 : 0.68
        context.fillText('L', leftPx + 2, Math.min(height - 2, 9))
        context.fillText('R', leftPx + 2, Math.max(10, half + 9))
        context.restore()
      } else {
        drawPeaks(combined, middle, height)
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
  }, [controller, version, blocks, fromTicks, toTicks, widthPx, heightPx, muted, channelDisplayMode, selected, onStateChange])

  if (media.kind !== 'waveform') return null

  return (
    <canvas
      ref={canvasRef}
      className="timeline-v1__waveform"
      data-testid="timeline-waveform"
      data-block-count={media.blocks.length}
      data-muted={muted ? 'true' : undefined}
      data-channel-display-mode={channelDisplayMode}
      data-truncated={media.truncated ? 'true' : undefined}
      aria-hidden="true"
      style={{ width: `${Math.max(1, widthPx)}px`, height: `${Math.max(1, heightPx)}px` }}
    />
  )
}
