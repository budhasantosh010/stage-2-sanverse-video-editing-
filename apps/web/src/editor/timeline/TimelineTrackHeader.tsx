import type { TimelineTrackId } from '@sanverse/edit-domain'
import type { TimelineLaneKind } from '../../features/timeline'

/**
 * The label at the left of one track, with its two switches.
 *
 * The two are deliberately separate, and the wording says which is which:
 *
 *   PADLOCK   "stop me changing this by accident"
 *             changes nothing about the finished video
 *
 *   EYE / SPEAKER   "keep this out of the finished video"
 *                   changes the export, and is one Undo
 *
 * Neither is shown by colour alone. Each carries a symbol, a pressed state a
 * screen reader can read, and a sentence saying what it will do — because a
 * user who cannot tell a locked track from a hidden one will eventually export
 * a video with something missing and have no idea why.
 */

export type TimelineTrackHeaderProps = Readonly<{
  trackId: TimelineTrackId
  label: string
  kind: TimelineLaneKind
  locked: boolean
  outputEnabled: boolean
  /** Null when the output switch is available; otherwise why it is not. */
  outputDisabledReason: string | null
  /**
   * How tall this row is, from `timeline-lane-metrics.ts`.
   *
   * The header and its lane MUST be the same height or every label drifts away
   * from the clips it names. Passing the one number to both is what stops that
   * happening the day somebody changes a row height.
   */
  heightPx: number
  onToggleLock(): void
  onToggleOutput(): void
}>

/** What each track is, in the user's words rather than an editor's. */
const TRACK_MEANING: Readonly<Record<TimelineTrackId, string>> = Object.freeze({
  V2: 'Overlay',
  V1: 'Video',
  C1: 'Captions',
  A1: 'Dialogue',
  A2: 'Music',
})

const isSoundTrack = (trackId: TimelineTrackId): boolean => trackId === 'A1' || trackId === 'A2'

export function TimelineTrackHeader({
  trackId,
  label,
  kind,
  locked,
  outputEnabled,
  outputDisabledReason,
  heightPx,
  onToggleLock,
  onToggleOutput,
}: TimelineTrackHeaderProps) {
  const sound = isSoundTrack(trackId)
  const outputVerb = sound
    ? outputEnabled ? 'Mute' : 'Unmute'
    : outputEnabled ? 'Hide' : 'Show'
  const outputExplanation = sound
    ? `${outputVerb} ${TRACK_MEANING[trackId].toLowerCase()} in the finished video. This changes what you export.`
    : `${outputVerb} ${TRACK_MEANING[trackId].toLowerCase()} in the finished video. This changes what you export.`

  return (
    <div
      className={`timeline-v1__lane-header timeline-v1__lane-header--${kind}`}
      data-track-id={trackId}
      data-track-locked={locked ? 'yes' : 'no'}
      data-track-output={outputEnabled ? 'on' : 'off'}
      style={{ ['--timeline-lane-height' as string]: `${heightPx}px` }}
    >
      <span className="timeline-v1__lane-header-name">
        <strong>{label}</strong>
        <span>{TRACK_MEANING[trackId]}</span>
      </span>
      <span className="timeline-v1__lane-header-controls">
        <button
          type="button"
          className="timeline-v1__track-switch"
          aria-pressed={locked}
          aria-label={
            locked
              ? `Unlock ${label}. Locking only stops accidental changes; it never changes your video.`
              : `Lock ${label}. This only stops accidental changes; it never changes your video.`
          }
          title={
            locked
              ? `${label} is locked. Nothing on it can be moved, trimmed or deleted. Your video is unaffected.`
              : `Lock ${label} so nothing on it can be moved by accident. Your video is unaffected.`
          }
          data-track-lock
          onClick={onToggleLock}
        >
          <span aria-hidden="true">{locked ? '🔒' : '🔓'}</span>
        </button>
        <button
          type="button"
          className="timeline-v1__track-switch"
          aria-pressed={outputEnabled}
          disabled={outputDisabledReason !== null}
          aria-label={outputDisabledReason ? `${outputVerb} ${label} — ${outputDisabledReason}` : `${outputVerb} ${label}`}
          title={outputDisabledReason ?? outputExplanation}
          data-track-output-switch
          onClick={onToggleOutput}
        >
          <span aria-hidden="true">
            {sound ? (outputEnabled ? '🔊' : '🔇') : outputEnabled ? '👁' : '🚫'}
          </span>
        </button>
      </span>
    </div>
  )
}
