import type { TimelineTrackId } from '@sanverse/edit-domain'
import type { AudioTrackStateV1, TimelineTrackRoleV2 } from '@sanverse/edit-domain/timeline-tracks'
import type { TimelineLaneKind } from '../../features/timeline'

export type TimelineTrackHeaderProps = Readonly<{
  trackId: TimelineTrackId
  label: string
  kind: TimelineLaneKind
  trackRole: TimelineTrackRoleV2
  trackName: string | null
  audioState: AudioTrackStateV1 | null
  waveformDisplayMode: 'combined' | 'separate'
  locked: boolean
  syncLockEnabled: boolean
  targeted: boolean
  outputEnabled: boolean
  outputDisabledReason: string | null
  heightPx: number
  collapsed: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  canDelete: boolean
  onToggleLock(): void
  onToggleSyncLock(): void
  onToggleTarget(): void
  onToggleOutput(): void
  onToggleMute(): void
  onToggleSolo(): void
  onGainDb(gainDb: number): void
  onPan(pan: number): void
  onWaveformDisplayMode(mode: 'combined' | 'separate'): void
  onRename(name: string | null): void
  onMoveUp(): void
  onMoveDown(): void
  onDelete(mode: 'empty-only' | 'with-contents'): void
  onSelectDirection(direction: 'forward' | 'backward'): void
  onToggleCollapsed(): void
  onHeight(height: 'compact' | 'standard' | 'tall' | number): void
}>

const roleMeaning = (role: TimelineTrackRoleV2): string => {
  switch (role) {
    case 'primary-video': return 'Primary video'
    case 'overlay-video': return 'Overlay'
    case 'generic-video': return 'Video'
    case 'captions': return 'Captions'
    case 'dialogue': return 'Dialogue'
    case 'music': return 'Music'
    case 'sfx': return 'Sound effects'
    case 'generic-audio': return 'Audio'
  }
}

const commitNumber = (
  event: React.FocusEvent<HTMLInputElement>,
  fallback: number,
  min: number,
  max: number,
  commit: (value: number) => void,
): void => {
  const value = Number(event.currentTarget.value)
  if (!Number.isFinite(value)) {
    event.currentTarget.value = String(fallback)
    return
  }
  const clamped = Math.min(max, Math.max(min, value))
  event.currentTarget.value = String(clamped)
  if (clamped !== fallback) commit(clamped)
}

export function TimelineTrackHeader({
  trackId,
  label,
  kind,
  trackRole,
  trackName,
  audioState,
  waveformDisplayMode,
  locked,
  syncLockEnabled,
  targeted,
  outputEnabled,
  outputDisabledReason,
  heightPx,
  collapsed,
  canMoveUp,
  canMoveDown,
  canDelete,
  onToggleLock,
  onToggleSyncLock,
  onToggleTarget,
  onToggleOutput,
  onToggleMute,
  onToggleSolo,
  onGainDb,
  onPan,
  onWaveformDisplayMode,
  onRename,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSelectDirection,
  onToggleCollapsed,
  onHeight,
}: TimelineTrackHeaderProps) {
  const sound = audioState !== null
  const meaning = roleMeaning(trackRole)
  const outputVerb = sound
    ? outputEnabled ? 'Disable output' : 'Enable output'
    : outputEnabled ? 'Hide' : 'Show'
  const outputExplanation = `${outputVerb} ${meaning.toLowerCase()} in the finished video. This changes what you export.`

  return (
    <div
      className={`timeline-v1__lane-header timeline-v1__lane-header--${kind}`}
      data-track-id={trackId}
      data-track-display-id={label}
      data-track-role={trackRole}
      data-track-locked={locked ? 'yes' : 'no'}
      data-track-sync-lock={syncLockEnabled ? 'on' : 'off'}
      data-track-targeted={targeted ? 'yes' : 'no'}
      data-track-output={outputEnabled ? 'on' : 'off'}
      data-track-collapsed={collapsed ? 'yes' : 'no'}
      style={{ ['--timeline-lane-height' as string]: `${heightPx}px` }}
    >
      <span className="timeline-v1__lane-header-name">
        <strong>{label}</strong>
        <span>{trackName || meaning}</span>
      </span>
      <span className="timeline-v1__lane-header-controls" data-t5-track-controls>
        <button
          type="button"
          className="timeline-v1__track-switch"
          aria-pressed={collapsed}
          aria-label={collapsed ? `Unfold ${label}` : `Fold ${label} away`}
          title={collapsed ? `${label} is folded away. Unfold it to see its contents.` : `Fold ${label} away. Your video is unaffected.`}
          data-track-collapse
          onClick={onToggleCollapsed}
        >
          <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
        </button>
        <label className="timeline-v1__track-height">
          <span className="timeline-v1__visually-hidden">How tall {label} is</span>
          <select
            value={heightPx <= 40 ? 'compact' : heightPx >= 80 ? 'tall' : 'standard'}
            data-track-height
            title={`How tall ${label} is drawn. Your video is unaffected.`}
            onChange={(event) => onHeight(event.target.value as 'compact' | 'standard' | 'tall')}
          >
            <option value="compact">Short</option>
            <option value="standard">Normal</option>
            <option value="tall">Tall</option>
          </select>
        </label>
        <button
          type="button"
          className="timeline-v1__track-switch"
          aria-pressed={targeted}
          aria-label={targeted ? `Stop targeting ${label}` : `Target ${label} for commands without an explicit destination`}
          title="Targeting changes where the next compatible command lands. It does not edit the video."
          data-track-target
          onClick={onToggleTarget}
        >
          <span aria-hidden="true">{targeted ? '◎' : '○'}</span>
        </button>
        <button
          type="button"
          className="timeline-v1__track-switch"
          aria-pressed={locked}
          aria-label={locked ? `Unlock ${label}` : `Lock ${label}`}
          title={locked ? `${label} is locked against direct changes. Your video is unaffected.` : `Lock ${label} against direct accidental changes. Your video is unaffected.`}
          data-track-lock
          onClick={onToggleLock}
        >
          <span aria-hidden="true">{locked ? '🔒' : '🔓'}</span>
        </button>
        <button
          type="button"
          className="timeline-v1__track-switch"
          aria-pressed={syncLockEnabled}
          aria-label={syncLockEnabled ? `Turn Sync Lock off for ${label}` : `Turn Sync Lock on for ${label}`}
          title="Sync Lock decides whether this track follows ripple timing changes elsewhere."
          data-track-sync-lock
          onClick={onToggleSyncLock}
        >
          <span aria-hidden="true">{syncLockEnabled ? '🔗' : '⛓'}</span>
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
          <span aria-hidden="true">{sound ? (outputEnabled ? '🔊' : '🔇') : outputEnabled ? '👁' : '🚫'}</span>
        </button>
        {audioState ? (
          <>
            <button
              type="button"
              className="timeline-v1__track-switch"
              aria-pressed={audioState.muted}
              title="Mute this track in Preview and export."
              data-track-mute
              onClick={onToggleMute}
            >M</button>
            <button
              type="button"
              className="timeline-v1__track-switch"
              aria-pressed={audioState.solo}
              title="Solo this audio track. While any audio track is soloed, non-solo audio tracks are silent."
              data-track-solo
              onClick={onToggleSolo}
            >S</button>
          </>
        ) : null}
        <details className="timeline-v1__track-more">
          <summary aria-label={`More controls for ${label}`} title={`More controls for ${label}`}>•••</summary>
          <div className="timeline-v1__track-more-panel">
            <label>
              <span>Name</span>
              <input
                key={`${trackId}:${trackName ?? ''}`}
                type="text"
                defaultValue={trackName ?? ''}
                maxLength={64}
                data-track-name
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') {
                    event.currentTarget.value = trackName ?? ''
                    event.currentTarget.blur()
                  }
                }}
                onBlur={(event) => {
                  const next = event.currentTarget.value.trim() || null
                  if (next !== trackName) onRename(next)
                }}
              />
            </label>
            {audioState ? (
              <>
                <label>
                  <span>Gain dB</span>
                  <input
                    key={`${trackId}:gain:${audioState.gainDb}`}
                    type="number"
                    min={-60}
                    max={12}
                    step={0.5}
                    defaultValue={audioState.gainDb}
                    data-track-gain
                    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                    onBlur={(event) => commitNumber(event, audioState.gainDb, -60, 12, onGainDb)}
                  />
                </label>
                <label>
                  <span>Waveform</span>
                  <select
                    value={waveformDisplayMode}
                    data-track-waveform-mode
                    title="Combined draws one truthful loudest-channel shape. Separate draws real L/R only when the file is confirmed stereo. This does not edit your video."
                    onChange={(event) => onWaveformDisplayMode(event.target.value as 'combined' | 'separate')}
                  >
                    <option value="combined">Combined</option>
                    <option value="separate">Separate L/R</option>
                  </select>
                </label>
                <label>
                  <span>Pan %</span>
                  <input
                    key={`${trackId}:pan:${audioState.pan}`}
                    type="number"
                    min={-100}
                    max={100}
                    step={1}
                    defaultValue={audioState.pan / 100}
                    data-track-pan
                    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                    onBlur={(event) => commitNumber(event, audioState.pan / 100, -100, 100, (value) => onPan(Math.round(value * 100)))}
                  />
                </label>
              </>
            ) : null}
            <span className="timeline-v1__track-more-row">
              <button type="button" disabled={!canMoveUp || locked} onClick={onMoveUp}>Move up</button>
              <button type="button" disabled={!canMoveDown || locked} onClick={onMoveDown}>Move down</button>
            </span>
            <span className="timeline-v1__track-more-row">
              <button type="button" onClick={() => onSelectDirection('backward')}>Select ←</button>
              <button type="button" onClick={() => onSelectDirection('forward')}>Select →</button>
            </span>
            <span className="timeline-v1__track-more-row">
              <button type="button" disabled={!canDelete || locked} onClick={() => onDelete('empty-only')}>Delete empty</button>
              <button type="button" disabled={!canDelete || locked} onClick={() => onDelete('with-contents')}>Delete + contents</button>
            </span>
          </div>
        </details>
      </span>
    </div>
  )
}
