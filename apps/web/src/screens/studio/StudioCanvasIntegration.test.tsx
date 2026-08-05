import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptChangeSet, type EditOperation, type EditProject } from '@sanverse/edit-domain'

import { StudioScreen } from './StudioScreen'
import { ms, testChangeSet, testProject } from '../../test-fixtures'

const domRect = (x: number, y: number, width: number, height: number): DOMRect => ({
  x, y, left: x, top: y, right: x + width, bottom: y + height, width, height,
  toJSON: () => ({}),
} as DOMRect)

function projectWithVisibleNameplate(): EditProject {
  const base = testProject()
  const accepted = acceptChangeSet(base, testChangeSet(base.revision, 'changeset_canvas01', {
    operationId: 'operation_canvas01',
    sourceInterval: { start: ms(0), duration: ms(5_000) },
  }))
  if (!accepted.ok) throw new Error(JSON.stringify(accepted.error))
  return accepted.value
}

const proposal = {
  operation: {
    ...testChangeSet(0, 'changeset_proposal1', {
      operationId: 'operation_proposal1',
      sourceInterval: { start: ms(0), duration: ms(5_000) },
    }).operations[0],
  },
  origin: { source: 'direct' as const, requestId: null, explanation: null, note: null },
}

function renderCanvasStudio(overrides: Partial<ComponentProps<typeof StudioScreen>> = {}) {
  const props: ComponentProps<typeof StudioScreen> = {
    embedded: true,
    workspace: 'studio',
    project: {
      id: 'project_1234567890abcdef',
      name: 'cleaned-interview.mp4',
      mediaUrl: 'blob:cleaned-interview',
      draftRequest: '',
    },
    proposal: null,
    conversation: { status: 'ready', lastMessage: '', question: null, notice: null },
    editProject: projectWithVisibleNameplate(),
    editError: null,
    onProposal: vi.fn(),
    onDiscardProposal: vi.fn(),
    onAcceptProposal: vi.fn(),
    onRepairProposal: vi.fn(),
    onTimelineEdit: vi.fn(),
    onCreateOverlay: vi.fn(async (_operation: EditOperation): Promise<string | null> => null),
    onApplyOperations: vi.fn(async (): Promise<string | null> => null),
    onUploadAsset: vi.fn(async () => 'not used'),
    assetUrl: (assetId: string) => `/api/projects/p/assets/${assetId}/media`,
    onAddCaptions: vi.fn(async () => null),
    onSendMessage: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    exportState: { status: 'idle' },
    saveState: { status: 'saved' as const, persistedRevision: 0 },
    onExport: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  }
  return { ...render(<StudioScreen {...props} />), props }
}

async function selectNameplateFromTimeline(user: ReturnType<typeof userEvent.setup>) {
  const overlayLane = screen.getByRole('group', { name: /V2 overlay lane/i })
  const item = within(overlayLane).getByRole('button', { name: /^nameplate, Santosh, Founder,/i })
  await user.click(item)
  window.dispatchEvent(new Event('resize'))
  return item
}

function prepareVisibleCanvas(container: HTMLElement, currentTime = 1) {
  const video = container.querySelector('video') as HTMLVideoElement
  Object.defineProperties(video, {
    videoWidth: { configurable: true, value: 1920 },
    videoHeight: { configurable: true, value: 1080 },
    currentTime: { configurable: true, value: currentTime, writable: true },
  })
  vi.spyOn(video, 'getBoundingClientRect').mockReturnValue(domRect(100, 50, 400, 400))
  fireEvent.loadedMetadata(video)
  fireEvent.timeUpdate(video)

  const layer = screen.getByTestId('video-content-layer')
  Object.defineProperties(layer, {
    clientWidth: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 225 },
  })
  vi.spyOn(layer, 'getBoundingClientRect').mockReturnValue(domRect(100, 137.5, 400, 225))
  const root = layer.querySelector<HTMLElement>('[data-node-id]')
  if (!root) throw new Error('Visible overlay missing')
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(domRect(180, 220, 120, 40))
  root.querySelectorAll<HTMLElement>('*').forEach((child) => {
    vi.spyOn(child, 'getBoundingClientRect').mockReturnValue(domRect(180, 220, 120, 40))
  })
  window.dispatchEvent(new Event('resize'))
  return { video, layer }
}

describe('Studio Canvas integration', () => {
  beforeEach(() => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    HTMLElement.prototype.setPointerCapture = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses one selection for Canvas, Timeline and Inspector', async () => {
    const user = userEvent.setup()
    const { container } = renderCanvasStudio()
    prepareVisibleCanvas(container)

    const timelineItem = await selectNameplateFromTimeline(user)
    expect(timelineItem).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByTestId('canvas-selection-box')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Inspector' })).getByRole('heading', { name: 'Santosh' })).toBeInTheDocument()
  })

  it('updates the shared Inspector draft during drag and submits only on release', async () => {
    const user = userEvent.setup()
    const onCreateOverlay = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    const { container } = renderCanvasStudio({ onCreateOverlay })
    prepareVisibleCanvas(container)
    await selectNameplateFromTimeline(user)

    const move = await screen.findByRole('button', { name: /Move Santosh/i })
    const interactionLayer = screen.getByTestId('canvas-interaction-layer')
    fireEvent.pointerDown(move, { clientX: 240, clientY: 240 })
    fireEvent.pointerMove(interactionLayer, { clientX: 280, clientY: 240 })

    expect(onCreateOverlay).not.toHaveBeenCalled()
    expect(within(screen.getByRole('region', { name: 'Inspector' })).getByLabelText('Position X (%)')).toHaveValue(10)

    fireEvent.pointerUp(interactionLayer, { clientX: 280, clientY: 240 })
    await waitFor(() => expect(onCreateOverlay).toHaveBeenCalledOnce())
    expect(onCreateOverlay.mock.calls[0][0]).toMatchObject({
      kind: 'set-visual-properties',
      visualId: 'operation_canvas01',
      transform: { translateX: 0.1 },
    })
  })

  it('gives Point mode precedence over canvas hit targets and handles', async () => {
    const user = userEvent.setup()
    const { container } = renderCanvasStudio()
    prepareVisibleCanvas(container)
    await selectNameplateFromTimeline(user)
    expect(await screen.findByTestId('canvas-selection-box')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enter Point mode' }))

    expect(screen.getByRole('button', { name: 'Choose a point on the visible video' })).toBeInTheDocument()
    expect(screen.queryByTestId('canvas-interaction-layer')).not.toBeInTheDocument()
  })

  it('keeps proposal movement detached and routes it through existing repair state', async () => {
    const user = userEvent.setup()
    const onRepairProposal = vi.fn()
    const onCreateOverlay = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    const { container } = renderCanvasStudio({
      editProject: testProject(),
      proposal,
      onRepairProposal,
      onCreateOverlay,
    })
    prepareVisibleCanvas(container)

    const overlayLane = screen.getByRole('group', { name: /V2 overlay lane/i })
    await user.click(within(overlayLane).getByRole('button', { name: /^nameplate, Santosh, Founder,.*Proposed$/i }))
    const move = await screen.findByRole('button', { name: /Move Santosh/i })
    const interactionLayer = screen.getByTestId('canvas-interaction-layer')
    fireEvent.pointerDown(move, { clientX: 200, clientY: 240 })
    fireEvent.pointerMove(interactionLayer, { clientX: 240, clientY: 240 })
    fireEvent.pointerUp(interactionLayer, { clientX: 240, clientY: 240 })

    expect(onCreateOverlay).not.toHaveBeenCalled()
    expect(onRepairProposal).toHaveBeenCalledWith({ point: { x: 0.35, y: 0.75 } })
  })
})
