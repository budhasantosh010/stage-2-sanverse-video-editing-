import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { AddNameplateAction } from '@sanverse/edit-domain'
import { NameplateOverlay } from './NameplateOverlay'

const action: AddNameplateAction = {
  schemaVersion: 'sanverse.action/v1',
  actionId: 'action-overlay-1',
  kind: 'add-nameplate',
  target: { x: 0.25, y: 0.75, sourceTimeMs: 12_400 },
  primaryText: 'Santosh',
  secondaryText: 'Founder',
  startMs: 12_400,
  durationMs: 5_000,
}

afterEach(cleanup)

describe('NameplateOverlay', () => {
  it('renders at the start instant using top-left normalized coordinates', () => {
    render(<NameplateOverlay action={action} currentTimeMs={12_400} />)

    const overlay = screen.getByTestId('nameplate-overlay')
    expect(overlay).toHaveTextContent('Santosh')
    expect(overlay).toHaveTextContent('Founder')
    expect(overlay).toHaveStyle({ left: '25%', top: '75%' })
  })

  it('does not render before its start instant', () => {
    render(<NameplateOverlay action={action} currentTimeMs={12_399} />)

    expect(screen.queryByTestId('nameplate-overlay')).not.toBeInTheDocument()
  })

  it('does not render at its end instant', () => {
    render(<NameplateOverlay action={action} currentTimeMs={17_400} />)

    expect(screen.queryByTestId('nameplate-overlay')).not.toBeInTheDocument()
  })

  it('omits the optional line when it is empty', () => {
    render(
      <NameplateOverlay
        action={{ ...action, secondaryText: '' }}
        currentTimeMs={12_400}
      />,
    )

    expect(screen.getByText('Santosh')).toBeInTheDocument()
    expect(screen.queryByText('Founder')).not.toBeInTheDocument()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'fails closed for invalid current time %s',
    (currentTimeMs) => {
      render(<NameplateOverlay action={action} currentTimeMs={currentTimeMs} />)

      expect(screen.queryByTestId('nameplate-overlay')).not.toBeInTheDocument()
    },
  )
})
