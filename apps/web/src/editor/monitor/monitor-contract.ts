import type { ReactNode, Ref } from 'react'

export type MonitorFitMode = 'fit' | 'fill' | 'actual'
export type MonitorFrameRate = Readonly<{ numerator: number; denominator: number }>

export type EditorMonitorProps = Readonly<{
  children: ReactNode
  sourceStatus: string
  fitMode: MonitorFitMode
  guides: boolean
  pointActive: boolean
  pointSelected: boolean
  playing: boolean
  currentTicks: number
  durationTicks: number
  frameRate: MonitorFrameRate | null
  muted: boolean
  volume: number
  pointButtonRef?: Ref<HTMLButtonElement>
  onTogglePoint(): void
  onFitModeChange(mode: MonitorFitMode): void
  onGuidesChange(visible: boolean): void
  onTogglePlayback(): void
  onStepFrame(direction: -1 | 1): void
  onSeek(ticks: number): void
  onMutedChange(muted: boolean): void
  onVolumeChange(volume: number): void
}>
