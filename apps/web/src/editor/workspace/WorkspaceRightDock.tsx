import { useRef, type KeyboardEvent, type ReactNode } from 'react'

import type { StudioWorkspace, WorkspaceRightTab } from './workspace-contract'

const toolLabel: Readonly<Record<StudioWorkspace, string>> = Object.freeze({
  edit: 'Inspector',
  effects: 'Effect controls',
  color: 'Color controls',
  audio: 'Audio controls',
})

export function WorkspaceRightDock({
  workspace,
  assist = false,
  activeTab,
  onTabChange,
  tool,
  ai,
}: Readonly<{
  workspace: StudioWorkspace
  assist?: boolean
  activeTab: WorkspaceRightTab
  onTabChange(tab: WorkspaceRightTab): void
  tool: ReactNode
  ai: ReactNode
}>) {
  const toolRef = useRef<HTMLButtonElement>(null)
  const aiRef = useRef<HTMLButtonElement>(null)
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, tab: WorkspaceRightTab) => {
    let next: WorkspaceRightTab | null = null
    if (event.key === 'ArrowLeft') next = tab === 'tool' ? 'ai' : 'tool'
    else if (event.key === 'ArrowRight') next = tab === 'ai' ? 'tool' : 'ai'
    else if (event.key === 'Home') next = 'tool'
    else if (event.key === 'End') next = 'ai'
    else if (event.key === 'Enter' || event.key === ' ') next = tab
    if (!next) return
    event.preventDefault()
    onTabChange(next)
    ;(next === 'tool' ? toolRef.current : aiRef.current)?.focus()
  }

  return (
    <section className={`workspace-right-dock${assist ? ' workspace-right-dock--assist' : ''}`} aria-label={assist ? undefined : 'Studio right dock'}>
      <div className="workspace-right-dock__tabs" role="tablist" aria-label="Right dock panels" hidden={assist}>
        <button ref={toolRef} type="button" role="tab" aria-selected={activeTab === 'tool'} aria-controls="workspace-right-tool" tabIndex={activeTab === 'tool' ? 0 : -1} onKeyDown={(event) => handleKey(event, 'tool')} onClick={() => onTabChange('tool')}>Tool</button>
        <button ref={aiRef} type="button" role="tab" aria-selected={activeTab === 'ai'} aria-controls="workspace-right-ai" tabIndex={activeTab === 'ai' ? 0 : -1} onKeyDown={(event) => handleKey(event, 'ai')} onClick={() => onTabChange('ai')}>AI</button>
      </div>
      <section id="workspace-right-tool" role="tabpanel" aria-label={toolLabel[workspace]} hidden={assist || activeTab !== 'tool'}>{tool}</section>
      <section id="workspace-right-ai" role={assist ? 'region' : 'tabpanel'} aria-label={assist ? 'Conversation' : 'AI edits'} hidden={!assist && activeTab !== 'ai'}>{ai}</section>
    </section>
  )
}
