import type { MonitorFrameRate } from './monitor-contract'
import { formatMonitorTimecode } from './monitor-timecode'

export function MonitorTransport(props: Readonly<{
  playing: boolean
  currentTicks: number
  durationTicks: number
  frameRate: MonitorFrameRate | null
  muted: boolean
  volume: number
  onTogglePlayback(): void
  onStepFrame(direction: -1 | 1): void
  onSeek(ticks: number): void
  onMutedChange(muted: boolean): void
  onVolumeChange(volume: number): void
}>) {
  return <div className="editor-monitor__transport">
    <span className="editor-monitor__timecode">{formatMonitorTimecode(props.currentTicks, props.frameRate)}</span>
    <div className="editor-monitor__transport-main">
      <button type="button" aria-label="Previous frame" onClick={() => props.onStepFrame(-1)}>│◀</button>
      <button type="button" className="editor-monitor__play" aria-label={props.playing ? 'Pause' : 'Play'} onClick={props.onTogglePlayback}>{props.playing ? 'Ⅱ' : '▶'}</button>
      <button type="button" aria-label="Next frame" onClick={() => props.onStepFrame(1)}>▶│</button>
    </div>
    <span className="editor-monitor__duration">{formatMonitorTimecode(props.durationTicks, props.frameRate)}</span>
    <input className="editor-monitor__seek" aria-label="Monitor playhead" type="range" min={0} max={Math.max(1, props.durationTicks)} step={1} value={Math.min(props.durationTicks, Math.max(0, props.currentTicks))} onChange={(event) => props.onSeek(Number(event.currentTarget.value))} />
    <button type="button" className="editor-monitor__mute" aria-label={props.muted ? 'Unmute' : 'Mute'} onClick={() => props.onMutedChange(!props.muted)}>{props.muted ? 'Muted' : 'Sound'}</button>
    <input className="editor-monitor__volume" aria-label="Monitor volume" type="range" min={0} max={1} step={0.05} value={props.volume} onChange={(event) => props.onVolumeChange(Number(event.currentTarget.value))} />
  </div>
}
