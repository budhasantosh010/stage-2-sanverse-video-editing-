import type { ReactNode } from 'react'

import {
  saveStateMessage,
  saveStateOffersRetry,
  type SaveStateV1,
} from '../features/save/save-state'
import { Button, DisabledAction, IconButton, SegmentedControl } from './ui'
import { StudioWorkspaceTabs, type StudioWorkspace } from './workspace'
import './EditorShell.css'

export type EditorWorkspace = 'assist' | 'studio'

export type EditorShellProps = {
  workspace: EditorWorkspace
  studioWorkspace: StudioWorkspace
  projectName: string
  saveState: SaveStateV1
  /** Absent means there is nothing to retry with, so no button is offered. */
  onRetrySave?: (() => void) | undefined
  undoDisabledReason: string | null
  redoDisabledReason: string | null
  exportDisabledReason: string | null
  isExporting: boolean
  exportStatusMessage?: string | null
  exportReadyUrl?: string | null
  onWorkspaceChange(workspace: EditorWorkspace): void
  onStudioWorkspaceChange(workspace: StudioWorkspace): void
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


export function EditorShell({
  workspace,
  studioWorkspace,
  projectName,
  saveState,
  onRetrySave,
  undoDisabledReason,
  redoDisabledReason,
  exportDisabledReason,
  isExporting,
  exportStatusMessage = null,
  exportReadyUrl = null,
  onWorkspaceChange,
  onStudioWorkspaceChange,
  onBack,
  onUndo,
  onRedo,
  onExport,
  children,
}: EditorShellProps) {
  const undoDisabled = undoDisabledReason !== null
  const redoDisabled = redoDisabledReason !== null
  const exportDisabled = exportDisabledReason !== null

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
            className={`editor-shell__save editor-shell__save--${saveState.status}`}
            role="status"
            aria-label="Project save status"
          >
            {saveStateMessage(saveState)}
          </span>
          {/*
            Something to press, whenever there is something the user can do.
            The state this replaced said "Local save needs attention" and gave
            them nothing to press, so the only move left was to guess.
          */}
          {saveStateOffersRetry(saveState) && onRetrySave ? (
            <Button variant="secondary" aria-label="Try saving again" onClick={onRetrySave}>
              Try saving again
            </Button>
          ) : null}
          <DisabledAction disabled={undoDisabled} label="Undo edit" reason={undoDisabledReason}>
            <IconButton label="Undo edit" icon="↶" disabled={undoDisabled} onClick={onUndo} />
          </DisabledAction>
          <DisabledAction disabled={redoDisabled} label="Redo edit" reason={redoDisabledReason}>
            <IconButton label="Redo edit" icon="↷" disabled={redoDisabled} onClick={onRedo} />
          </DisabledAction>
          <DisabledAction disabled={exportDisabled} label="Export" reason={exportDisabledReason}>
            <Button
              variant="primary"
              aria-label={isExporting ? 'Exporting video' : exportDisabled ? 'Export unavailable' : 'Export video'}
              disabled={exportDisabled}
              loading={isExporting}
              onClick={onExport}
            >
              {isExporting ? 'Exporting' : 'Export'}
            </Button>
          </DisabledAction>
          {exportStatusMessage ? (
            <span className="editor-shell__export-status" role="status" aria-label="Global export status">
              {exportStatusMessage}
            </span>
          ) : null}
          {exportReadyUrl ? (
            <a className="editor-shell__export-download" href={exportReadyUrl} download="sanverse-edited.mp4" aria-label="Download exported MP4">
              Download
            </a>
          ) : null}
        </div>
      </header>

      {workspace === 'studio' ? (
        <div className="editor-shell__studio-workspaces">
          <StudioWorkspaceTabs value={studioWorkspace} onChange={onStudioWorkspaceChange} />
        </div>
      ) : null}

      <div className="editor-shell__workspace" aria-label={`${workspace === 'assist' ? 'Assist' : 'Studio'} workspace`}>
        {children}
      </div>
    </div>
  )
}
