import type { ReactNode } from 'react'

import { Button, IconButton, SegmentedControl } from './ui'
import './EditorShell.css'

export type EditorWorkspace = 'assist' | 'studio'

export type EditorShellProps = {
  workspace: EditorWorkspace
  projectName: string
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  canUndo: boolean
  canRedo: boolean
  canExport: boolean
  isExporting: boolean
  onWorkspaceChange(workspace: EditorWorkspace): void
  onBack(): void
  onUndo(): void
  onRedo(): void
  onExport(): void
  children: ReactNode
}

const WORKSPACES = Object.freeze([
  {
    value: 'assist',
    label: 'Assist',
    description: 'Describe the result and review proposed changes.',
  },
  {
    value: 'studio',
    label: 'Studio',
    description: 'Use the editing controls directly.',
  },
] satisfies ReadonlyArray<{
  value: EditorWorkspace
  label: string
  description: string
}>)

function saveMessage(saveState: EditorShellProps['saveState']) {
  if (saveState === 'saving') return 'Saving locally…'
  if (saveState === 'saved') return 'Saved locally'
  if (saveState === 'error') return 'Local save needs attention'
  return 'Local project'
}

export function EditorShell({
  workspace,
  projectName,
  saveState,
  canUndo,
  canRedo,
  canExport,
  isExporting,
  onWorkspaceChange,
  onBack,
  onUndo,
  onRedo,
  onExport,
  children,
}: EditorShellProps) {
  return (
    <div className="editor-shell" data-workspace={workspace}>
      <header className="editor-shell__topbar">
        <div className="editor-shell__start">
          <IconButton label="Back to Home" icon="←" onClick={onBack} />
          <div className="editor-shell__identity">
            <span className="editor-shell__mark" aria-hidden="true">S</span>
            <div>
              <span className="editor-shell__brand">Sanverse</span>
              <strong title={projectName}>{projectName}</strong>
            </div>
          </div>
        </div>

        <SegmentedControl
          label="Editing workspace"
          value={workspace}
          options={WORKSPACES}
          onChange={onWorkspaceChange}
        />

        <div className="editor-shell__actions">
          <span
            className={`editor-shell__save editor-shell__save--${saveState}`}
            role="status"
            aria-label="Project save status"
          >
            {saveMessage(saveState)}
          </span>
          <IconButton label="Undo edit" icon="↶" disabled={!canUndo} onClick={onUndo} />
          <IconButton label="Redo edit" icon="↷" disabled={!canRedo} onClick={onRedo} />
          <Button
            variant="primary"
            aria-label={isExporting ? 'Exporting video' : canExport ? 'Export video' : 'Export unavailable'}
            disabled={!canExport}
            loading={isExporting}
            onClick={onExport}
          >
            {isExporting ? 'Exporting' : 'Export'}
          </Button>
        </div>
      </header>

      <div className="editor-shell__workspace" aria-label={`${workspace === 'assist' ? 'Assist' : 'Studio'} workspace`}>
        {children}
      </div>
    </div>
  )
}
