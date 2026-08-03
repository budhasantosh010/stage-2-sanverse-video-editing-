import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'
import type { MonitorFrameRate } from './monitor-contract'

const safeTicks = (ticks: number): number => Number.isFinite(ticks) ? Math.max(0, Math.round(ticks)) : 0

export function frameStepTicks(frameRate: MonitorFrameRate | null): number {
  if (!frameRate || !Number.isSafeInteger(frameRate.numerator) || frameRate.numerator <= 0 || !Number.isSafeInteger(frameRate.denominator) || frameRate.denominator <= 0) {
    return Math.round(PROJECT_TIMESCALE / 30)
  }
  return Math.max(1, Math.round(PROJECT_TIMESCALE * frameRate.denominator / frameRate.numerator))
}

export function formatMonitorTimecode(ticks: number, frameRate: MonitorFrameRate | null): string {
  const value = safeTicks(ticks)
  const wholeSeconds = Math.floor(value / PROJECT_TIMESCALE)
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const seconds = wholeSeconds % 60
  const base = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  if (!frameRate || frameRate.numerator <= 0 || frameRate.denominator <= 0) {
    const milliseconds = Math.floor((value % PROJECT_TIMESCALE) * 1000 / PROJECT_TIMESCALE)
    return `${base}.${String(milliseconds).padStart(3, '0')}`
  }
  const frame = Math.floor((value % PROJECT_TIMESCALE) * frameRate.numerator / (PROJECT_TIMESCALE * frameRate.denominator))
  return `${base}:${String(frame).padStart(2, '0')}`
}
