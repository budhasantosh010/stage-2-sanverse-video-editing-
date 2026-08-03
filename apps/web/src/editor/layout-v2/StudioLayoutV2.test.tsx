import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultStudioLayoutV2 } from './studio-layout-defaults'
import { StudioLayoutV2 } from './StudioLayoutV2'
import { adaptStudioLayoutToViewport } from './studio-layout-responsive'

const panes = {
  ai: <textarea aria-label="AI draft" defaultValue="keep me" />,
  media: <div>Media body</div>,
  preview: <video aria-label="Main video" />,
  tool: <div>Tool body</div>,
  timeline: <div>Timeline body</div>,
}

function OverlayHarness() {
  const [open, setOpen] = useState(true)
  return <StudioLayoutV2 layout={defaultStudioLayoutV2()} responsiveMode="tablet" aiOpen={open} onLayoutChange={vi.fn()} onAiOpenChange={setOpen} {...panes} />
}

describe('StudioLayoutV2', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the required nested group topology in pane order', () => {
    const { container } = render(<StudioLayoutV2 layout={defaultStudioLayoutV2()} responsiveMode="desktop" aiOpen={false} onLayoutChange={vi.fn()} {...panes} />)
    expect(screen.getByText('Media body')).toBeInTheDocument()
    expect(screen.getByLabelText('Main video')).toBeInTheDocument()
    expect(screen.getByText('Tool body')).toBeInTheDocument()
    expect(screen.getByText('Timeline body')).toBeInTheDocument()
    const groups = container.querySelectorAll('[data-group]')
    expect(groups).toHaveLength(3)
    groups.forEach((group) => {
      expect([...group.children].every((child) => child.hasAttribute('data-panel') || child.hasAttribute('data-separator'))).toBe(true)
    })
  })

  it('keeps one AI subtree mounted across collapsed, expanded, and overlay modes', () => {
    const { rerender } = render(<StudioLayoutV2 layout={defaultStudioLayoutV2()} responsiveMode="desktop" aiOpen={false} onLayoutChange={vi.fn()} {...panes} />)
    const draft = screen.getByLabelText('AI draft')
    rerender(<StudioLayoutV2 layout={{ ...defaultStudioLayoutV2(), aiMode: 'expanded' }} responsiveMode="desktop" aiOpen onLayoutChange={vi.fn()} {...panes} />)
    expect(screen.getByLabelText('AI draft')).toBe(draft)
    rerender(<StudioLayoutV2 layout={{ ...defaultStudioLayoutV2(), aiMode: 'overlay' }} responsiveMode="tablet" aiOpen onLayoutChange={vi.fn()} {...panes} />)
    expect(screen.getByLabelText('AI draft')).toBe(draft)
    expect(screen.getByRole('region', { name: 'AI editor' }).querySelector('[data-mode="overlay"]')).not.toBeNull()
  })

  it('renders collapsed AI as a full-height status rail with one unambiguous action', () => {
    render(<StudioLayoutV2 layout={defaultStudioLayoutV2()} responsiveMode="desktop" aiOpen={false} pendingProposal onLayoutChange={vi.fn()} {...panes} />)

    const frame = screen.getByRole('region', { name: 'AI editor' })
    const rail = frame.querySelector('[data-mode="collapsed"]')
    expect(rail).toHaveAttribute('data-open', 'false')
    expect(screen.getAllByRole('button', { name: 'Expand AI' })).toHaveLength(1)
    expect(screen.getByRole('status', { name: 'Pending AI proposal' })).toHaveTextContent('1 pending')
    expect(frame.querySelector('.studio-layout-v2__ai-content')).toHaveAttribute('inert')
  })

  it('keeps the AI panel physically collapsed when a preset layout changes at the same time', async () => {
    const { container, rerender } = render(<StudioLayoutV2 layout={{ ...defaultStudioLayoutV2(), aiMode: 'expanded' }} responsiveMode="desktop" aiOpen onLayoutChange={vi.fn()} {...panes} />)

    rerender(<StudioLayoutV2 layout={{ ...defaultStudioLayoutV2(), rootLayout: [30, 70] }} responsiveMode="desktop" aiOpen={false} onLayoutChange={vi.fn()} {...panes} />)

    await waitFor(() => expect(container.querySelector('#studio-ai-pane')).toHaveStyle({ flexGrow: '0' }))
    expect(screen.getByRole('button', { name: 'Expand AI' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('gives horizontal and vertical resize handles a real keyboard hit target', () => {
    render(<StudioLayoutV2 layout={defaultStudioLayoutV2()} responsiveMode="desktop" aiOpen onLayoutChange={vi.fn()} {...panes} />)
    expect(screen.getByRole('separator', { name: 'Resize Media pane' })).toHaveStyle({ width: '8px' })
    expect(screen.getByRole('separator', { name: 'Resize Timeline pane' })).toHaveStyle({ height: '8px' })
  })

  it('closes an open AI overlay with Escape and restores focus to its reachable opener', () => {
    render(<OverlayHarness />)
    fireEvent.keyDown(document, { key: 'Escape' })
    const opener = screen.getByRole('button', { name: 'Open AI overlay' })
    expect(opener).toHaveFocus()
    fireEvent.click(opener)
    expect(screen.getByRole('button', { name: 'Close AI overlay' })).toBeInTheDocument()
  })

  it('uses an AI overlay on laptop widths before panel minimums can conflict', () => {
    render(<StudioLayoutV2 layout={defaultStudioLayoutV2()} responsiveMode="laptop" aiOpen={false} onLayoutChange={vi.fn()} {...panes} />)

    expect(screen.getByRole('button', { name: 'Open AI overlay' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'AI editor' }).querySelector('[data-mode="overlay"]')).not.toBeNull()
  })

  it('keeps compact Media and Tool controls outside the panels they reveal', () => {
    render(<StudioLayoutV2 layout={defaultStudioLayoutV2()} responsiveMode="tablet" aiOpen={false} compactControls={<button type="button">Show Media</button>} onLayoutChange={vi.fn()} {...panes} />)

    expect(screen.getByRole('button', { name: 'Show Media' }).closest('[data-panel]')).toBeNull()
    expect(screen.getByText('Media body')).toBeInTheDocument()
    expect(screen.getByText('Tool body')).toBeInTheDocument()
  })

  it('does not treat programmatic preset geometry as a user-authored layout change', () => {
    const onLayoutChange = vi.fn()
    const { rerender } = render(<StudioLayoutV2 layout={defaultStudioLayoutV2()} responsiveMode="desktop" aiOpen={false} onLayoutChange={onLayoutChange} {...panes} />)
    rerender(<StudioLayoutV2 layout={{ ...defaultStudioLayoutV2(), mainVerticalLayout: [42, 58], upperLayout: [10, 62, 28] }} responsiveMode="desktop" aiOpen={false} onLayoutChange={onLayoutChange} {...panes} />)

    expect(onLayoutChange).not.toHaveBeenCalled()
  })

  it('keeps persisted user intent unchanged across responsive adaptation', () => {
    const layout = { ...defaultStudioLayoutV2(), aiMode: 'expanded' as const }
    expect(adaptStudioLayoutToViewport(layout, { width: 900, height: 700 })).toBe(layout)
    expect(adaptStudioLayoutToViewport(layout, { width: 1440, height: 900 })).toBe(layout)
  })
})
