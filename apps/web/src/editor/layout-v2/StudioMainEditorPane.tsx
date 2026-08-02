import { useEffect, type ReactNode } from 'react'
import { Group, Panel, useGroupRef, type LayoutChangedMeta } from 'react-resizable-panels'
import type { StudioLayoutV2State } from './studio-layout-contract'
import type { StudioResponsiveMode } from './studio-layout-responsive'
import { StudioPanelFrame } from './StudioPanelFrame'
import { StudioSeparator } from './StudioSeparator'
import { StudioUpperWorkspace } from './StudioUpperWorkspace'

export function StudioMainEditorPane({ layout, responsiveMode, media, preview, tool, timeline, onMainLayoutChanged, onUpperLayoutChanged }: Readonly<{
  layout: StudioLayoutV2State
  responsiveMode: StudioResponsiveMode
  media: ReactNode
  preview: ReactNode
  tool: ReactNode
  timeline: ReactNode
  onMainLayoutChanged(layout: readonly [number, number], meta: LayoutChangedMeta): void
  onUpperLayoutChanged(layout: readonly [number, number, number], meta: LayoutChangedMeta): void
}>) {
  const groupRef = useGroupRef()
  const compact = responsiveMode === 'mobile'
  useEffect(() => {
    try { groupRef.current?.setLayout({ 'studio-upper-pane': layout.mainVerticalLayout[0], 'studio-timeline-pane': layout.mainVerticalLayout[1] }) }
    catch { /* stale handle from an unmounted responsive group */ }
  }, [groupRef, layout.mainVerticalLayout])
  return (
    <Group id="studio-main-vertical-group" groupRef={groupRef} orientation="vertical" disabled={compact} className="studio-layout-v2__main" defaultLayout={{ 'studio-upper-pane': layout.mainVerticalLayout[0], 'studio-timeline-pane': layout.mainVerticalLayout[1] }} onLayoutChanged={(next, meta) => onMainLayoutChanged([next['studio-upper-pane'], next['studio-timeline-pane']], meta)}>
      <Panel id="studio-upper-pane" defaultSize={`${layout.mainVerticalLayout[0]}%`} minSize={300}><StudioUpperWorkspace layout={layout} responsiveMode={responsiveMode} media={media} preview={preview} tool={tool} onLayoutChanged={onUpperLayoutChanged} /></Panel>
      <StudioSeparator id="studio-timeline-separator" label="Resize Timeline pane" orientation="horizontal" disabled={compact} />
      <Panel id="studio-timeline-pane" defaultSize={`${layout.mainVerticalLayout[1]}%`} minSize={240} maxSize="65%"><StudioPanelFrame label="Timeline pane" kind="timeline">{timeline}</StudioPanelFrame></Panel>
    </Group>
  )
}
