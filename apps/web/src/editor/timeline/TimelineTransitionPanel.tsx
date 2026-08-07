import { useEffect, useState } from 'react'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'
import type {
  TimelineTransitionSubject,
  TransitionAudioV1,
  TransitionStyleV1,
} from '../../features/timeline/timeline-transition-plan'

const MIN_DIP_SECONDS = 0.05
const MAX_DIP_SECONDS = 2
const STEP_SECONDS = 0.05

export function TimelineTransitionPanel({
  open,
  subject,
  busy,
  onApply,
  onClose,
}: Readonly<{
  open: boolean
  subject: TimelineTransitionSubject | null
  busy: boolean
  onApply(style: TransitionStyleV1, durationTicks: number, audio: TransitionAudioV1): void
  onClose(): void
}>) {
  const [style, setStyle] = useState<TransitionStyleV1>('dip-to-black')
  const [seconds, setSeconds] = useState(0.5)
  const [audio, setAudio] = useState<TransitionAudioV1>('fade-through-silence')

  useEffect(() => {
    if (!subject) return
    setStyle(subject.style === 'none' ? 'dip-to-black' : subject.style)
    setSeconds(subject.durationTicks > 0 ? subject.durationTicks / PROJECT_TIMESCALE : 0.5)
    setAudio(subject.audio)
  }, [subject?.clipId, subject?.nextClipId, subject?.style, subject?.durationTicks, subject?.audio])

  if (!open) return null
  return (
    <div className="timeline-speed timeline-transition" role="group" aria-label="Transition">
      <div className="timeline-speed__head">
        <strong>Transition</strong>
        <button type="button" className="timeline-speed__close" onClick={onClose} aria-label="Close transition panel">Close</button>
      </div>
      {subject === null ? (
        <p className="timeline-speed__unavailable">Choose a main-video piece that has another piece directly after it.</p>
      ) : (
        <>
          <p className="timeline-speed__subject">{subject.clipLabel} → {subject.nextClipLabel}</p>
          <div className="timeline-speed__presets" role="radiogroup" aria-label="Transition style">
            {(['dip-to-black', 'dip-to-white'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className="timeline-speed__preset"
                aria-pressed={style === value}
                disabled={busy}
                onClick={() => setStyle(value)}
              >{value === 'dip-to-white' ? 'Dip to white' : 'Dip to black'}</button>
            ))}
          </div>
          <label className="timeline-speed__typed">
            <span>Duration</span>
            <input
              type="range"
              min={MIN_DIP_SECONDS}
              max={MAX_DIP_SECONDS}
              step={STEP_SECONDS}
              value={seconds}
              disabled={busy}
              aria-label="Transition duration handle"
              onChange={(event) => setSeconds(Number(event.currentTarget.value))}
            />
            <input
              type="number"
              min={MIN_DIP_SECONDS}
              max={MAX_DIP_SECONDS}
              step={STEP_SECONDS}
              value={seconds}
              disabled={busy}
              aria-label="Transition duration seconds"
              onChange={(event) => setSeconds(Math.min(MAX_DIP_SECONDS, Math.max(MIN_DIP_SECONDS, Number(event.currentTarget.value) || MIN_DIP_SECONDS)))}
            />
            <span>s</span>
          </label>
          <label className="timeline-speed__switch">
            <input
              type="checkbox"
              checked={audio === 'fade-through-silence'}
              disabled={busy}
              onChange={(event) => setAudio(event.currentTarget.checked ? 'fade-through-silence' : 'cut')}
            />
            <span>Fade the linked sound too<small>Off keeps the audio as a hard cut.</small></span>
          </label>
          <div className="timeline-speed__presets">
            <button
              type="button"
              className="timeline-speed__preset"
              disabled={busy}
              onClick={() => onApply(style, Math.round(seconds * PROJECT_TIMESCALE), audio)}
            >Apply transition</button>
            <button
              type="button"
              className="timeline-speed__preset"
              disabled={busy || subject.style === 'none'}
              onClick={() => onApply('none', 0, 'cut')}
            >Remove</button>
          </div>
          <p className="timeline-speed__range">Cross Dissolve, Wipe, Slide, Push and Zoom are not offered here because this preview path does not yet show two source shots at the same instant.</p>
        </>
      )}
    </div>
  )
}