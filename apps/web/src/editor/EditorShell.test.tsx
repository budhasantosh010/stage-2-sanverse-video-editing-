import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EditorShell, type EditorWorkspace } from './EditorShell'
import type { StudioWorkspace } from './workspace'

afterEach(cleanup)

function StatefulEditor() {
  const [value, setValue] = useState('')
  return (
    <label>
      Preserved editor state
      <input value={value} onChange={(event) => setValue(event.currentTarget.value)} />
    </label>
  )
}

function ShellHarness({
  onUndo = vi.fn(),
  onExport = vi.fn(),
  undoDisabledReason = null,
  redoDisabledReason = 'Nothing to redo yet.',
  exportDisabledReason = null,
  isExporting = false,
}: {
  onUndo?: () => void
  onExport?: () => void
  undoDisabledReason?: string | null
  redoDisabledReason?: string | null
  exportDisabledReason?: string | null
  isExporting?: boolean
}) {
  const [workspace, setWorkspace] = useState<EditorWorkspace>('assist')
  const [studioWorkspace, setStudioWorkspace] = useState<StudioWorkspace>('edit')

  return (
    <EditorShell
      workspace={workspace}
      studioWorkspace={studioWorkspace}
      projectName="cleaned-interview.mp4"
      saveState="saved"
      undoDisabledReason={undoDisabledReason}
      redoDisabledReason={redoDisabledReason}
      exportDisabledReason={exportDisabledReason}
      isExporting={isExporting}
      onWorkspaceChange={setWorkspace}
      onStudioWorkspaceChange={setStudioWorkspace}
      onBack={vi.fn()}
      onUndo={onUndo}
      onRedo={vi.fn()}
      onExport={onExport}
    >
      <StatefulEditor />
    </EditorShell>
  )
}

describe('EditorShell', () => {
  it('switches workspaces without remounting or clearing the active editor', async () => {
    const user = userEvent.setup()
    render(<ShellHarness />)

    const editorInput = screen.getByRole('textbox', { name: /preserved editor state/i })
    await user.type(editorInput, 'playhead and proposal stay here')

    expect(screen.getByRole('button', { name: /assist workspace/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: /studio workspace/i }))

    expect(screen.getByRole('button', { name: /studio workspace/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('textbox', { name: /preserved editor state/i })).toBe(editorInput)
    expect(editorInput).toHaveValue('playhead and proposal stay here')
  })

  it('shows advanced workspace tabs only in Studio and remembers the last Studio workspace', async () => {
    const user = userEvent.setup()
    render(<ShellHarness />)

    expect(screen.queryByRole('tablist', { name: 'Studio workspaces' })).not.toBeInTheDocument()
    const editorInput = screen.getByRole('textbox', { name: /preserved editor state/i })
    await user.type(editorInput, 'one editor')

    await user.click(screen.getByRole('button', { name: /studio workspace/i }))
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Edit', 'Effects', 'Color', 'Audio'])
    await user.click(screen.getByRole('tab', { name: 'Effects' }))
    expect(screen.getByRole('tab', { name: 'Effects' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: /assist workspace/i }))
    expect(screen.queryByRole('tablist', { name: 'Studio workspaces' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /preserved editor state/i })).toBe(editorInput)
    expect(editorInput).toHaveValue('one editor')

    await user.click(screen.getByRole('button', { name: /studio workspace/i }))
    expect(screen.getByRole('tab', { name: 'Effects' })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps shared project, save, history and export actions in the persistent top bar', async () => {
    const user = userEvent.setup()
    const onUndo = vi.fn()
    const onExport = vi.fn()
    render(<ShellHarness onUndo={onUndo} onExport={onExport} />)

    expect(screen.getByText('cleaned-interview.mp4')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: /project save status/i })).toHaveTextContent(
      /saved locally/i,
    )
    expect(screen.getByRole('button', { name: /redo edit/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /undo edit/i }))
    await user.click(screen.getByRole('button', { name: /export video/i }))

    expect(onUndo).toHaveBeenCalledOnce()
    expect(onExport).toHaveBeenCalledOnce()
  })

  it('exposes the exact disabled reasons without enabling the real actions', async () => {
    const user = userEvent.setup()
    const onUndo = vi.fn()
    const onExport = vi.fn()
    render(
      <ShellHarness
        onUndo={onUndo}
        onExport={onExport}
        undoDisabledReason="Accept or reject the pending proposal before undoing accepted edits."
        redoDisabledReason="Nothing to redo yet."
        exportDisabledReason="Accept or reject the pending proposal before exporting."
      />,
    )

    const undoGroup = screen.getByRole('group', { name: /undo edit unavailable/i })
    const redoGroup = screen.getByRole('group', { name: /redo edit unavailable/i })
    const exportGroup = screen.getByRole('group', { name: /export unavailable/i })
    expect(undoGroup).toHaveAccessibleDescription(/pending proposal before undoing/i)
    expect(redoGroup).toHaveAccessibleDescription(/nothing to redo yet/i)
    expect(exportGroup).toHaveAccessibleDescription(/pending proposal before exporting/i)
    expect(screen.getByRole('button', { name: /undo edit/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /export unavailable/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /undo edit/i }))
    await user.click(screen.getByRole('button', { name: /export unavailable/i }))
    expect(onUndo).not.toHaveBeenCalled()
    expect(onExport).not.toHaveBeenCalled()
  })

  it('explains when an export is already running', () => {
    render(
      <ShellHarness
        isExporting
        exportDisabledReason="Export is already in progress."
      />,
    )

    expect(screen.getByRole('group', { name: /export unavailable/i }))
      .toHaveAccessibleDescription(/export is already in progress/i)
    expect(screen.getByRole('button', { name: /exporting video/i })).toBeDisabled()
  })
})
