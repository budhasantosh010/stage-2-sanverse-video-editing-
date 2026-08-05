import { useRef, useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditOperation, EditProject } from '@sanverse/edit-domain'

import { testProject } from '../../test-fixtures'
import { StudioScreen } from './StudioScreen'

/**
 * DRAGGING A WINDOW SMALLER MUST NOT STRAND THE USER — FAIL-047.
 *
 * The stylesheet hides the Media and Tool docks at 1100px and narrower. The
 * replacement "Show Media" / "Show Tool" buttons were rendered from a copy of
 * the width held in React state, and that copy was allowed to go stale. Resize
 * a 1440px window down to 1024 and the docks were gone, the replacements never
 * appeared, and the only way back was reloading the page.
 *
 * These tests drive the real screen through real width changes and require the
 * replacements to appear and disappear at the moment the stylesheet changes its
 * mind — and require the user's work to survive the whole journey.
 */

const props = (project: EditProject, onTimelineEdit: (operation: EditOperation) => Promise<string | null>) => ({
  embedded: true,
  workspace: 'studio' as const,
  studioWorkspace: 'edit' as const,
  onStudioWorkspaceChange: vi.fn(),
  project: { id: 'project_1234567890abcdef', name: 'owner.mp4', mediaUrl: '/media/owner', draftRequest: '' },
  proposal: null,
  conversation: { status: 'ready' as const, lastMessage: '', question: null, notice: null },
  editProject: project,
  editError: null,
  assetOriginalNames: { asset_aaaaaaaa: 'owner.mp4' },
  onProposal: vi.fn(),
  onDiscardProposal: vi.fn(),
  onAcceptProposal: vi.fn(),
  onRepairProposal: vi.fn(),
  onTimelineEdit,
  onAddCaptions: vi.fn(async () => null),
  onApplyOperations: vi.fn(async () => null),
  onCreateOverlay: vi.fn(async () => null),
  onUploadAsset: vi.fn(async () => 'Not used.'),
  assetUrl: () => '/api/projects/p/assets/asset_aaaaaaaa/media',
  probeAssetSource: vi.fn(async () => 'available' as const),
  onSendMessage: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  exportState: { status: 'idle' as const },
  saveState: { status: 'saved' as const, persistedRevision: 0 },
  onExport: vi.fn(),
  onBack: vi.fn(),
})

function Harness() {
  const [conversationDraft, setConversationDraft] = useState('')
  const projectRef = useRef(testProject())
  return (
    <StudioScreen
      {...props(projectRef.current, vi.fn(async () => null))}
      conversationDraft={conversationDraft}
      onConversationDraftChange={setConversationDraft}
    />
  )
}

const originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')
const originalHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')

/** Change the window width the way a person dragging a window edge does. */
function resizeTo(width: number) {
  act(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
    window.dispatchEvent(new Event('resize'))
  })
}

const compactControlsPresent = () => screen.queryAllByRole('button', { name: /^Show (Media|Tool)$/ }).length > 0

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 900 })
  localStorage.clear()
  vi.stubGlobal('PointerEvent', MouseEvent)
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  if (originalWidth) Object.defineProperty(window, 'innerWidth', originalWidth)
  if (originalHeight) Object.defineProperty(window, 'innerHeight', originalHeight)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('resizing the window never strands the user', () => {
  it('offers the compact panel controls the instant the docks are hidden, with no reload', () => {
    render(<Harness />)
    expect(compactControlsPresent()).toBe(false)

    resizeTo(1024)
    expect(compactControlsPresent()).toBe(true)

    resizeTo(1280)
    expect(compactControlsPresent()).toBe(false)

    resizeTo(1440)
    expect(compactControlsPresent()).toBe(false)
  })

  it('switches at the exact pixel the stylesheet switches at, not one later', () => {
    render(<Harness />)
    resizeTo(1101)
    expect(compactControlsPresent()).toBe(false)
    // `@media (max-width: 1100px)` matches HERE and hides both docks.
    resizeTo(1100)
    expect(compactControlsPresent()).toBe(true)
  })

  it('keeps the Media panel reachable at every width on the way down and back up', () => {
    render(<Harness />)
    for (const width of [1440, 1360, 1200, 1101, 1100, 1024, 900, 700, 620, 500, 700, 1024, 1100, 1101, 1440]) {
      resizeTo(width)
      const reachable = compactControlsPresent() || screen.queryAllByRole('button', { name: /Hide Media dock/ }).length > 0
      expect(reachable, `Media unreachable at ${width}px`).toBe(true)
    }
  })

  it('keeps what the user typed and chose through the whole journey', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const search = screen.getByRole('textbox', { name: /Search media/ })
    await user.clear(search)
    fireEvent.change(search, { target: { value: 'owner' } })
    expect(screen.getByRole('textbox', { name: /Search media/ })).toHaveValue('owner')

    resizeTo(1024)
    resizeTo(620)
    resizeTo(1440)

    // Presentation state is owned by the screen, not by the panel, so a mode
    // change that unmounts and remounts panels cannot silently discard it.
    expect(screen.getByRole('textbox', { name: /Search media/ })).toHaveValue('owner')
  })

  it('creates no edit, no revision, and no history entry from resizing', () => {
    const onTimelineEdit = vi.fn(async () => null)
    const project = testProject()
    render(
      <StudioScreen
        {...props(project, onTimelineEdit)}
        conversationDraft=""
        onConversationDraftChange={vi.fn()}
      />,
    )
    const revisionBefore = project.revision

    for (const width of [1024, 620, 1280, 1440]) resizeTo(width)

    expect(onTimelineEdit).not.toHaveBeenCalled()
    expect(project.revision).toBe(revisionBefore)
  })
})
