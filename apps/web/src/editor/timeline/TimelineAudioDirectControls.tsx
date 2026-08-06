import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'

import {
  CENTRE_PAN,
  MAX_CLIP_GAIN_DB,
  MAX_CLIP_PAN,
  MIN_CLIP_GAIN_DB,
  MIN_CLIP_PAN,
} from '@sanverse/edit-domain/composition'
import {
  AnalysisRefusalError,
  createMediaAnalysisClient,
  type AudioNormalizationEvidenceV1,
  type AudioNormalizationRequestV1,
} from '../../features/media-analysis'

export type TimelineAudioState = Readonly<{
  gainDb: number
  fadeInTicks: number
  fadeOutTicks: number
  pan: number
}>

type DragKind = 'gain' | 'fade-in' | 'fade-out'

type Drag = Readonly<{ pointerId: number; kind: DragKind; start: TimelineAudioState }>

type NormalizationState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'analyzing' }>
  | Readonly<{ status: 'ready'; evidence: AudioNormalizationEvidenceV1 }>
  | Readonly<{ status: 'error'; message: string }>

const normalizationClient = createMediaAnalysisClient()

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const same = (a: TimelineAudioState, b: TimelineAudioState): boolean =>
  a.gainDb === b.gainDb && a.fadeInTicks === b.fadeInTicks && a.fadeOutTicks === b.fadeOutTicks && a.pan === b.pan

const panLabel = (pan: number): string => {
  if (pan === 0) return 'Center'
  const amount = Math.round(Math.abs(pan) / 100)
  return pan < 0 ? `L ${amount}` : `R ${amount}`
}

export function TimelineAudioDirectControls({
  accepted,
  durationTicks,
  disabled,
  muted,
  supportsPan,
  normalization,
  onCommit,
}: Readonly<{
  accepted: TimelineAudioState
  durationTicks: number
  disabled: boolean
  muted: boolean
  supportsPan: boolean
  normalization?: Readonly<{
    projectId: string
    request: AudioNormalizationRequestV1
  }> | null
  onCommit(next: TimelineAudioState): void
}>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [draft, setDraft] = useState(accepted)
  const draftRef = useRef(accepted)
  const setDraftState = (
    next: TimelineAudioState | ((current: TimelineAudioState) => TimelineAudioState),
  ) => {
    const resolved = typeof next === 'function' ? next(draftRef.current) : next
    draftRef.current = resolved
    setDraft(resolved)
  }
  const [panPointerActive, setPanPointerActive] = useState(false)
  const [normalizationState, setNormalizationState] = useState<NormalizationState>({ status: 'idle' })
  const normalizationAbortRef = useRef<AbortController | null>(null)
  const normalizationKey = normalization
    ? `${normalization.projectId}:${normalization.request.assetId}:${normalization.request.assetVersion}:${normalization.request.sourceStartTicks}:${normalization.request.sourceEndTicks}`
    : null

  useEffect(() => {
    if (!dragRef.current && !panPointerActive) setDraftState(accepted)
  }, [accepted, panPointerActive])

  useEffect(() => {
    normalizationAbortRef.current?.abort()
    normalizationAbortRef.current = null
    setNormalizationState({ status: 'idle' })
    return () => {
      normalizationAbortRef.current?.abort()
      normalizationAbortRef.current = null
    }
  }, [normalizationKey])

  const commit = (next = draftRef.current) => {
    if (!same(next, accepted)) onCommit(Object.freeze(next))
  }

  const analyze = async () => {
    if (!normalization || disabled) return
    normalizationAbortRef.current?.abort()
    const controller = new AbortController()
    normalizationAbortRef.current = controller
    setNormalizationState({ status: 'analyzing' })
    try {
      const requestNormalization = normalizationClient.normalization
      if (!requestNormalization) throw new Error('Normalization analysis is unavailable.')
      const evidence = await requestNormalization(
        normalization.projectId,
        normalization.request,
        controller.signal,
      )
      if (controller.signal.aborted) return
      setNormalizationState(Object.freeze({ status: 'ready', evidence }))
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof AnalysisRefusalError
        ? error.refusal.message
        : 'The loudness measurement could not be completed.'
      setNormalizationState(Object.freeze({ status: 'error', message }))
    } finally {
      if (normalizationAbortRef.current === controller) normalizationAbortRef.current = null
    }
  }

  const cancelNormalization = () => {
    normalizationAbortRef.current?.abort()
    normalizationAbortRef.current = null
    setNormalizationState({ status: 'idle' })
  }

  const cancelDrag = (target?: HTMLElement, pointerId?: number) => {
    if (target && pointerId !== undefined && target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
    dragRef.current = null
    setDraftState(accepted)
  }

  const begin = (event: ReactPointerEvent<HTMLButtonElement>, kind: DragKind) => {
    if (disabled || event.button !== 0) return
    dragRef.current = Object.freeze({ pointerId: event.pointerId, kind, start: accepted })
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus()
  }

  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const rect = rootRef.current?.getBoundingClientRect()
    if (!drag || drag.pointerId !== event.pointerId || !rect || rect.width <= 0 || rect.height <= 0) return
    if (drag.kind === 'gain') {
      const ratio = clamp((event.clientY - rect.top) / rect.height, 0, 1)
      const gainDb = Math.round((MAX_CLIP_GAIN_DB - ratio * (MAX_CLIP_GAIN_DB - MIN_CLIP_GAIN_DB)) * 10) / 10
      setDraftState((current) => Object.freeze({ ...current, gainDb }))
      return
    }
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    if (drag.kind === 'fade-in') {
      const fadeInTicks = Math.min(Math.round(ratio * durationTicks), durationTicks - draft.fadeOutTicks)
      setDraftState((current) => Object.freeze({ ...current, fadeInTicks }))
    } else {
      const fadeOutTicks = Math.min(Math.round((1 - ratio) * durationTicks), durationTicks - draft.fadeInTicks)
      setDraftState((current) => Object.freeze({ ...current, fadeOutTicks }))
    }
  }

  const end = (event: ReactPointerEvent<HTMLButtonElement>, shouldCommit: boolean) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    // Re-read the release position before ending the gesture. Browsers may
    // coalesce the final movement into pointerup, and the accepted edit must
    // match the line/handle position where the user actually released.
    if (shouldCommit) move(event)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
    if (shouldCommit) commit(draftRef.current)
    else setDraftState(accepted)
  }

  const cancelOnEscape = (event: KeyboardEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (event.key !== 'Escape' || !drag) return
    event.preventDefault()
    event.stopPropagation()
    cancelDrag(event.currentTarget, drag.pointerId)
  }

  const keyboardGain = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next: number | null = null
    const step = event.shiftKey ? 3 : 1
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next = draft.gainDb + step
    else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next = draft.gainDb - step
    else if (event.key === 'Home') next = MIN_CLIP_GAIN_DB
    else if (event.key === 'End') next = MAX_CLIP_GAIN_DB
    if (next === null) return
    event.preventDefault()
    const state = Object.freeze({ ...draft, gainDb: clamp(next, MIN_CLIP_GAIN_DB, MAX_CLIP_GAIN_DB) })
    setDraftState(state)
    commit(state)
  }

  const gainTop = ((MAX_CLIP_GAIN_DB - draft.gainDb) / (MAX_CLIP_GAIN_DB - MIN_CLIP_GAIN_DB)) * 100
  const fadeInPercent = durationTicks <= 0 ? 0 : draft.fadeInTicks / durationTicks * 100
  const fadeOutPercent = durationTicks <= 0 ? 0 : draft.fadeOutTicks / durationTicks * 100

  return (
    <div
      ref={rootRef}
      className={`timeline-audio-direct${muted ? ' timeline-audio-direct--muted' : ''}`}
      aria-label="Direct audio controls"
      data-testid="timeline-audio-direct-controls"
    >
      <div className="timeline-audio-direct__fade timeline-audio-direct__fade--in" style={{ width: `${fadeInPercent}%` }} aria-hidden="true" />
      <div className="timeline-audio-direct__fade timeline-audio-direct__fade--out" style={{ width: `${fadeOutPercent}%` }} aria-hidden="true" />
      <button
        type="button"
        className="timeline-audio-direct__gain"
        style={{ top: `${gainTop}%` }}
        role="slider"
        aria-label="Clip gain"
        aria-valuemin={MIN_CLIP_GAIN_DB}
        aria-valuemax={MAX_CLIP_GAIN_DB}
        aria-valuenow={draft.gainDb}
        aria-valuetext={`${draft.gainDb.toFixed(1)} decibels`}
        disabled={disabled}
        onPointerDown={(event) => begin(event, 'gain')}
        onPointerMove={move}
        onPointerUp={(event) => end(event, true)}
        onPointerCancel={(event) => end(event, false)}
        onKeyDown={(event) => {
          cancelOnEscape(event)
          if (!dragRef.current) keyboardGain(event)
        }}
      ><span aria-hidden="true" /></button>
      <button
        type="button"
        className="timeline-audio-direct__fade-handle timeline-audio-direct__fade-handle--in"
        style={{ left: `${fadeInPercent}%` }}
        aria-label="Fade in duration"
        aria-valuetext={`${draft.fadeInTicks} ticks`}
        disabled={disabled}
        onPointerDown={(event) => begin(event, 'fade-in')}
        onPointerMove={move}
        onPointerUp={(event) => end(event, true)}
        onPointerCancel={(event) => end(event, false)}
        onKeyDown={cancelOnEscape}
      />
      <button
        type="button"
        className="timeline-audio-direct__fade-handle timeline-audio-direct__fade-handle--out"
        style={{ right: `${fadeOutPercent}%` }}
        aria-label="Fade out duration"
        aria-valuetext={`${draft.fadeOutTicks} ticks`}
        disabled={disabled}
        onPointerDown={(event) => begin(event, 'fade-out')}
        onPointerMove={move}
        onPointerUp={(event) => end(event, true)}
        onPointerCancel={(event) => end(event, false)}
        onKeyDown={cancelOnEscape}
      />
      <div className="timeline-audio-direct__readout" aria-live="polite">
        <span>{draft.gainDb.toFixed(1)} dB</span>
        <button
          type="button"
          aria-label="Reset clip audio"
          disabled={disabled || same(draft, Object.freeze({ gainDb: 0, fadeInTicks: 0, fadeOutTicks: 0, pan: supportsPan ? CENTRE_PAN : accepted.pan }))}
          onClick={() => {
            const next = Object.freeze({ gainDb: 0, fadeInTicks: 0, fadeOutTicks: 0, pan: supportsPan ? CENTRE_PAN : accepted.pan })
            setDraftState(next)
            commit(next)
          }}
        >Reset</button>
      </div>
      {supportsPan ? (
        <label className="timeline-audio-direct__pan">
          <span>Pan {panLabel(draft.pan)}</span>
          <input
            type="range"
            min={MIN_CLIP_PAN}
            max={MAX_CLIP_PAN}
            step={100}
            value={draft.pan}
            disabled={disabled}
            aria-label="Clip pan"
            aria-valuetext={panLabel(draft.pan)}
            onChange={(event) => setDraftState((current) => Object.freeze({ ...current, pan: Number(event.currentTarget.value) }))}
            onPointerDown={() => setPanPointerActive(true)}
            onPointerUp={() => {
              setPanPointerActive(false)
              commit()
            }}
            onPointerCancel={() => {
              setPanPointerActive(false)
              setDraftState(accepted)
            }}
            onKeyUp={(event) => {
              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) commit()
            }}
          />
          <button
            type="button"
            disabled={disabled || draft.pan === CENTRE_PAN}
            onClick={() => {
              const next = Object.freeze({ ...draft, pan: CENTRE_PAN })
              setDraftState(next)
              commit(next)
            }}
          >Center</button>
        </label>
      ) : null}
      {normalization ? (
        <div className="timeline-audio-direct__normalize" data-state={normalizationState.status}>
          {normalizationState.status === 'idle' ? (
            <button type="button" disabled={disabled} onClick={() => void analyze()}>
              Analyze loudness
            </button>
          ) : null}
          {normalizationState.status === 'analyzing' ? (
            <>
              <output aria-live="polite">Measuring loudness…</output>
              <button type="button" onClick={cancelNormalization}>Cancel analysis</button>
            </>
          ) : null}
          {normalizationState.status === 'error' ? (
            <>
              <output className="timeline-audio-direct__normalize-error" aria-live="polite">
                {normalizationState.message}
              </output>
              <button type="button" disabled={disabled} onClick={() => void analyze()}>Retry</button>
              <button type="button" onClick={cancelNormalization}>Dismiss</button>
            </>
          ) : null}
          {normalizationState.status === 'ready' ? (
            <>
              <output aria-live="polite">
                {normalizationState.evidence.integratedLufs.toFixed(1)} LUFS · peak {normalizationState.evidence.truePeakDb.toFixed(1)} dB · use {normalizationState.evidence.recommendedGainDb.toFixed(1)} dB
              </output>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = Object.freeze({
                    ...draft,
                    gainDb: normalizationState.evidence.recommendedGainDb,
                  })
                  setDraftState(next)
                  commit(next)
                  setNormalizationState({ status: 'idle' })
                }}
              >Apply normalization</button>
              <button type="button" onClick={cancelNormalization}>Cancel</button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
