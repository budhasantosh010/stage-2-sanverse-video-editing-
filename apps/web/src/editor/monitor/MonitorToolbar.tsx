import type { MonitorFitMode } from './monitor-contract'
import type { Ref } from 'react'
import { MonitorOverflowMenu } from './MonitorOverflowMenu'
import { MonitorPointTool } from './MonitorPointTool'

export function MonitorToolbar(props: Readonly<{
  sourceStatus: string
  fitMode: MonitorFitMode
  guides: boolean
  pointActive: boolean
  pointSelected: boolean
  fullscreen: boolean
  pointButtonRef?: Ref<HTMLButtonElement>
  onTogglePoint(): void
  onFitModeChange(mode: MonitorFitMode): void
  onGuidesChange(visible: boolean): void
  onFullscreen(): void
}>) {
  return <div className="editor-monitor__toolbar">
    <div className="editor-monitor__identity"><strong>Preview</strong><span className="editor-monitor__source" title={props.sourceStatus}><i aria-hidden="true" /> <span className="sr-only">{props.sourceStatus}</span></span></div>
    <div className="editor-monitor__toolbar-actions">
      <MonitorPointTool active={props.pointActive} selected={props.pointSelected} buttonRef={props.pointButtonRef} onToggle={props.onTogglePoint} />
      <label className="editor-monitor__fit"><span className="sr-only">Viewer mode</span><select aria-label="Viewer mode" value={props.fitMode} onChange={(event) => props.onFitModeChange(event.currentTarget.value as MonitorFitMode)}><option value="fit">Fit</option><option value="fill">Fill</option><option value="actual">100%</option></select></label>
      <span className="editor-monitor__ratio">16:9</span>
      <button type="button" className={`monitor-tool editor-monitor__guides${props.guides ? ' monitor-tool--active' : ''}`} aria-label="Toggle guides" aria-pressed={props.guides} onClick={() => props.onGuidesChange(!props.guides)}>Guides</button>
      <button type="button" className="monitor-tool" aria-label={props.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={props.fullscreen} onClick={props.onFullscreen}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4M13 3h4v4M7 17H3v-4M13 17h4v-4" /></svg></button>
      <MonitorOverflowMenu><p role="menuitem">{props.sourceStatus}</p><button role="menuitem" type="button" onClick={() => props.onGuidesChange(!props.guides)}>{props.guides ? 'Hide guides' : 'Show guides'}</button></MonitorOverflowMenu>
    </div>
  </div>
}
