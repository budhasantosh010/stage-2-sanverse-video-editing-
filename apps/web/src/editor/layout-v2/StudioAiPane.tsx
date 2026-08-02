import { useEffect, type ReactNode } from 'react'
import type { StudioAiMode } from './studio-layout-contract'
import { StudioPanelFrame } from './StudioPanelFrame'

export function StudioAiPane({ mode, open, pending = false, onOpenChange, children }: Readonly<{
  mode: StudioAiMode
  open: boolean
  pending?: boolean
  onOpenChange?(open: boolean): void
  children: ReactNode
}>) {
  const visible = mode === 'expanded' || open
  const label = mode === 'overlay' ? (visible ? 'Close AI overlay' : 'Open AI overlay') : visible ? 'Collapse AI' : 'Expand AI'
  useEffect(() => {
    if (mode !== 'overlay' || !visible) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onOpenChange?.(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [mode, onOpenChange, visible])
  return (
    <StudioPanelFrame label="AI editor" kind="ai">
      <div className="studio-layout-v2__ai" data-mode={mode} data-open={visible}>
        {mode !== 'overlay' || visible ? <button type="button" className="studio-layout-v2__ai-toggle" aria-label={label} aria-expanded={visible} onClick={() => onOpenChange?.(!visible)}>
          <span aria-hidden="true">AI</span><span className="studio-layout-v2__ai-toggle-label">{label}</span>{pending ? <span role="status" aria-label="Pending AI proposal">1 pending</span> : null}
        </button> : null}
        <div className="studio-layout-v2__ai-content" aria-hidden={!visible} inert={!visible ? true : undefined}>{children}</div>
      </div>
    </StudioPanelFrame>
  )
}
