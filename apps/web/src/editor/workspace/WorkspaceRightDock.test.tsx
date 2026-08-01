import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { WorkspaceRightDock } from './WorkspaceRightDock'

afterEach(cleanup)

function Harness() {
  const [tab, setTab] = useState<'tool' | 'ai'>('tool')
  return <WorkspaceRightDock workspace="effects" activeTab={tab} onTabChange={setTab} tool={<input aria-label="Tool draft" defaultValue="effect stays" />} ai={<input aria-label="AI draft" defaultValue="chat stays" />} />
}

describe('WorkspaceRightDock', () => {
  it('switches accessible Tool/AI tabs without remounting either draft', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const toolInput = screen.getByLabelText('Tool draft')
    await user.clear(toolInput)
    await user.type(toolInput, 'changed effect')
    await user.click(screen.getByRole('tab', { name: 'AI' }))
    const aiInput = screen.getByLabelText('AI draft')
    await user.clear(aiInput)
    await user.type(aiInput, 'shared chat')
    await user.click(screen.getByRole('tab', { name: 'Tool' }))
    expect(screen.getByLabelText('Tool draft')).toBe(toolInput)
    expect(toolInput).toHaveValue('changed effect')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'AI' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('AI draft')).toBe(aiInput)
    expect(aiInput).toHaveValue('shared chat')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Tool' })).toHaveAttribute('aria-selected', 'true')
  })

  it('exposes the permanently mounted conversation as a region when Studio tabs are hidden in Assist', () => {
    render(<WorkspaceRightDock assist workspace="edit" activeTab="tool" onTabChange={() => undefined} tool={<span>Tool</span>} ai={<span>Conversation content</span>} />)
    expect(screen.queryByRole('tablist', { name: 'Right dock panels' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Conversation' })).toHaveTextContent('Conversation content')
  })
})
