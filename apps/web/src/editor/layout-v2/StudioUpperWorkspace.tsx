import type { ReactNode } from 'react'
import { Group, Panel, useGroupRef, usePanelRef, type LayoutChangedMeta } from 'react-resizable-panels'
import { useEffect, useRef } from 'react'
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
  const initialLayoutRef = useRef(layout.upperLayout)
  const compact = responsiveMode === 'tablet' || responsiveMode === 'mobile'
  const mediaCollapsed = compact || layout.mediaCollapsed
  const toolCollapsed = compact || layout.toolCollapsed
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { groupRef.current?.setLayout({ 'studio-media-pane': layout.upperLayout[0], 'studio-preview-pane': layout.upperLayout[1], 'studio-tool-pane': layout.upperLayout[2] }) }
      catch { /* stale handle from an unmounted responsive group */ }
    })
    return () => cancelAnimationFrame(frame)
  }, [groupRef, layout.upperLayout, responsiveMode])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const panel = mediaRef.current
        if (mediaCollapsed) panel?.collapse()
        else if (panel) {
          if (panel.isCollapsed()) panel.expand()
          if (panel.getSize().inPixels <= 1) panel.resize(`${layout.upperLayout[0]}%`)
        }
      }
      catch { /* stale handle from an unmounted responsive group */ }
    })
    return () => cancelAnimationFrame(frame)
  }, [layout.upperLayout, mediaCollapsed, mediaRef])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const panel = toolRef.current
        if (toolCollapsed) panel?.collapse()
        else if (panel) {
          if (panel.isCollapsed()) panel.expand()
          if (panel.getSize().inPixels <= 1) panel.resize(`${layout.upperLayout[2]}%`)
        }
      }
      catch { /* stale handle from an unmounted responsive group */ }
    })
    return () => cancelAnimationFrame(frame)
  }, [layout.upperLayout, toolCollapsed, toolRef])
  return (
    <Group id="studio-upper-group" groupRef={groupRef} orientation={compact ? 'vertical' : 'horizontal'} disabled={compact} className="studio-layout-v2__upper" defaultLayout={{ 'studio-media-pane': initialLayoutRef.current[0], 'studio-preview-pane': initialLayoutRef.current[1], 'studio-tool-pane': initialLayoutRef.current[2] }} onLayoutChanged={(next, meta) => onLayoutChanged([next['studio-media-pane'], next['studio-preview-pane'], next['studio-tool-pane']], meta)}>
      <Panel id="studio-media-pane" panelRef={mediaRef} defaultSize={`${initialLayoutRef.current[0]}%`} minSize={220} maxSize={420} collapsible collapsedSize={0} groupResizeBehavior="preserve-pixel-size"><StudioPanelFrame label="Media pane" kind="media">{media}</StudioPanelFrame></Panel>
      <StudioSeparator id="studio-media-separator" label="Resize Media pane" orientation={compact ? 'horizontal' : 'vertical'} disabled={compact} />
      <Panel id="studio-preview-pane" defaultSize={`${initialLayoutRef.current[1]}%`} minSize={compact ? 280 : 480} groupResizeBehavior="preserve-relative-size"><StudioPanelFrame label="Preview pane" kind="preview">{preview}</StudioPanelFrame></Panel>
      <StudioSeparator id="studio-tool-separator" label="Resize Tool pane" orientation={compact ? 'horizontal' : 'vertical'} disabled={compact} />
      <Panel id="studio-tool-pane" panelRef={toolRef} defaultSize={`${initialLayoutRef.current[2]}%`} minSize={300} maxSize={520} collapsible collapsedSize={0} groupResizeBehavior="preserve-pixel-size"><StudioPanelFrame label="Tool pane" kind="tool">{tool}</StudioPanelFrame></Panel>
    </Group>
  )
}
