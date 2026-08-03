import type { ReactNode } from 'react'
import type { MonitorFitMode } from './monitor-contract'

export function MonitorStage({ fitMode, children }: Readonly<{ fitMode: MonitorFitMode; children: ReactNode }>) {
  return <div className={`editor-monitor__stage editor-monitor__stage--${fitMode}`}>{children}</div>
}
