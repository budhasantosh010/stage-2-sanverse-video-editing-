import { useRef, type KeyboardEvent } from 'react'

import { STUDIO_WORKSPACES, type StudioWorkspace } from './workspace-contract'
import './StudioWorkspaceShell.css'

const labels: Readonly<Record<StudioWorkspace, string>> = Object.freeze({
  edit: 'Edit',
  effects: 'Effects',
  color: 'Color',
  audio: 'Audio',
})

export function StudioWorkspaceTabs({
  value,
  onChange,
}: Readonly<{
  value: StudioWorkspace
  onChange(value: StudioWorkspace): void
}>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % STUDIO_WORKSPACES.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + STUDIO_WORKSPACES.length) % STUDIO_WORKSPACES.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = STUDIO_WORKSPACES.length - 1
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onChange(STUDIO_WORKSPACES[index])
      return
    } else return
    event.preventDefault()
    refs.current[next]?.focus()
  }

  return (
    <div className="studio-workspace-tabs" role="tablist" aria-label="Studio workspaces">
      {STUDIO_WORKSPACES.map((workspace, index) => (
        <button
          key={workspace}
          ref={(node) => { refs.current[index] = node }}
          id={`studio-workspace-tab-${workspace}`}
          type="button"
          role="tab"
          aria-selected={value === workspace}
          aria-controls={`studio-workspace-panel-${workspace}`}
          tabIndex={value === workspace ? 0 : -1}
          onKeyDown={(event) => move(event, index)}
          onClick={() => onChange(workspace)}
        >
          {labels[workspace]}
        </button>
      ))}
    </div>
  )
}
