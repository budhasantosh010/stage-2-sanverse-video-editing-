import { useState } from 'react'

import {
  FASTEST_LABEL,
  SLOWEST_LABEL,
  parseTypedSpeed,
} from '../../features/timeline/timeline-speed-plan'
import {
  NORMAL_PLAYBACK_RATE,
  PLAYBACK_RATE_PRESETS,
  formatPlaybackRate,
  playbackRatesEqual,
  type RationalPlaybackRateV1,
} from '@sanverse/edit-domain/clip-time'

/**
 * "HOW FAST SHOULD THIS BIT PLAY?"
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PANEL IS
 * ---------------------------------------------------------------------------
 *
 * A small panel that opens under the Speed button. Eight one-click speeds, a
 * box to type any other, two switches, and a way back to normal.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY REFUSAL IS SHOWN BEFORE THE BUTTON IS PRESSED
 * ---------------------------------------------------------------------------
 *
 * The panel never guesses. Whatever it is about to do, it asks the one planner
 * first and shows that planner's own answer — the new length, the speed, and
 * whether anything is in the way. Pressing the button then does exactly what
 * was on screen. There is no second calculation that could disagree.
 *
 * ---------------------------------------------------------------------------
 * HOW BACKWARDS PREVIEW STAYS HONEST
 * ---------------------------------------------------------------------------
 *
 * A browser video element cannot run at a negative playback rate. The switch
 * therefore records the canonical reverse edit and the Preview prepares a
 * short, bounded backwards proxy for that exact source interval. Until the
 * proxy is ready the original is never shown forwards. Export reads the same
 * direction from the render plan and uses FFmpeg's reverse filters.
 */

export type TimelineSpeedPanelProps = Readonly<{
  open: boolean
  /** Null when the user has not picked a piece of the main video. */
  clipLabel: string | null
  /** Why speed cannot be used right now, in one sentence. Null when it can. */
  unavailableReason: string | null
  currentRate: RationalPlaybackRateV1
  direction?: 'forward' | 'reverse'
  maintainAudioPitch: boolean
  /** How long the picked piece is on screen now, and how much recording it uses. */
  currentDurationTicks: number
  sourceDurationTicks: number
  timescale: number
  busy: boolean
  rateStretchActive?: boolean
  onRateStretchActive?(active: boolean): void
  /** What will happen if this speed/direction is chosen, straight from the planner. */
  previewFor(rate: RationalPlaybackRateV1, maintainAudioPitch: boolean, direction: 'forward' | 'reverse'): string
  onChoose(rate: RationalPlaybackRateV1, maintainAudioPitch: boolean, direction: 'forward' | 'reverse'): void
  onClose(): void
}>

const seconds = (ticks: number, timescale: number): string => `${(ticks / timescale).toFixed(2)}s`

export function TimelineSpeedPanel({
  open,
  clipLabel,
  unavailableReason,
  currentRate,
  direction = 'forward',
  maintainAudioPitch,
  currentDurationTicks,
  sourceDurationTicks,
  timescale,
  busy,
  rateStretchActive = false,
  onRateStretchActive = () => undefined,
  previewFor,
  onChoose,
  onClose,
}: TimelineSpeedPanelProps) {
  const [typed, setTyped] = useState('')
  const [typedError, setTypedError] = useState<string | null>(null)
  const [keepPitch, setKeepPitch] = useState(maintainAudioPitch)

  if (!open) return null

  const applyTyped = () => {
    const parsed = parseTypedSpeed(typed)
    if (!parsed.ok) {
      setTypedError(parsed.refusal.message)
      return
    }
    setTypedError(null)
    onChoose(parsed.rate, keepPitch, direction)
  }

  return (
    <div className="timeline-speed" role="group" aria-label="Speed">
      <div className="timeline-speed__head">
        <strong>How fast should this play?</strong>
        <button type="button" className="timeline-speed__close" onClick={onClose} aria-label="Close the speed panel">
          Close
        </button>
      </div>

      {unavailableReason !== null ? (
        <p className="timeline-speed__unavailable">{unavailableReason}</p>
      ) : (
        <>
          <p className="timeline-speed__subject">
            {clipLabel ?? 'This piece'} — {seconds(currentDurationTicks, timescale)} on screen, made from{' '}
            {seconds(sourceDurationTicks, timescale)} of recording.
          </p>

          <div className="timeline-speed__presets">
            {PLAYBACK_RATE_PRESETS.map((rate) => {
              const isCurrent = playbackRatesEqual(rate, currentRate)
              return (
                <button
                  key={`${rate.numerator}/${rate.denominator}`}
                  type="button"
                  className="timeline-speed__preset"
                  aria-pressed={isCurrent}
                  disabled={busy}
                  title={previewFor(rate, keepPitch, direction)}
                  onClick={() => onChoose(rate, keepPitch, direction)}
                >
                  {formatPlaybackRate(rate)}
                </button>
              )
            })}
          </div>

          <label className="timeline-speed__typed">
            <span>Or type one</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="1.5x or 150%"
              value={typed}
              disabled={busy}
              onChange={(event) => {
                setTyped(event.target.value)
                setTypedError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  applyTyped()
                }
              }}
            />
            <button type="button" disabled={busy || typed.trim().length === 0} onClick={applyTyped}>
              Use it
            </button>
          </label>
          <p className="timeline-speed__range">
            Anything from {SLOWEST_LABEL} to {FASTEST_LABEL}.
          </p>
          {typedError !== null ? <p className="timeline-speed__error">{typedError}</p> : null}

          <label className="timeline-speed__switch">
            <input
              type="checkbox"
              checked={rateStretchActive}
              disabled={busy}
              onChange={(event) => onRateStretchActive(event.target.checked)}
            />
            <span>
              Rate Stretch tool
              <small>Drag the striped end handle to choose a duration. Sanverse derives the exact rational speed.</small>
            </span>
          </label>

          <label className="timeline-speed__switch">
            <input
              type="checkbox"
              checked={keepPitch}
              disabled={busy}
              onChange={(event) => setKeepPitch(event.target.checked)}
            />
            <span>
              Keep voices sounding normal
              <small>Turn this off for the squeaky, sped-up-tape sound.</small>
            </span>
          </label>

          <label className="timeline-speed__switch">
            <input
              type="checkbox"
              checked={direction === 'reverse'}
              disabled={busy}
              onChange={(event) => onChoose(
                currentRate,
                keepPitch,
                event.target.checked ? 'reverse' : 'forward',
              )}
            />
            <span>
              Play it backwards
              <small>Sanverse prepares a short backwards preview, then uses the same edit for export.</small>
            </span>
          </label>

          <button
            type="button"
            className="timeline-speed__reset"
            disabled={busy || (playbackRatesEqual(currentRate, NORMAL_PLAYBACK_RATE) && direction === 'forward' && maintainAudioPitch)}
            title={previewFor(NORMAL_PLAYBACK_RATE, true, 'forward')}
            onClick={() => onChoose(NORMAL_PLAYBACK_RATE, true, 'forward')}
          >
            Back to normal speed
          </button>
        </>
      )}
    </div>
  )
}
