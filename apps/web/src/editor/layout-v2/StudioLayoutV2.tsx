import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { Group, Panel, useGroupRef, usePanelRef, type LayoutChangedMeta } from 'react-resizable-panels'
import { StudioAiPane } from './StudioAiPane'
import { StudioMainEditorPane } from './StudioMainEditorPane'
import { StudioSeparator } from './StudioSeparator'
import { normalizeGroup, type StudioLayoutV2State } from './studio-layout-contract'
import type { StudioResponsiveMode } from './studio-layout-responsive'
import './StudioLayoutV2.css'

export function StudioLayoutV2({ layout, responsiveMode, aiOpen, pendingProposal = false, ai, media, preview, tool, timeline, onLayoutChange, onAiOpenChange }: Readonly<{
  layout: StudioLayoutV2State
  responsiveMode: StudioResponsiveMode
  aiOpen: boolean
  pendingProposal?: boolean
  ai: ReactNode
  media: ReactNode
  preview: ReactNode
  tool: ReactNode
  timeline: ReactNode
  onLayoutChange(layout: StudioLayoutV2State): void
  onAiOpenChange?(open: boolean): void
}>) {
  const rootRef = useGroupRef()
  const aiRef = usePanelRef()
  const overlayTriggerRef = useRef<HTMLButtonElement>(null)
  const wasAiOpenRef = useRef(aiOpen)
  const overlay = responsiveMode === 'tablet' || responsiveMode === 'mobile' || layout.aiMode === 'overlay'
  const effectiveAiMode = overlay ? 'overlay' : layout.aiMode
  useEffect(() => {
    try {
      if (aiOpen && !overlay) aiRef.current?.expand()
      else aiRef.current?.collapse()
    } catch {
      // The panel group can disappear before a queued passive effect during a
      // route transition. The next mounted layout is already authoritative.
    }
  }, [aiOpen, aiRef, overlay])
  useEffect(() => {
    if (overlay && wasAiOpenRef.current && !aiOpen) overlayTriggerRef.current?.focus()
    wasAiOpenRef.current = aiOpen
  }, [aiOpen, overlay])
  useEffect(() => {
    try {
      rootRef.current?.setLayout({ 'studio-ai-pane': layout.rootLayout[0], 'studio-main-pane': layout.rootLayout[1] })
    } catch {
      // Ignore only a stale imperative handle from an already-unmounted group.
    }
  }, [layout.rootLayout, rootRef])
  const commit = (patch: Partial<StudioLayoutV2State>, meta: LayoutChangedMeta) => {
    if (!meta.isUserInteraction) return
    onLayoutChange(Object.freeze({ ...layout, ...patch, preset: 'custom' }))
  }
  return (
    <div className="studio-layout-v2" data-responsive={responsiveMode} data-ai-mode={layout.aiMode} data-ai-open={aiOpen}>
      {overlay && !aiOpen ? <button ref={overlayTriggerRef} type="button" className="studio-layout-v2__ai-overlay-opener" aria-label="Open AI overlay" onClick={() => onAiOpenChange?.(true)}>{pendingProposal ? 'AI · 1 pending' : 'Open AI'}</button> : null}
      <Group id="studio-root-group" groupRef={rootRef} orientation="horizontal" disabled={overlay} className="studio-layout-v2__root" defaultLayout={{ 'studio-ai-pane': layout.rootLayout[0], 'studio-main-pane': layout.rootLayout[1] }} onLayoutChanged={(next, meta) => commit({ rootLayout: normalizeGroup([next['studio-ai-pane'], next['studio-main-pane']] as const) }, meta)}>
        <Panel id="studio-ai-pane" panelRef={aiRef} defaultSize={`${layout.rootLayout[0]}%`} minSize={320} maxSize={420} collapsible collapsedSize={52} groupResizeBehavior="preserve-pixel-size"><StudioAiPane mode={effectiveAiMode} open={aiOpen} pending={pendingProposal} onOpenChange={onAiOpenChange}>{ai}</StudioAiPane></Panel>
        <StudioSeparator id="studio-ai-separator" label="Resize AI pane" orientation="vertical" disabled={overlay} />
        <Panel id="studio-main-pane" defaultSize={`${layout.rootLayout[1]}%`} minSize={640} groupResizeBehavior="preserve-relative-size"><StudioMainEditorPane layout={layout} responsiveMode={responsiveMode} media={media} preview={preview} tool={tool} timeline={timeline} onMainLayoutChanged={(next, meta) => commit({ mainVerticalLayout: normalizeGroup(next) }, meta)} onUpperLayoutChanged={(next, meta) => commit({ upperLayout: normalizeGroup(next) }, meta)} /></Panel>
      </Group>
    </div>
  )
}
