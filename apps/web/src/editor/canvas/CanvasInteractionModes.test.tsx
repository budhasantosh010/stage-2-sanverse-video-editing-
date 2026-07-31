import { useEffect, useRef } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_VISUAL_PROPERTIES, type EditOperation } from '@sanverse/edit-domain'

import { CanvasInteractionLayer } from './CanvasInteractionLayer'
import type { CanvasHitTarget, CanvasRect, CanvasSelectionResult } from './canvas-contract'
import { useSharedVisualDraft } from './shared-visual-draft'

const committed = (
  kind: 'title' | 'media-overlay' = 'title',
): CanvasSelectionResult => ({
  kind: 'supported',
  selection: {
    timelineItemId: `item_${kind}`,
    visualId: kind === 'title' ? 'title_abcd1234' : 'broll_abcd1234',
    nodeId: kind === 'title' ? 'title_abcd1234' : 'broll_abcd1234',
    label: kind === 'title' ? 'Launch title' : 'Product B-roll',
    kind,
    state: 'committed',
    projectRevision: 3,
    startTicks: 0,
    durationTicks: 5_000_000,
    visualProperties: DEFAULT_VISUAL_PROPERTIES,
    supportsCrop: kind === 'media-overlay',
    supportsRotation: true,
    supportsResize: true,
    blockedReason: null,
    proposalPoint: null,
  },
})

const proposal: CanvasSelectionResult = {
  kind: 'supported',
  selection: {
    timelineItemId: 'proposal:operation_abcd1234',
    visualId: 'operation_abcd1234',
    nodeId: 'operation_abcd1234',
    label: 'Pending nameplate',
    kind: 'proposal',
    state: 'proposed',
    projectRevision: 3,
    startTicks: 0,
    durationTicks: 5_000_000,
    visualProperties: DEFAULT_VISUAL_PROPERTIES,
    supportsCrop: false,
    supportsRotation: false,
    supportsResize: false,
    blockedReason: null,
    proposalPoint: { x: 0.25, y: 0.75 },
  },
}

const domRect = (value: CanvasRect): DOMRect => ({
  x: value.x,
  y: value.y,
  left: value.x,
  top: value.y,
  right: value.x + value.width,
  bottom: value.y + value.height,
  width: value.width,
  height: value.height,
  toJSON: () => ({}),
} as DOMRect)

function Harness({
  selection,
  cropMode = false,
  dirty = false,
  nodeRect = { x: 100, y: 100, width: 200, height: 100 },
  onApply,
  onProposalCommit = vi.fn(),
}: Readonly<{
  selection: CanvasSelectionResult
  cropMode?: boolean
  dirty?: boolean
  nodeRect?: CanvasRect
  onApply: (operation: EditOperation) => Promise<string | null>
  onProposalCommit?: (point: Readonly<{ x: number; y: number }>) => void
}>) {
  const contentRef = useRef<HTMLDivElement>(null)
  const controller = useSharedVisualDraft(selection)
  useEffect(() => {
    if (!dirty || !controller.draft) return
    controller.update({
      ...controller.draft.value,
      transform: { ...controller.draft.value.transform, opacity: 0.5 },
    })
  }, [dirty])

  const selected = selection.kind === 'supported' ? selection.selection : null
  const rootClass = selected?.kind === 'media-overlay'
    ? 'media-overlay'
    : selected?.kind === 'proposal'
      ? 'nameplate-overlay'
      : 'title-overlay'
  const targets: readonly CanvasHitTarget[] = selected ? [{
    timelineItemId: selected.timelineItemId,
    nodeId: selected.nodeId,
    label: selected.label,
    layer: 0,
    state: selected.state,
  }] : []

  useEffect(() => {
    const layer = contentRef.current
    const root = layer?.querySelector<HTMLElement>('[data-node-id]')
    if (!layer || !root) return
    Object.defineProperties(layer, {
      clientWidth: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
    })
    vi.spyOn(layer, 'getBoundingClientRect').mockReturnValue(domRect({ x: 0, y: 0, width: 1000, height: 500 }))
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(domRect(nodeRect))
    root.querySelectorAll<HTMLElement>('*').forEach((child) => {
      vi.spyOn(child, 'getBoundingClientRect').mockReturnValue(domRect(nodeRect))
    })
    window.dispatchEvent(new Event('resize'))
  }, [nodeRect, selected?.nodeId])

  return (
    <div>
      <div ref={contentRef} data-testid="mode-content-layer">
        <div className={rootClass} data-node-id={selected?.nodeId}>
          <span className={rootClass === 'title-overlay' ? 'title-overlay__headline' : 'nameplate-overlay__primary'}>Object</span>
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
        onSelectTimelineItem={() => {}}
        onApply={onApply}
        onProposalPreviewPoint={() => {}}
        onProposalPointCommit={onProposalCommit}
        onPausePlayback={() => {}}
        onFocusInspector={() => {}}
      />
    </div>
  )
}

describe('Canvas interaction modes', () => {
  beforeEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.stubGlobal('PointerEvent', MouseEvent)
    vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    HTMLElement.prototype.setPointerCapture = vi.fn()
  })

  it('uniformly resizes from a corner and commits one full-state operation', async () => {
    const onApply = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    render(<Harness selection={committed()} onApply={onApply} />)
    const handle = await screen.findByRole('button', { name: /Resize Launch title from bottom right/i })
    const layer = screen.getByTestId('canvas-interaction-layer')
    fireEvent.pointerDown(handle, { clientX: 300, clientY: 200 })
    fireEvent.pointerMove(layer, { clientX: 400, clientY: 250 })
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.pointerUp(layer, { clientX: 400, clientY: 250 })
    await waitFor(() => expect(onApply).toHaveBeenCalledOnce())
    expect(onApply.mock.calls[0][0]).toMatchObject({
      kind: 'set-visual-properties',
      transform: { scale: expect.any(Number) },
    })
    expect((onApply.mock.calls[0][0] as Extract<EditOperation, { kind: 'set-visual-properties' }>).transform.scale).toBeGreaterThan(1)
  })

  it('rotates around the object centre and Shift snaps to fifteen-degree increments', async () => {
    const onApply = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    render(<Harness selection={committed()} onApply={onApply} />)
    const handle = await screen.findByRole('button', { name: 'Rotate Launch title' })
    const layer = screen.getByTestId('canvas-interaction-layer')
    fireEvent.pointerDown(handle, { clientX: 200, clientY: 50 })
    fireEvent.pointerMove(layer, { clientX: 300, clientY: 150, shiftKey: true })
    fireEvent.pointerUp(layer, { clientX: 300, clientY: 150, shiftKey: true })
    await waitFor(() => expect(onApply).toHaveBeenCalledOnce())
    expect(onApply.mock.calls[0][0]).toMatchObject({ transform: { rotationDegrees: 90 } })
  })

  it('keeps crop edge movement detached until Done and then creates one operation', async () => {
    const onApply = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    render(<Harness selection={committed('media-overlay')} cropMode onApply={onApply} />)
    const handle = await screen.findByRole('button', { name: /Crop Product B-roll from left edge/i })
    const layer = screen.getByTestId('canvas-interaction-layer')
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 150 })
    fireEvent.pointerMove(layer, { clientX: 120, clientY: 150 })
    fireEvent.pointerUp(layer, { clientX: 120, clientY: 150 })
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledOnce())
    expect(onApply.mock.calls[0][0]).toMatchObject({ crop: { left: 0.1 } })
  })

  it('refuses a canvas gesture while the shared Inspector visual draft is dirty', async () => {
    const onApply = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    render(<Harness selection={committed()} dirty onApply={onApply} />)
    const move = await screen.findByRole('button', { name: /Move Launch title/i })
    fireEvent.pointerDown(move, { clientX: 150, clientY: 150 })
    expect(await screen.findByRole('alert')).toHaveTextContent('Apply or reset the current Inspector changes before dragging this item.')
    expect(onApply).not.toHaveBeenCalled()
  })

  it('repairs a pending proposal point without creating an accepted visual operation', async () => {
    const onApply = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    const onProposalCommit = vi.fn()
    render(<Harness selection={proposal} onApply={onApply} onProposalCommit={onProposalCommit} />)
    const move = await screen.findByRole('button', { name: /Move Pending nameplate/i })
    const layer = screen.getByTestId('canvas-interaction-layer')
    fireEvent.pointerDown(move, { clientX: 250, clientY: 375 })
    fireEvent.pointerMove(layer, { clientX: 350, clientY: 375 })
    fireEvent.pointerUp(layer, { clientX: 350, clientY: 375 })
    expect(onApply).not.toHaveBeenCalled()
    expect(onProposalCommit).toHaveBeenCalledWith({ x: 0.35, y: 0.75 })
  })

  it('shows a deterministic centre guide and commits the snapped value exactly', async () => {
    const onApply = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    render(<Harness selection={committed()} nodeRect={{ x: 394, y: 200, width: 200, height: 100 }} onApply={onApply} />)
    const move = await screen.findByRole('button', { name: /Move Launch title/i })
    const layer = screen.getByTestId('canvas-interaction-layer')
    fireEvent.pointerDown(move, { clientX: 494, clientY: 250 })
    fireEvent.pointerMove(layer, { clientX: 495, clientY: 250 })
    expect(screen.getAllByText('Frame center').length).toBeGreaterThan(0)
    fireEvent.pointerUp(layer, { clientX: 495, clientY: 250 })
    await waitFor(() => expect(onApply).toHaveBeenCalledOnce())
    expect(onApply.mock.calls[0][0]).toMatchObject({ transform: { translateX: 0.006 } })
  })
})
