import { useRef } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_VISUAL_PROPERTIES, type EditOperation } from '@sanverse/edit-domain'

import type { CanvasHitTarget, CanvasSelectionResult } from './canvas-contract'
import { CanvasInteractionLayer } from './CanvasInteractionLayer'
import { useSharedVisualDraft } from './shared-visual-draft'

const supported: CanvasSelectionResult = {
  kind: 'supported',
  selection: {
    timelineItemId: 'item_title',
    visualId: 'title_abcd1234',
    nodeId: 'title_abcd1234',
    label: 'Launch title',
    kind: 'title',
    state: 'committed',
    projectRevision: 3,
    startTicks: 0,
    durationTicks: 5_000_000,
    visualProperties: DEFAULT_VISUAL_PROPERTIES,
    supportsCrop: false,
    supportsRotation: true,
    supportsResize: true,
    blockedReason: null,
    proposalPoint: null,
  },
}

const target: CanvasHitTarget = {
  timelineItemId: 'item_title',
  nodeId: 'title_abcd1234',
  label: 'Launch title',
  layer: 0,
  state: 'committed',
}

function Harness({
  selection = supported,
  targets = [target],
  onApply = vi.fn(async () => null),
  onSelect = vi.fn(),
  cropMode = false,
}: Readonly<{
  selection?: CanvasSelectionResult
  targets?: readonly CanvasHitTarget[]
  onApply?: (operation: EditOperation) => Promise<string | null>
  onSelect?: (itemId: string | null) => void
  cropMode?: boolean
}>) {
  const contentRef = useRef<HTMLDivElement>(null)
  const controller = useSharedVisualDraft(selection)
  return (
    <div>
      <div ref={contentRef} data-testid="content-layer">
        <div className="title-overlay" data-node-id="title_abcd1234">
          <div className="title-overlay__headline">Launch</div>
        </div>
      </div>
      <CanvasInteractionLayer
        contentLayerRef={contentRef}
        selectionResult={selection}
        targets={targets}
        draftController={controller}
        busy={false}
        narrow={false}
        cropMode={cropMode}
        onCropModeChange={() => {}}
        onSelectTimelineItem={onSelect}
        onApply={onApply}
        onProposalPreviewPoint={() => {}}
        onProposalPointCommit={() => {}}
        onPausePlayback={() => {}}
        onFocusInspector={() => {}}
      />
    </div>
  )
}

const rect = (x: number, y: number, width: number, height: number): DOMRect => ({
  x, y, left: x, top: y, right: x + width, bottom: y + height, width, height,
  toJSON: () => ({}),
} as DOMRect)

describe('CanvasInteractionLayer', () => {
  beforeEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.stubGlobal('PointerEvent', MouseEvent)
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() { return (this as HTMLElement).dataset.testid === 'content-layer' ? 1000 : 0 },
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() { return (this as HTMLElement).dataset.testid === 'content-layer' ? 500 : 0 },
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const element = this
      if (element.dataset.testid === 'content-layer') return rect(0, 0, 1000, 500)
      if (element.classList.contains('title-overlay__headline')) return rect(100, 100, 200, 100)
      if (element.classList.contains('title-overlay')) return rect(0, 0, 1000, 500)
      return rect(0, 0, 0, 0)
    })
    HTMLElement.prototype.setPointerCapture = vi.fn()
  })

  it('renders truthful move, resize, and rotation controls for the shared Timeline selection', async () => {
    render(<Harness />)
    expect(await screen.findByTestId('canvas-selection-box')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Move Launch title/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resize Launch title from top left/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rotate Launch title/i })).toBeInTheDocument()
  })

  it('keeps pointer movement detached and submits exactly one operation on release', async () => {
    const onApply = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    render(<Harness onApply={onApply} />)
    const move = await screen.findByRole('button', { name: /Move Launch title/i })
    const layer = screen.getByTestId('canvas-interaction-layer')

    fireEvent.pointerDown(move, { pointerId: 7, clientX: 150, clientY: 150 })
    fireEvent.pointerMove(layer, { pointerId: 7, clientX: 200, clientY: 150 })
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.pointerUp(layer, { pointerId: 7, clientX: 200, clientY: 150 })

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(onApply.mock.calls[0][0]).toMatchObject({
      kind: 'set-visual-properties',
      visualId: 'title_abcd1234',
      transform: { translateX: 0.05, translateY: 0 },
    })
  })

  it('cancels a pointer transaction without creating an operation', async () => {
    const onApply = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    render(<Harness onApply={onApply} />)
    const move = await screen.findByRole('button', { name: /Move Launch title/i })
    const layer = screen.getByTestId('canvas-interaction-layer')
    fireEvent.pointerDown(move, { pointerId: 4, clientX: 150, clientY: 150 })
    fireEvent.pointerMove(layer, { pointerId: 4, clientX: 220, clientY: 170 })
    fireEvent.pointerCancel(layer, { pointerId: 4 })
    expect(onApply).not.toHaveBeenCalled()
  })

  it('nudges by one displayed pixel and commits one existing operation', async () => {
    const onApply = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    render(<Harness onApply={onApply} />)
    const move = await screen.findByRole('button', { name: /Move Launch title/i })
    fireEvent.keyDown(move, { key: 'ArrowRight' })
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(onApply.mock.calls[0][0]).toMatchObject({ transform: { translateX: 0.001 } })
  })

  it('uses exact visible hit targets to select the same Timeline item', async () => {
    const onSelect = vi.fn()
    render(<Harness selection={{ kind: 'none' }} onSelect={onSelect} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Select Launch title on canvas' }))
    expect(onSelect).toHaveBeenCalledWith('item_title')
  })

  it('shows no fake handles for unsupported items', () => {
    render(<Harness selection={{ kind: 'unsupported', reason: 'This item does not have canvas controls yet.' }} targets={[]} />)
    expect(screen.queryByTestId('canvas-selection-box')).not.toBeInTheDocument()
    expect(screen.getByText('This item does not have canvas controls yet.')).toBeInTheDocument()
  })
})
