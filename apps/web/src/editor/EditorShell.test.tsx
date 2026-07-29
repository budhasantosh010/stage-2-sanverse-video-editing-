import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EditorShell, type EditorWorkspace } from './EditorShell'

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
}: {
  onUndo?: () => void
  onExport?: () => void
}) {
  const [workspace, setWorkspace] = useState<EditorWorkspace>('assist')

  return (
    <EditorShell
      workspace={workspace}
      projectName="cleaned-interview.mp4"
      saveState="saved"
      canUndo
      canRedo={false}
      canExport
      isExporting={false}
      onWorkspaceChange={setWorkspace}
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
})
