import type { ReactNode } from 'react'
import { Group, Panel, useGroupRef, usePanelRef, type LayoutChangedMeta } from 'react-resizable-panels'
import { useEffect } from 'react'
import type { StudioLayoutV2State } from './studio-layout-contract'
import type { StudioResponsiveMode } from './studio-layout-responsive'
import { StudioPanelFrame } from './StudioPanelFrame'
import { StudioSeparator } from './StudioSeparator'

export function StudioUpperWorkspace({ layout, responsiveMode, media, preview, tool, onLayoutChanged }: Readonly<{
  layout: StudioLayoutV2State
  responsiveMode: StudioResponsiveMode
  media: ReactNode
  preview: ReactNode
  tool: ReactNode
  onLayoutChanged(layout: readonly [number, number, number], meta: LayoutChangedMeta): void
}>) {
  const groupRef = useGroupRef()
  const mediaRef = usePanelRef()
  const toolRef = usePanelRef()
  const compact = responsiveMode === 'tablet' || responsiveMode === 'mobile'
  const mediaCollapsed = compact || layout.mediaCollapsed
  const toolCollapsed = compact || layout.toolCollapsed
  useEffect(() => {
    try { groupRef.current?.setLayout({ 'studio-media-pane': layout.upperLayout[0], 'studio-preview-pane': layout.upperLayout[1], 'studio-tool-pane': layout.upperLayout[2] }) }
    catch { /* stale handle from an unmounted responsive group */ }
  }, [groupRef, layout.upperLayout])
  useEffect(() => {
    try { mediaCollapsed ? mediaRef.current?.collapse() : mediaRef.current?.expand() }
    catch { /* stale handle from an unmounted responsive group */ }
  }, [mediaCollapsed, mediaRef])
  useEffect(() => {
    try { toolCollapsed ? toolRef.current?.collapse() : toolRef.current?.expand() }
    catch { /* stale handle from an unmounted responsive group */ }
  }, [toolCollapsed, toolRef])
  return (
    <Group id="studio-upper-group" groupRef={groupRef} orientation={compact ? 'vertical' : 'horizontal'} disabled={compact} className="studio-layout-v2__upper" defaultLayout={{ 'studio-media-pane': layout.upperLayout[0], 'studio-preview-pane': layout.upperLayout[1], 'studio-tool-pane': layout.upperLayout[2] }} onLayoutChanged={(next, meta) => onLayoutChanged([next['studio-media-pane'], next['studio-preview-pane'], next['studio-tool-pane']], meta)}>
      <Panel id="studio-media-pane" panelRef={mediaRef} defaultSize={`${layout.upperLayout[0]}%`} minSize={220} maxSize={420} collapsible collapsedSize={0} groupResizeBehavior="preserve-pixel-size"><StudioPanelFrame label="Media pane" kind="media">{media}</StudioPanelFrame></Panel>
      <StudioSeparator id="studio-media-separator" label="Resize Media pane" orientation={compact ? 'horizontal' : 'vertical'} disabled={compact} />
      <Panel id="studio-preview-pane" defaultSize={`${layout.upperLayout[1]}%`} minSize={compact ? 280 : 480} groupResizeBehavior="preserve-relative-size"><StudioPanelFrame label="Preview pane" kind="preview">{preview}</StudioPanelFrame></Panel>
      <StudioSeparator id="studio-tool-separator" label="Resize Tool pane" orientation={compact ? 'horizontal' : 'vertical'} disabled={compact} />
      <Panel id="studio-tool-pane" panelRef={toolRef} defaultSize={`${layout.upperLayout[2]}%`} minSize={300} maxSize={520} collapsible collapsedSize={0} groupResizeBehavior="preserve-pixel-size"><StudioPanelFrame label="Tool pane" kind="tool">{tool}</StudioPanelFrame></Panel>
    </Group>
  )
}
