import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InspectorNumberField } from './InspectorNumberField'
import { InspectorSectionActions } from './InspectorSectionActions'

afterEach(cleanup)

describe('T5.5 Inspector confidence', () => {
  it('uses one predictable numeric field with Shift+Arrow for a larger step', () => {
    const onChange = vi.fn()
    render(
      <InspectorNumberField
        label="Opacity"
        value={50}
        min={0}
        max={100}
        step={1}
        onChange={onChange}
      />,
    )

    const field = screen.getByRole('spinbutton', { name: 'Opacity' })
    fireEvent.keyDown(field, { key: 'ArrowUp', shiftKey: true })
    expect(onChange).toHaveBeenCalledWith(60)
  })

  it('clamps a larger numeric step instead of creating an invalid draft', () => {
    const onChange = vi.fn()
    render(
      <InspectorNumberField
        label="Opacity"
        value={95}
        min={0}
        max={100}
        step={1}
        onChange={onChange}
      />,
    )

    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Opacity' }), { key: 'ArrowUp', shiftKey: true })
    expect(onChange).toHaveBeenCalledWith(100)
  })

  it('makes draft state visibly different from accepted state', () => {
    render(
      <InspectorSectionActions
        dirty
        busy={false}
        working={false}
        notice={null}
        onApply={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    expect(screen.getByText('Changes not applied yet.')).toHaveAttribute('role', 'status')
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled()
  })

  it('does not claim there are pending changes when the draft matches the project', () => {
    render(
      <InspectorSectionActions
        dirty={false}
        busy={false}
        working={false}
        notice={null}
        onApply={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    expect(screen.queryByText('Changes not applied yet.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  })
})
