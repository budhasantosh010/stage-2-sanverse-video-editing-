import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EMPTY_MEDIA_PRESENTATION,
  type MediaAssetView,
  type MediaBinViewModel,
  type MediaPresentationState,
} from '../../features/media'
import { useMediaOrganization } from '../../features/media/use-media-organization'
import { MediaBin } from './MediaBin'

const asset = (overrides: Partial<MediaAssetView> & Pick<MediaAssetView, 'assetId'>): MediaAssetView => Object.freeze({
  kind: 'video',
  displayName: overrides.assetId,
  originalName: null,
  durationTicks: 1_440_000,
  width: 1920,
  height: 1080,
  status: 'available',
  usageCount: 0,
  usageKinds: Object.freeze(['unused'] as const),
  canAddAsOverlay: true,
  canAddAsMusic: false,
  canRemove: false,
  removeBlockedReason: 'Removing unused media is not available yet. The source file remains safe.',
  previewSource: '/media/x',
  thumbnailSource: null,
  ...overrides,
})

const model: MediaBinViewModel = Object.freeze({
  assets: Object.freeze([
    asset({ assetId: 'asset_00000001', displayName: 'interview.mp4', kind: 'video' }),
    asset({ assetId: 'asset_00000002', displayName: 'logo.png', kind: 'image', durationTicks: null }),
    asset({ assetId: 'asset_00000003', displayName: 'music.wav', kind: 'audio', durationTicks: 9_000_000, canAddAsOverlay: false, canAddAsMusic: true }),
  ]),
  counts: Object.freeze({ all: 3, video: 1, image: 1, audio: 1, missing: 0 }),
})

const PROJECT = 'project_1234567890abcdef'

const emptyOrganization = Object.freeze({
  schemaVersion: 'sanverse.media-organization/v1',
  folders: Object.freeze([]),
  assetFolderAssignments: Object.freeze({}),
})

const withFolder = Object.freeze({
  ...emptyOrganization,
  folders: Object.freeze([Object.freeze({ folderId: 'folder_aaaaaaaa', name: 'B-roll', createdAt: '2026-08-03T10:00:00.000Z' })]),
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/**
 * The panel wired the way the Studio screen wires it: presentation state owned
 * OUTSIDE the panel, folders fetched from the server.
 */
function Harness({
  fetcher,
  onImport = vi.fn(async () => null),
  onSelect = vi.fn(),
  busy = false,
}: Readonly<{
  fetcher: typeof fetch
  onImport?: (files: readonly File[]) => Promise<string | null>
  onSelect?: (assetId: string) => void
  busy?: boolean
}>) {
  const [presentation, setPresentation] = useState<MediaPresentationState>(EMPTY_MEDIA_PRESENTATION)
  const [mounted, setMounted] = useState(true)
  const organization = useMediaOrganization(PROJECT, fetcher)
  return (
    <>
      <button type="button" onClick={() => setMounted((value) => !value)}>Toggle workspace</button>
      <p data-testid="held-state">{`${presentation.query}|${presentation.filter}|${presentation.sortField}|${presentation.sortDirection}|${presentation.folderId ?? 'root'}`}</p>
      {mounted ? (
        <MediaBin
          model={model}
          selectedAssetId={null}
          busy={busy}
          presentation={presentation}
          organization={organization}
          onPresentationChange={setPresentation}
          onSelect={onSelect}
          onImport={onImport}
          onAddAsBroll={vi.fn(async () => null)}
          onAddAsMusic={vi.fn(async () => null)}
        />
      ) : null}
    </>
  )
}

const settled = async () => { await waitFor(() => expect(screen.queryByText('Loading folders…')).not.toBeInTheDocument()) }

afterEach(cleanup)

describe('Media Library V2 — structure and density', () => {
  // The stylesheet is read as TEXT and asserted on, because the rules being
  // checked here — what scrolls, how small a control may get, what happens at
  // each width — are decided by CSS, and jsdom does not evaluate container
  // queries. Asserting on the source is the only honest way to hold them.
  const cssPath = ['src/editor/media/MediaBin.css', 'apps/web/src/editor/media/MediaBin.css']
    .map((candidate) => resolve(process.cwd(), candidate))
    .find(existsSync)
  if (!cssPath) throw new Error('Could not find MediaBin.css')
  const css = readFileSync(cssPath, 'utf8')

  it('scrolls the results and nothing else', () => {
    // If the whole panel scrolled, reaching row thirty would carry Import,
    // Search and Filter off the screen — exactly when they are most needed.
    const scrollers = css.match(/^\.[^{]*\{[^}]*overflow-y:\s*auto[^}]*\}/gms) ?? []
    expect(scrollers).toHaveLength(1)
    expect(scrollers[0]).toContain('.media-bin__results')
    expect(css).toMatch(/\.media-bin\s*\{[^}]*overflow:\s*hidden/)
  })

  it('keeps every control at a size a person can actually hit', () => {
    for (const size of css.match(/min-height:\s*(\d+)px/g) ?? []) {
      expect(Number(size.replace(/\D/g, ''))).toBeGreaterThanOrEqual(26)
    }
    expect(css).toMatch(/min-height:\s*(28|29|30|31|32)px/)
  })

  it('defines all four widths, and never five squeezed filter buttons at the narrow ones', () => {
    expect(css).toContain('@container studio-media (max-width: 380px)')
    expect(css).toContain('@container studio-media (max-width: 300px)')
    expect(css).toContain('@container studio-media (max-width: 220px)')
    expect(css).toContain('@container studio-media (min-width: 381px)')
    // At compact the row of buttons is gone entirely and one menu replaces it.
    expect(css).toMatch(/max-width:\s*300px\)\s*\{[^@]*\.media-bin__filters\s*\{\s*display:\s*none/s)
    expect(css).toMatch(/max-width:\s*300px\)\s*\{[^@]*\.media-bin__filter-compact\s*\{\s*display:\s*block/s)
  })

  it('renders one filter authority behind every one of its shapes', async () => {
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: emptyOrganization })) as unknown as typeof fetch} />)
    await settled()
    // The five buttons, the More menu and the compact menu all exist in the
    // document at once; CSS decides which is visible. All write one value.
    expect(screen.getByRole('button', { name: /^Video/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Filter media, All selected/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Filter media, All selected/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: /Audio/ }))
    expect(screen.getByTestId('held-state')).toHaveTextContent('|audio|')
    expect(screen.getByRole('button', { name: /^Audio/ })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Media Library V2 — importing', () => {
  const supported = new File(['v'], 'clip.mp4', { type: 'video/mp4' })

  it('offers four import choices, each with a truthful file filter', async () => {
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: emptyOrganization })) as unknown as typeof fetch} />)
    await settled()
    const input = screen.getByLabelText('Choose media files to import') as HTMLInputElement
    const clicks: string[] = []
    input.click = () => { clicks.push(input.accept) }

    await userEvent.click(screen.getByRole('button', { name: 'Import media' }))
    for (const choice of ['Video', 'Image', 'Audio', 'All supported media']) {
      await userEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${choice}`) }))
      await userEvent.click(screen.getByRole('button', { name: 'Import media' }))
    }
    expect(clicks).toHaveLength(4)
    expect(clicks[0]).toContain('video/mp4')
    expect(clicks[0]).not.toContain('image/png')
    expect(clicks[1]).toContain('image/png')
    expect(clicks[2]).toContain('audio/mpeg')
    expect(clicks[3]).toContain('video/mp4')
    expect(clicks[3]).toContain('audio/mpeg')
    // One hidden input serves all four. Four inputs would be four places for a
    // duplicate upload handler to hide.
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1)
  })

  it('imports through the one supplied callback and says how many landed', async () => {
    const onImport = vi.fn(async () => null)
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: emptyOrganization })) as unknown as typeof fetch} onImport={onImport} />)
    await settled()
    await userEvent.upload(screen.getByLabelText('Choose media files to import'), [supported])
    await waitFor(() => expect(onImport).toHaveBeenCalledWith([supported]))
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('1 file imported.')).toBeInTheDocument()
  })

  it('refuses an unsupported file by name and never uploads it', async () => {
    const onImport = vi.fn(async () => null)
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: emptyOrganization })) as unknown as typeof fetch} onImport={onImport} />)
    await settled()
    const rejected = new File(['x'], 'budget.pdf', { type: 'application/pdf' })
    fireEvent.drop(screen.getByTestId('media-results'), { dataTransfer: { types: ['Files'], files: [rejected] } })
    expect(await screen.findByText(/budget\.pdf/)).toBeInTheDocument()
    expect(onImport).not.toHaveBeenCalled()
  })

  it('accepts what it can from a mixed OS drop and reports each refusal separately', async () => {
    const onImport = vi.fn(async () => null)
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: emptyOrganization })) as unknown as typeof fetch} onImport={onImport} />)
    await settled()
    const rejected = new File(['x'], 'notes.txt', { type: 'text/plain' })
    fireEvent.drop(screen.getByTestId('media-results'), {
      dataTransfer: { types: ['Files'], files: [supported, rejected] },
    })
    await waitFor(() => expect(onImport).toHaveBeenCalledWith([supported]))
    expect(screen.getByLabelText('Files that were not imported').children).toHaveLength(1)
  })

  it('shows and clears the drop-active state on enter, leave and drop', async () => {
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: emptyOrganization })) as unknown as typeof fetch} />)
    await settled()
    const region = screen.getByTestId('media-results')
    fireEvent.dragEnter(region, { dataTransfer: { types: ['Files'] } })
    expect(await screen.findByText('Drop files to add them to this project')).toBeInTheDocument()
    fireEvent.dragLeave(region, { dataTransfer: { types: ['Files'] } })
    await waitFor(() => expect(screen.queryByText('Drop files to add them to this project')).not.toBeInTheDocument())
  })

  it('ignores a drag that is not files, so a future Timeline drag is never an import', () => {
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: emptyOrganization })) as unknown as typeof fetch} />)
    const region = screen.getByTestId('media-results')
    fireEvent.dragEnter(region, { dataTransfer: { types: ['application/vnd.sanverse.media-drag+json'] } })
    expect(screen.queryByText('Drop files to add them to this project')).not.toBeInTheDocument()
  })

  it('cannot import while the project is busy', async () => {
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: emptyOrganization })) as unknown as typeof fetch} busy />)
    await settled()
    expect(screen.getByRole('button', { name: 'Import media' })).toBeDisabled()
  })
})

describe('Media Library V2 — durable folders', () => {
  it('asks the server once on open and shows what came back', async () => {
    const fetcher = vi.fn(async () => json(200, { organization: withFolder }))
    render(<Harness fetcher={fetcher as unknown as typeof fetch} />)
    await settled()
    expect(fetcher).toHaveBeenCalledWith(`/api/projects/${PROJECT}/media-organization`, { signal: undefined })
    await userEvent.click(screen.getByRole('button', { name: /^Folder, All media selected/ }))
    expect(screen.getByRole('menuitemradio', { name: /B-roll/ })).toBeInTheDocument()
  })

  it('creates a folder only after the SERVER says so', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? json(200, { organization: withFolder }) : json(200, { organization: emptyOrganization }))
    render(<Harness fetcher={fetcher as unknown as typeof fetch} />)
    await settled()
    await userEvent.click(screen.getByRole('button', { name: /^Folder, All media selected/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Create folder…' }))
    await userEvent.type(screen.getByLabelText('New folder name'), 'B-roll')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(screen.queryByLabelText('New folder name')).not.toBeInTheDocument())
    const post = fetcher.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    expect(JSON.parse(String((post?.[1] as RequestInit).body)))
      .toEqual({ command: { kind: 'create-folder', name: 'B-roll' } })
  })

  it('keeps a refused name on screen with the reason instead of pretending it worked', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json(400, { error: 'A folder with that name already exists.', code: 'FOLDER_NAME_DUPLICATE' })
        : json(200, { organization: withFolder }))
    render(<Harness fetcher={fetcher as unknown as typeof fetch} />)
    await settled()
    await userEvent.click(screen.getByRole('button', { name: /^Folder, All media selected/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Create folder…' }))
    await userEvent.type(screen.getByLabelText('New folder name'), ' b-roll ')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('A folder with that name already exists.')).toBeInTheDocument()
    // Form still open, text still there: fix the clash, do not retype it.
    expect(screen.getByLabelText('New folder name')).toHaveValue(' b-roll ')
    // And the folder list on screen is exactly what it was before.
    await userEvent.click(screen.getByRole('button', { name: /^Folder, All media selected/ }))
    expect(screen.getAllByRole('menuitemradio', { name: /B-roll/ })).toHaveLength(1)
  })

  it('renames, moves an asset in, moves it back to the root, and deletes the folder', async () => {
    const posted: unknown[] = []
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return json(200, { organization: withFolder })
      const body = JSON.parse(String(init.body)) as { command: unknown }
      posted.push(body.command)
      return json(200, { organization: withFolder })
    })
    render(<Harness fetcher={fetcher as unknown as typeof fetch} />)
    await settled()

    await userEvent.click(screen.getByRole('button', { name: /^Folder, All media selected/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: /B-roll/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Folder, B-roll selected/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: /^Rename/ }))
    const rename = screen.getByLabelText('New name for this folder')
    await userEvent.clear(rename)
    await userEvent.type(rename, 'Cutaways')
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() => expect(posted).toHaveLength(1))

    // Back to All media so the row's own menu offers "Move to B-roll".
    await userEvent.click(screen.getByRole('button', { name: /^Folder, B-roll selected/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: /All media/ }))
    fireEvent.contextMenu(screen.getByRole('button', { name: /^logo\.png, Image/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Move to “B-roll”/ }))
    await waitFor(() => expect(posted).toHaveLength(2))

    await userEvent.click(screen.getByRole('button', { name: /^Folder, All media selected/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: /B-roll/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Folder, B-roll selected/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: /^Delete/ }))
    await waitFor(() => expect(posted).toHaveLength(3))

    expect(posted).toEqual([
      { kind: 'rename-folder', folderId: 'folder_aaaaaaaa', name: 'Cutaways' },
      { kind: 'move-asset-to-folder', assetId: 'asset_00000002', folderId: 'folder_aaaaaaaa' },
      { kind: 'delete-folder', folderId: 'folder_aaaaaaaa' },
    ])
  })

  it('returns the view to All media when the folder it was showing is gone', async () => {
    let organization = withFolder
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { organization = emptyOrganization; return json(200, { organization }) }
      return json(200, { organization })
    })
    render(<Harness fetcher={fetcher as unknown as typeof fetch} />)
    await settled()
    await userEvent.click(screen.getByRole('button', { name: /^Folder, All media selected/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: /B-roll/ }))
    expect(screen.getByTestId('held-state')).toHaveTextContent('|folder_aaaaaaaa')
    await userEvent.click(screen.getByRole('button', { name: /^Folder, B-roll selected/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: /^Delete/ }))
    // A folder that no longer exists must not leave an empty list on screen.
    await waitFor(() => expect(screen.getByTestId('held-state')).toHaveTextContent('|root'))
  })

  it('reports a folder problem inside the folder control, never as a panel-wide alarm', async () => {
    const fetcher = vi.fn(async () => json(503, { error: 'Folders are unavailable.' }))
    render(<Harness fetcher={fetcher as unknown as typeof fetch} />)
    await settled()
    // The user's media, timeline and export are untouched by this, so nothing
    // shouts. It is reported where folders are.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Folder, All media selected/ }))
    expect(screen.getByText('Folders are unavailable.')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Try again' })).toBeInTheDocument()
  })

  it('never lets two folder commands race', async () => {
    let release: (() => void) | null = null
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return json(200, { organization: withFolder })
      await new Promise<void>((resolve) => { release = resolve })
      return json(200, { organization: withFolder })
    })
    render(<Harness fetcher={fetcher as unknown as typeof fetch} />)
    await settled()
    await userEvent.click(screen.getByRole('button', { name: /^Folder, All media selected/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Create folder…' }))
    await userEvent.type(screen.getByLabelText('New folder name'), 'B-roll')
    const create = screen.getByRole('button', { name: 'Create' })
    fireEvent.click(create)
    fireEvent.click(create)
    fireEvent.click(create)
    await waitFor(() => expect(fetcher.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toHaveLength(1))
    await act(async () => { release?.() })
  })
})

describe('Media Library V2 — continuity', () => {
  it('keeps search, filter, sort and folder through a workspace switch that unmounts the panel', async () => {
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: withFolder })) as unknown as typeof fetch} />)
    await settled()
    await userEvent.type(screen.getByLabelText('Search media'), 'logo')
    await userEvent.click(screen.getByRole('button', { name: /^Image/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Sort media/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Name' }))
    await userEvent.click(screen.getByRole('button', { name: /^Sort media/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Z to A' }))
    await userEvent.click(screen.getByRole('button', { name: /^Folder, All media selected/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: /B-roll/ }))
    expect(screen.getByTestId('held-state')).toHaveTextContent('logo|image|name|descending|folder_aaaaaaaa')

    // The Media panel is genuinely removed and rebuilt — what a workspace
    // switch does. State held by the screen survives; state held inside the
    // panel would silently vanish and the user would never know why.
    await userEvent.click(screen.getByRole('button', { name: 'Toggle workspace' }))
    expect(screen.queryByTestId('media-panel')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Toggle workspace' }))
    expect(screen.getByLabelText('Search media')).toHaveValue('logo')
    expect(screen.getByRole('button', { name: /^Image/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Sort media, Name, Z to A/ })).toBeInTheDocument()
    expect(screen.getByTestId('media-current-folder')).toHaveTextContent('B-roll')
  })

  it('leaves search, filter and sort alone when a folder command runs', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => json(200, { organization: withFolder }))
    render(<Harness fetcher={fetcher as unknown as typeof fetch} />)
    await settled()
    await userEvent.type(screen.getByLabelText('Search media'), 'logo')
    await userEvent.click(screen.getByRole('button', { name: /^Image/ }))
    fireEvent.contextMenu(screen.getByRole('button', { name: /^logo\.png, Image/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Move to “B-roll”/ }))
    await waitFor(() => expect(fetcher.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(true))
    expect(screen.getByTestId('held-state')).toHaveTextContent('logo|image|added|ascending|root')
  })
})

describe('Media Library V2 — asset rows', () => {
  it('gives every row three lines, an ellipsis, and no raw identifier on screen', async () => {
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: emptyOrganization })) as unknown as typeof fetch} />)
    await settled()
    const row = screen.getByRole('button', { name: /^interview\.mp4, Video/ })
    expect(row).toHaveTextContent('interview.mp4')
    expect(row).toHaveTextContent('Video · 1.0 sec')
    expect(row).toHaveTextContent('1920×1080 · Unused')
    // An internal id is not something to show a person.
    expect(screen.getByTestId('media-panel').textContent).not.toContain('asset_00000001')
  })

  it('offers no visible drag affordance while the Timeline cannot accept one', async () => {
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: emptyOrganization })) as unknown as typeof fetch} />)
    await settled()
    for (const row of screen.getAllByRole('option')) {
      expect(row).not.toHaveAttribute('draggable')
      expect(row).not.toHaveAttribute('aria-grabbed')
    }
  })

  it('offers only actions that do something, and explains the one that cannot', async () => {
    render(<Harness fetcher={vi.fn(async () => json(200, { organization: emptyOrganization })) as unknown as typeof fetch} />)
    await settled()
    fireEvent.contextMenu(screen.getByRole('button', { name: /^music\.wav, Audio/ }))
    const menu = screen.getByRole('menu', { name: 'music.wav actions' })
    expect(menu).toHaveTextContent('Add as music')
    expect(menu).not.toHaveTextContent('Add as B-roll')
    expect(menu).toHaveTextContent('Source information')
    // Deletion does not exist in this gate, so it is not offered as if it did.
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toBeDisabled()
  })
})
