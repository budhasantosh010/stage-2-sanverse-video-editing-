import { useEffect, useMemo, useRef, useState } from 'react'
import type { MotionAspectRatio } from '@sanverse/motion-contract'
import type { MotionLibraryBackgroundV1, MotionLibraryCatalogEntryV1 } from '@sanverse/motion-library'
import { MOTION_REFERENCE_COMPOSITIONS } from '@sanverse/motion-library'
import { MotionComponentHost, MotionCompositionFrame } from '@sanverse/motion-native-runtime'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { advancePlaybackTicks, clampExactTick } from '../transport.ts'
import type { PlaybackSpeed } from '../transport.ts'
import { createLibraryPreviewModel, libraryPreviewBackgroundStyle } from './preview-model.ts'

interface LibraryMotionStageProps {
  readonly entry: MotionLibraryCatalogEntryV1
  readonly fixtureId?: string
  readonly ratio: MotionAspectRatio
  readonly stylePackId: string
  readonly background: MotionLibraryBackgroundV1
  readonly reducedMotion: boolean
  readonly localTicks: number
  readonly fixedScale?: number
  readonly className?: string
}

export function LibraryMotionStage({ entry, fixtureId, ratio, stylePackId, background, reducedMotion, localTicks, fixedScale, className }: LibraryMotionStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [hostSize, setHostSize] = useState({ width: 960, height: 540 })
  useEffect(() => {
    if (fixedScale !== undefined) return
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const update = () => setHostSize({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(host)
    return () => observer.disconnect()
  }, [fixedScale])
  const composition = MOTION_REFERENCE_COMPOSITIONS[ratio]
  const scale = fixedScale ?? Math.max(0.01, Math.min(hostSize.width / composition.width, hostSize.height / composition.height))
  const model = useMemo(() => createLibraryPreviewModel({ entry, ratio, stylePackId, reducedMotion, localTicks, ...(fixtureId ? { fixtureId } : {}) }), [entry, ratio, stylePackId, reducedMotion, localTicks, fixtureId])
  return (
    <div ref={hostRef} className={className ?? 'creative-library__motion-stage'} data-library-stage={entry.componentId}>
      <MotionCompositionFrame composition={composition} displayScale={scale} background="transparent">
        <div style={{ position: 'absolute', inset: 0, ...libraryPreviewBackgroundStyle(background) }} />
        <MotionComponentHost module={model.module} props={model.props} style={model.style} context={model.context} />
      </MotionCompositionFrame>
    </div>
  )
}

export interface LibraryPlayerProps {
  readonly entry: MotionLibraryCatalogEntryV1
  readonly fixtureId?: string
  readonly ratio: MotionAspectRatio
  readonly stylePackId: string
  readonly background: MotionLibraryBackgroundV1
  readonly reducedMotion: boolean
  readonly speed: PlaybackSpeed
  readonly autoplay?: boolean
  readonly controls?: boolean
  readonly returnToPosterAfterEnd?: boolean
  readonly onFullPlaybackVerified?: () => void
  readonly onComplete?: () => void
  readonly onPlayingChange?: (playing: boolean) => void
  readonly externalRestartToken?: number
}

export function LibraryPlayer({
  entry,
  fixtureId,
  ratio,
  stylePackId,
  background,
  reducedMotion,
  speed,
  autoplay = false,
  controls = true,
  returnToPosterAfterEnd = false,
  onFullPlaybackVerified,
  onComplete,
  onPlayingChange,
  externalRestartToken = 0,
}: LibraryPlayerProps) {
  const durationTicks = entry.preview.durationTicks
  const [tick, setTick] = useState(0)
  const [playing, setPlaying] = useState(autoplay)
  const [verified, setVerified] = useState(false)
  const playbackRef = useRef({ candidate: autoplay && speed === 1, anchorTicks: 0, anchorTime: 0, lastTick: 0, manuallySeeked: false })
  const endHoldRef = useRef<number | null>(null)

  useEffect(() => {
    setTick(0)
    setPlaying(autoplay)
    setVerified(false)
    playbackRef.current = { candidate: autoplay && speed === 1, anchorTicks: 0, anchorTime: performance.now(), lastTick: 0, manuallySeeked: false }
  }, [entry.componentId, fixtureId, ratio, stylePackId, reducedMotion, externalRestartToken, autoplay])

  useEffect(() => onPlayingChange?.(playing), [playing, onPlayingChange])

  useEffect(() => {
    if (!playing) return
    const state = playbackRef.current
    state.anchorTicks = tick
    state.anchorTime = performance.now()
    let frame = 0
    const animate = (now: number) => {
      const advance = advancePlaybackTicks({ anchorTicks: state.anchorTicks, elapsedMilliseconds: Math.max(0, now - state.anchorTime), speed, durationTicks, loop: false })
      state.lastTick = Math.max(state.lastTick, advance.ticks)
      setTick(advance.ticks)
      if (advance.ended) {
        setPlaying(false)
        if (state.candidate && !state.manuallySeeked && speed === 1 && state.lastTick >= durationTicks) {
          setVerified(true)
          onFullPlaybackVerified?.()
        }
        onComplete?.()
        if (returnToPosterAfterEnd) {
          endHoldRef.current = window.setTimeout(() => setTick(entry.preview.posterTick), 650)
        }
        return
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, durationTicks, onComplete, onFullPlaybackVerified, returnToPosterAfterEnd, entry.preview.posterTick])

  useEffect(() => () => { if (endHoldRef.current !== null) window.clearTimeout(endHoldRef.current) }, [])

  const play = () => {
    if (tick >= durationTicks) setTick(0)
    const startingTick = tick >= durationTicks ? 0 : tick
    playbackRef.current = {
      candidate: startingTick === 0 && speed === 1,
      anchorTicks: startingTick,
      anchorTime: performance.now(),
      lastTick: startingTick,
      manuallySeeked: false,
    }
    setPlaying(true)
  }
  const pause = () => setPlaying(false)
  const restart = () => {
    setPlaying(false)
    setTick(0)
    setVerified(false)
    playbackRef.current = { candidate: false, anchorTicks: 0, anchorTime: performance.now(), lastTick: 0, manuallySeeked: false }
  }
  const seek = (next: number) => {
    setPlaying(false)
    const clamped = clampExactTick(next, durationTicks)
    playbackRef.current.manuallySeeked = true
    playbackRef.current.candidate = false
    setTick(clamped)
  }
  const progress = durationTicks <= 0 ? 0 : tick / durationTicks
  const seconds = tick / SANVERSE_TICKS_PER_SECOND
  const totalSeconds = durationTicks / SANVERSE_TICKS_PER_SECOND
  return (
    <section className="creative-library__player" data-library-player={entry.componentId} data-library-current-tick={tick} data-library-duration-ticks={durationTicks} data-library-playing={playing ? 'true' : 'false'} data-library-full-playback={verified ? 'true' : 'false'}>
      <LibraryMotionStage entry={entry} fixtureId={fixtureId} ratio={ratio} stylePackId={stylePackId} background={background} reducedMotion={reducedMotion} localTicks={tick} />
      {controls ? <><div className="creative-library__player-controls">
        <button type="button" onClick={restart} aria-label="Restart animation">↻</button>
        <button type="button" onClick={playing ? pause : play} aria-label={playing ? 'Pause animation' : 'Play animation'}>{playing ? '❚❚' : '▶'}</button>
        <input aria-label="Scrub animation" type="range" min={0} max={durationTicks} step={1} value={tick} onChange={(event) => seek(Number(event.target.value))} />
        <span className="creative-library__timecode">{seconds.toFixed(2)} / {totalSeconds.toFixed(2)}s</span>
        <span className="creative-library__progress-label">{Math.round(progress * 100)}%</span>
      </div><a className="creative-library__canonical-review" href={`/review-videos/${entry.componentId}.mp4`} target="_blank" rel="noreferrer">Open canonical 1× review ↗</a></> : null}
    </section>
  )
}

export function LibraryPosterStage({ entry, fixtureId }: Readonly<{ entry: MotionLibraryCatalogEntryV1; fixtureId?: string }>) {
  return <div className="creative-library__poster-stage" data-library-poster-ready="true"><LibraryMotionStage entry={entry} fixtureId={fixtureId} ratio="16:9" stylePackId={entry.preview.stylePackId} background={entry.preview.backgroundPreset} reducedMotion={false} localTicks={entry.preview.posterTick} fixedScale={0.25} /></div>
}
