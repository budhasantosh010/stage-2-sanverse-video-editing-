import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  acceptChangeSet as applyChangeSet,
  activeOverlayOperations,
  activeVisualProperties,
  addAsset,
  redoChangeSet,
  undoChangeSet,
  type EditProject,
} from '@sanverse/edit-domain'

import { App } from './App'
import { testAsset, testProject } from '../test-fixtures'

/**
 * A stand-in for the local API that keeps real project state.
 *
 * The server is authoritative in v2: the browser asks for a change and adopts
 * whatever comes back. A fake that just echoed requests would not exercise
 * that at all, so this one applies edits with the real domain functions.
 */
function fakeApi(projectId = 'project_1234567890abcdef') {
  const asset = { ...testAsset(), assetId: 'asset_aaaaaaaa' }
  let project: EditProject = testProject(asset, projectId)
  const manifest = {
    id: projectId,
    originalFilename: 'cleaned.mp4',
    createdAt: '2026-07-13T00:00:00.000Z',
    sizeBytes: 24,
    sha256: 'a'.repeat(64),
    mediaUrl: `/api/projects/${projectId}/media`,
  }

  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })

  return {
    manifest,
    current: () => project,
    setProject(next: EditProject) { project = next },
    handle(url: string, options?: RequestInit): Response | undefined {
      if (url === '/api/projects' && !options?.method) return json({ projects: [manifest] })
      if (url === '/api/projects' && options?.method === 'POST') return json(manifest, 201)
      if (url === `/api/projects/${projectId}`) return json({ ...manifest, project })
      if (url === `/api/projects/${projectId}/change-sets` && options?.method === 'POST') {
        const body = JSON.parse(String(options.body)) as { changeSet: unknown }
        const next = applyChangeSet(project, body.changeSet)
        if (!next.ok) return json({ code: 'CHANGE_SET_REJECTED' }, 400)
        project = next.value
        return json({ project }, 201)
      }
      if (url === `/api/projects/${projectId}/undo` && options?.method === 'POST') {
        const next = undoChangeSet(project)
        if (!next.ok) return json({ code: 'NOTHING_TO_UNDO' }, 409)
        project = next.value
        return json({ project })
      }
      if (url === `/api/projects/${projectId}/redo` && options?.method === 'POST') {
        const next = redoChangeSet(project)
        if (!next.ok) return json({ code: 'NOTHING_TO_REDO' }, 409)
        project = next.value
        return json({ project })
      }
      return undefined
    },
  }
}

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
const originalStartViewTransition = Object.getOwnPropertyDescriptor(
  document,
  'startViewTransition',
)

let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>

function projectResponse(name = 'cleaned.mp4', mediaUrl = '/api/projects/project_1234567890abcdef/media') {
  const id = mediaUrl.split('/')[3]
  return new Response(JSON.stringify({ id, originalFilename: name, mediaUrl, createdAt: '2026-07-13T00:00:00.000Z', sizeBytes: 24, sha256: 'a'.repeat(64) }), { status: 201, headers: { 'content-type': 'application/json' } })
}

function exportResponse() {
  return new Response(JSON.stringify({
    jobId: 'job_1234567890abcdef',
    projectId: 'project_1234567890abcdef',
    status: 'succeeded',
    // The server states which half of the export it is in; the browser never
    // guesses. A job response without a phase is refused.
    phase: 'done',
    progress: 1,
    result: {
      id: 'export_1234567890abcdef',
      mediaUrl: '/api/projects/project_1234567890abcdef/exports/export_1234567890abcdef/media',
      sha256: 'b'.repeat(64), width: 1920, height: 1080, durationMs: 60_000, hasAudio: true,
    },
  }), { status: 202, headers: { 'content-type': 'application/json' } })
}

const PROJECTS_URL = '/api/projects'

function isRecentProjectsRequest(url: string, options?: RequestInit): boolean {
  return url === PROJECTS_URL && options?.method === undefined
}

function recentProjectsResponse(projects: readonly unknown[] = []) {
  return new Response(JSON.stringify({ projects }), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Home lists recent projects whenever it renders, so each test only describes the request it asserts on.
function exceptRecentProjects(
  respond: (url: string, options?: RequestInit) => Response | Promise<Response>,
): (url: string, options?: RequestInit) => Response | Promise<Response> {
  return (url, options) => (isRecentProjectsRequest(url, options) ? recentProjectsResponse() : respond(url, options))
}

function intakeRequestCount(): number {
  return fetchMock.mock.calls.filter(
    ([url, options]) => url === PROJECTS_URL && (options as RequestInit | undefined)?.method === 'POST',
  ).length
}

function restoreUrlMethod(
  name: 'createObjectURL' | 'revokeObjectURL',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(URL, name, descriptor)
    return
  }

  Reflect.deleteProperty(URL, name)
}

beforeEach(() => {
  window.localStorage.removeItem('sanverse.studio-layout/v2')
  createObjectURL = vi.fn(() => 'blob:cleaned-video')
  revokeObjectURL = vi.fn()
  const api = fakeApi()
  fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    if (url === PROJECTS_URL && options?.method === 'POST') return projectResponse()
    return api.handle(url, options) ?? new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURL,
  })
})

afterEach(() => {
  cleanup()
  restoreUrlMethod('createObjectURL', originalCreateObjectURL)
  restoreUrlMethod('revokeObjectURL', originalRevokeObjectURL)
  if (originalStartViewTransition) {
    Object.defineProperty(document, 'startViewTransition', originalStartViewTransition)
  } else {
    Reflect.deleteProperty(document, 'startViewTransition')
  }
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('opens a recent project with saved edits and undoes through the server', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    const base = api.current()
    const accepted = applyChangeSet(base, {
      schemaVersion: 'sanverse.change-set/v1',
      changeSetId: 'changeset_saved001',
      baseRevision: base.revision,
      operations: [{
        schemaVersion: 'sanverse.operation/v3',
        operationId: 'operation_saved001',
        kind: 'add-nameplate',
        capabilityId: 'sanverse.nameplate.component/v1',
        assetId: base.composition.tracks[0].clips[0].assetId,
        sourceInterval: {
          start: { ticks: 1_000 * 1_440, timescale: 1_440_000 },
          duration: { ticks: 5_000 * 1_440, timescale: 1_440_000 },
        },
        target: { coordinateSpace: 'composition-normalized', point: { x: 0.2, y: 0.3 }, anchor: 'center' },
        primaryText: 'Saved nameplate',
        secondaryText: '',
        extensions: {},
      }],
      provenance: { source: 'direct', requestId: null },
      extensions: {},
    })
    if (!accepted.ok) throw new Error('fixture failed')
    api.setProject(accepted.value)
    fetchMock.mockImplementation((url: string, options?: RequestInit) =>
      api.handle(url, options) ?? new Response('{}', { status: 404 }))
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /open cleaned\.mp4/i }))
    expect(await screen.findByText('Saved nameplate')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^undo edit$/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${api.manifest.id}/undo`,
      expect.objectContaining({ method: 'POST' }),
    ))
    // The browser adopts the server's answer rather than deciding for itself.
    await waitFor(() => expect(screen.queryByText('Saved nameplate')).not.toBeInTheDocument())
  })

  it('reopens an accepted project and reaches Export ready through the real queued-to-succeeded polling path', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    const base = api.current()
    const accepted = applyChangeSet(base, {
      schemaVersion: 'sanverse.change-set/v1',
      changeSetId: 'changeset_savedexport001',
      baseRevision: base.revision,
      operations: [{
        schemaVersion: 'sanverse.operation/v3',
        operationId: 'operation_savedexport001',
        kind: 'add-nameplate',
        capabilityId: 'sanverse.nameplate.component/v1',
        assetId: base.composition.tracks[0].clips[0].assetId,
        sourceInterval: { start: { ticks: 0, timescale: 1_440_000 }, duration: { ticks: 1_440_000, timescale: 1_440_000 } },
        target: { coordinateSpace: 'composition-normalized', point: { x: 0.5, y: 0.5 }, anchor: 'center' },
        primaryText: 'Saved export',
        secondaryText: '',
        extensions: {},
      }],
      provenance: { source: 'direct', requestId: null },
      extensions: {},
    })
    if (!accepted.ok) throw new Error('fixture failed')
    api.setProject(accepted.value)
    const jobId = 'job_1234567890abcdef'
    const exportId = 'export_1234567890abcdef'
    let polls = 0
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url === `/api/projects/${api.manifest.id}/exports` && options?.method === 'POST') {
        return new Response(JSON.stringify({ jobId, projectId: api.manifest.id, status: 'queued', phase: 'queued', progress: 0 }), { status: 202, headers: { 'content-type': 'application/json' } })
      }
      if (url === `/api/projects/${api.manifest.id}/export-jobs/${jobId}`) {
        polls += 1
        return new Response(JSON.stringify({
          jobId,
          projectId: api.manifest.id,
          status: 'succeeded',
          phase: 'done',
          progress: 1,
          result: { id: exportId, mediaUrl: `/api/projects/${api.manifest.id}/exports/${exportId}/media`, sha256: 'b'.repeat(64), width: 1920, height: 1080, durationMs: 30_000, hasAudio: true },
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return api.handle(url, options) ?? new Response('{}', { status: 404 })
    })
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /open cleaned\.mp4/i }))
    const exportButton = await screen.findByRole('button', { name: /export video/i })
    expect(exportButton).toBeEnabled()
    await user.click(exportButton)
    expect(await screen.findByRole('link', { name: /download mp4/i }, { timeout: 5_000 })).toHaveAttribute('href', `/api/projects/${api.manifest.id}/exports/${exportId}/media`)
    expect(polls).toBeGreaterThanOrEqual(1)
  }, 10_000)

  it('applies one approved Creative result through the server as one change set with one Undo and Redo', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    fetchMock.mockImplementation((url: string, options?: RequestInit) =>
      api.handle(url, options) ?? new Response('{}', { status: 404 }))
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /open cleaned\.mp4/i }))
    await user.click(screen.getByRole('button', { name: /studio workspace/i }))
    await user.click(screen.getByRole('tab', { name: 'Creative' }))
    await user.click(screen.getByRole('button', { name: 'Create Creative draft' }))
    await user.click(screen.getByRole('button', { name: 'Approve Storyboard' }))
    await user.click(screen.getByRole('button', { name: 'Build Animatic' }))
    await user.click(screen.getByRole('button', { name: 'Approve Animatic' }))
    await user.click(screen.getByRole('button', { name: 'Build Motion' }))
    await user.click(screen.getByRole('button', { name: 'Prepare Review' }))
    await waitFor(() => expect(screen.getByText('review ready')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Approve Motion' }))
    await user.click(screen.getByRole('button', { name: 'Apply to production' }))

    await waitFor(() => expect(api.current().revision).toBe(1))
    expect(api.current().changeSets).toHaveLength(1)
    expect(api.current().changeSets[0]?.changeSet.operations.map((operation) => operation.kind)).toEqual(['add-title', 'set-visual-properties'])
    expect(api.current().changeSets[0]?.changeSet.provenance).toMatchObject({ source: 'ai' })
    expect(api.current().changeSets[0]?.changeSet.provenance.requestId).toMatch(/^creative:/)
    expect(api.current().changeSets[0]?.changeSet.extensions).toHaveProperty('sanverse.creative/lineage')
    expect(activeOverlayOperations(api.current())).toHaveLength(1)
    expect(activeVisualProperties(api.current())).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /^undo edit$/i }))
    await waitFor(() => expect(api.current().revision).toBe(2))
    expect(activeOverlayOperations(api.current())).toHaveLength(0)
    expect(activeVisualProperties(api.current())).toHaveLength(0)
    expect(api.current().redoStack).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /^redo edit$/i }))
    await waitFor(() => expect(api.current().revision).toBe(3))
    expect(activeOverlayOperations(api.current())).toHaveLength(1)
    expect(activeVisualProperties(api.current())).toHaveLength(1)
  }, 20_000)

  it('sends one Inspector edit through the server-authoritative change-set path and undoes it', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    fetchMock.mockImplementation((url: string, options?: RequestInit) =>
      api.handle(url, options) ?? new Response('{}', { status: 404 }))
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /open cleaned\.mp4/i }))
    await user.click(screen.getByRole('button', { name: /studio workspace/i }))
    const timelineItem = await screen.findByRole('button', { name: /^clip, cleaned\.mp4,/i })
    await user.click(timelineItem)

    const soundToggle = screen.getByRole('button', { name: 'Sound' })
    const soundSection = soundToggle.closest('section')
    if (!soundSection) throw new Error('Sound section missing')
    fireEvent.change(within(soundSection).getByLabelText('Gain (dB)'), { target: { value: '-5' } })
    await user.click(within(soundSection).getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(api.current().revision).toBe(1))
    expect(api.current().changeSets).toHaveLength(1)
    expect(api.current().changeSets[0].changeSet.operations).toEqual([
      expect.objectContaining({
        kind: 'set-clip-audio',
        clipId: 'clip_aaaaaaaa',
        gainDb: -5,
      }),
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${api.manifest.id}/change-sets`,
      expect.objectContaining({ method: 'POST' }),
    )

    await user.click(screen.getByRole('button', { name: /^undo edit$/i }))
    await waitFor(() => expect(api.current().revision).toBe(2))
    expect(api.current().changeSets).toHaveLength(0)
    expect(api.current().redoStack).toHaveLength(1)
  })

  it('uses the authoritative post-upload revision when immediately placing B-roll', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    const overlayAsset = { ...testAsset(), assetId: 'asset_bbbbbbbb' }
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url === `/api/projects/${api.manifest.id}/assets` && options?.method === 'POST') {
        const added = addAsset(api.current(), overlayAsset)
        if (!added.ok) return new Response(JSON.stringify({ error: added.error }), { status: 400 })
        api.setProject(added.value)
        return new Response(JSON.stringify({ project: added.value, asset: { assetId: overlayAsset.assetId } }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        })
      }
      return api.handle(url, options) ?? new Response('{}', { status: 404 })
    })
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /open cleaned\.mp4/i }))
    await user.click(screen.getByRole('button', { name: /studio workspace/i }))
    await user.click(screen.getByText('Advanced direct controls'))
    await user.click(screen.getByTestId('add-overlay-open'))
    await user.click(screen.getByTestId('add-overlay-choose-broll'))
    await user.upload(
      screen.getByTestId('broll-file'),
      new File(['video'], 'broll.mp4', { type: 'video/mp4' }),
    )

    await waitFor(() => expect(
      api.current().changeSets.flatMap((record) => record.changeSet.operations).some((operation) => operation.kind === 'add-media-overlay'),
    ).toBe(true))
    const changeSetCall = fetchMock.mock.calls.find(
      ([url, options]) => url === `/api/projects/${api.manifest.id}/change-sets` && (options as RequestInit | undefined)?.method === 'POST',
    )
    const body = JSON.parse(String((changeSetCall?.[1] as RequestInit | undefined)?.body)) as { changeSet: { baseRevision: number } }
    expect(body.changeSet.baseRevision).toBe(1)
    expect(api.current().revision).toBe(2)
  })

  it('runs one Home-to-Studio-to-Home loop and releases its local video', async () => {
    const user = userEvent.setup()
    const file = new File(['video'], 'cleaned.mp4', { type: 'video/mp4' })
    const { container } = render(<App />)

    const draft = screen.getByRole('textbox', {
      name: /describe what you want to change/i,
    })
    await user.type(draft, 'Tighten the opening pause.')
    await user.upload(screen.getByLabelText(/choose video/i), file)

    expect(intakeRequestCount()).toBe(1)
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(await screen.findAllByText('cleaned.mp4')).toHaveLength(2)
    expect(container.querySelector('video')).toHaveAttribute('src', '/api/projects/project_1234567890abcdef/media')
    expect(screen.getByText(/draft — not executed/i)).toBeInTheDocument()
    expect(screen.getByText('Tighten the opening pause.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /back to home/i }))

    expect(
      screen.getByRole('heading', { name: /what do you want to edit today/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /describe what you want to change/i }),
    ).toHaveValue('')
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('releases the current local video exactly once when unmounted', async () => {
    const user = userEvent.setup()
    const file = new File(['video'], 'cleaned.mp4', { type: 'video/mp4' })
    const { unmount } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    await user.upload(screen.getByLabelText(/choose video/i), file)
    unmount()

    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('keeps an invalid file on Home without allocating a local URL', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<App />)

    await user.upload(
      screen.getByLabelText(/choose video/i),
      new File(['notes'], 'notes.txt', { type: 'text/plain' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/choose an mp4 video/i)
    expect(
      screen.getByRole('heading', { name: /what do you want to edit today/i }),
    ).toBeInTheDocument()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(intakeRequestCount()).toBe(0)
  })

  it('allows only one project intake request at a time', async () => {
    const pendingUpdates: Array<() => void> = []
    let resolveFirst!: (value: Response) => void
    const pendingIntake = new Promise<Response>((resolve) => { resolveFirst = resolve })
    const api = fakeApi('project_aaaaaaaaaaaaaaaa')
    fetchMock.mockReset().mockImplementation((url: string, options?: RequestInit) => {
      if (url === PROJECTS_URL && options?.method === 'POST') return pendingIntake
      return api.handle(url, options) ?? recentProjectsResponse()
    })
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn((update: () => void) => {
        pendingUpdates.push(update)
      }),
    })
    const { container } = render(<App />)
    const input = screen.getByLabelText(/choose video/i)

    act(() => {
      fireEvent.change(input, { target: { files: [new File(['first'], 'first.mp4', { type: 'video/mp4' })] } })
      fireEvent.change(input, { target: { files: [new File(['second'], 'second.mp4', { type: 'video/mp4' })] } })
    })
    expect(intakeRequestCount()).toBe(1)
    resolveFirst(projectResponse('first.mp4', '/api/projects/project_aaaaaaaaaaaaaaaa/media'))
    // The upload resolves, then the project state is read, then the view
    // transition is queued.
    await waitFor(() => expect(pendingUpdates).toHaveLength(1))

    act(() => pendingUpdates[0]())
    expect(screen.getAllByText('first.mp4')).toHaveLength(2)
    expect(container.querySelector('video')).toHaveAttribute('src', '/api/projects/project_aaaaaaaaaaaaaaaa/media')
  })

  it('accepts, undoes, redoes, and resets one nameplate with the server owning the project', async () => {
    const user = userEvent.setup()
    const first = fakeApi('project_1234567890abcdef')
    const second = fakeApi('project_bbbbbbbbbbbbbbbb')
    let uploads = 0
    fetchMock.mockReset().mockImplementation((url: string, options?: RequestInit) => {
      if (url === PROJECTS_URL && options?.method === 'POST') {
        uploads += 1
        return uploads === 1
          ? projectResponse('first.mp4', '/api/projects/project_1234567890abcdef/media')
          : projectResponse('second.mp4', '/api/projects/project_bbbbbbbbbbbbbbbb/media')
      }
      return first.handle(url, options) ?? second.handle(url, options) ?? recentProjectsResponse()
    })
    const { container } = render(<App />)
    await user.upload(
      screen.getByLabelText(/choose video/i),
      new File(['video'], 'first.mp4', { type: 'video/mp4' }),
    )
    expect(await screen.findAllByText('first.mp4')).toHaveLength(2)

    const video = container.querySelector('video') as HTMLVideoElement
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 1920 },
      videoHeight: { configurable: true, value: 1080 },
      currentTime: { configurable: true, value: 12.4, writable: true },
    })
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 400,
      width: 400,
      height: 400,
      toJSON: () => ({}),
    })
    fireEvent.loadedMetadata(video)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point/i }), {
      clientX: 200,
      clientY: 200,
    })
    await user.click(screen.getByRole('button', { name: /add text here/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /^main text$/i }), { target: { value: 'Santosh' } })
    await user.click(screen.getByRole('button', { name: /create proposal/i }))

    fireEvent.timeUpdate(video)
    expect(screen.getByTestId('nameplate-overlay')).toHaveTextContent('Santosh')
    expect(screen.getByText(/^pending$/i)).toBeInTheDocument()

    // Double-click: the second click must not create a second edit, because
    // one approved request is exactly one change set.
    await user.dblClick(screen.getByRole('button', { name: /^accept proposal$/i }))
    await waitFor(() => expect(screen.getAllByText('Santosh').length).toBeGreaterThan(0))
    await waitFor(() => expect(first.current().changeSets).toHaveLength(1))
    expect(first.current().revision).toBe(1)

    await user.click(screen.getByRole('button', { name: /^undo edit$/i }))
    await waitFor(() => expect(screen.queryByTestId('nameplate-overlay')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /^redo edit$/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /^redo edit$/i }))
    fireEvent.timeUpdate(video)
    await waitFor(() => expect(screen.getByTestId('nameplate-overlay')).toHaveTextContent('Santosh'))

    await user.click(screen.getByRole('button', { name: /back to home/i }))
    await user.upload(
      screen.getByLabelText(/choose video/i),
      new File(['video'], 'second.mp4', { type: 'video/mp4' }),
    )
    expect(await screen.findAllByText('second.mp4')).toHaveLength(2)

    // A different project starts clean; the first project's edits do not leak.
    expect(screen.getByText(/tell sanverse what you want to change/i)).toBeInTheDocument()
    expect(screen.getByText(/no accepted edits/i)).toBeInTheDocument()
  })

  it('stays on Home with visible progress and a recoverable import failure', async () => {
    const user = userEvent.setup()
    let rejectUpload!: (reason: Error) => void
    const pendingIntake = new Promise<Response>((_resolve, reject) => { rejectUpload = reject })
    fetchMock.mockReset().mockImplementation(exceptRecentProjects(() => pendingIntake))
    render(<App />)

    await user.upload(screen.getByLabelText(/choose video/i), new File(['video'], 'clip.mp4', { type: 'video/mp4' }))
    expect(screen.getByRole('status')).toHaveTextContent(/importing video/i)
    expect(screen.getByLabelText(/choose video/i)).toBeDisabled()

    rejectUpload(new Error('offline'))
    await act(async () => undefined)
    expect(screen.getByRole('alert')).toHaveTextContent(/could not import/i)
    expect(screen.getByLabelText(/choose video/i)).toBeEnabled()
    expect(screen.getByRole('heading', { name: /what do you want to edit today/i })).toBeInTheDocument()
  })

  it('completes import, accepted edit, export progress, and downloadable MP4 as one loop', async () => {
    const user = userEvent.setup()
    let resolveExport!: (response: Response) => void
    const pendingExport = new Promise<Response>((resolve) => { resolveExport = resolve })
    const api = fakeApi()
    fetchMock.mockReset().mockImplementation((url: string, options?: RequestInit) => {
      if (url === PROJECTS_URL && options?.method === 'POST') return projectResponse()
      if (url === '/api/projects/project_1234567890abcdef/exports') return pendingExport
      return api.handle(url, options) ?? recentProjectsResponse()
    })
    const { container } = render(<App />)

    await user.upload(screen.getByLabelText(/choose video/i), new File(['video'], 'cleaned.mp4', { type: 'video/mp4' }))
    expect(await screen.findAllByText('cleaned.mp4')).toHaveLength(2)
    const video = container.querySelector('video') as HTMLVideoElement
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 1920 }, videoHeight: { configurable: true, value: 1080 },
      currentTime: { configurable: true, value: 1, writable: true },
    })
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON: () => ({}) })
    fireEvent.loadedMetadata(video)
    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point/i }), { clientX: 200, clientY: 200 })
    await user.click(screen.getByRole('button', { name: /add text here/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /^main text$/i }), { target: { value: 'Santosh' } })
    await user.click(screen.getByRole('button', { name: /create proposal/i }))
    await user.click(screen.getByRole('button', { name: /^accept proposal$/i }))
    await waitFor(() => expect(api.current().changeSets).toHaveLength(1))

    await user.click(await screen.findByRole('button', { name: /export video/i }))
    // The status names the phase the server is actually in and shows elapsed
    // time. A bare spinner cannot tell a four-second export from a nine-minute
    // stall, which is how an export was left "rendering" past 90 seconds with
    // nothing on screen admitting it.
    const exportStatus = screen.getByRole('status', { name: /export status/i })
    expect(exportStatus).toHaveTextContent(/waiting to start|rendering|checking the finished/i)
    expect(screen.getByTestId('export-elapsed')).toHaveTextContent(/^\d+:\d{2}$/)
    // No edit list is sent: the server compiles the project it has stored.
    expect(fetchMock).toHaveBeenLastCalledWith('/api/projects/project_1234567890abcdef/exports', expect.objectContaining({ method: 'POST' }))
    const exportInit = fetchMock.mock.calls.at(-1)?.[1] as RequestInit
    expect(exportInit.body).toBeUndefined()

    resolveExport(exportResponse())
    await act(async () => undefined)
    expect(screen.getByRole('link', { name: /download mp4/i })).toHaveAttribute('href', '/api/projects/project_1234567890abcdef/exports/export_1234567890abcdef/media')
  })
  it('lets the user try again after a failed open, instead of going dead until reload', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    let failNextOpen = true
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url === `/api/projects/${api.manifest.id}` && failNextOpen) {
        failNextOpen = false
        return new Response('{}', { status: 500 })
      }
      return api.handle(url, options) ?? new Response('{}', { status: 404 })
    })
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /open cleaned.mp4/i }))
    expect(await screen.findByText(/could not load your local projects/i)).toBeInTheDocument()

    // The second attempt must actually be attempted. An in-flight flag that is
    // only released on the paths that succeed leaves Home silently ignoring
    // every later click.
    await user.click(screen.getByRole('button', { name: /open cleaned.mp4/i }))
    expect(await screen.findByRole('button', { name: /enter point mode/i })).toBeInTheDocument()
  })

  it('turns a typed request into a previewable proposal that is only saved on accept', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    const base = api.current()
    const assetId = base.composition.tracks[0].clips[0].assetId
    const aiChangeSet = {
      schemaVersion: 'sanverse.change-set/v1',
      changeSetId: 'changeset_ai000001',
      baseRevision: base.revision,
      operations: [{
        schemaVersion: 'sanverse.operation/v3',
        operationId: 'operation_ai000001',
        kind: 'add-nameplate',
        capabilityId: 'sanverse.nameplate.component/v1',
        assetId,
        sourceInterval: {
          start: { ticks: 0, timescale: 1_440_000 },
          duration: { ticks: 4_000 * 1_440, timescale: 1_440_000 },
        },
        target: { coordinateSpace: 'composition-normalized', point: { x: 0.5, y: 0.5 }, anchor: 'center' },
        primaryText: 'Santosh',
        secondaryText: 'Founder',
        extensions: {},
      }],
      provenance: { source: 'ai', requestId: 'request_aaaaaaaa' },
      extensions: {},
    }

    let intentCalls = 0
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url === `/api/projects/${api.manifest.id}/intents` && options?.method === 'POST') {
        intentCalls += 1
        return new Response(
          JSON.stringify({
            outcome: {
              kind: 'proposal',
              requestId: 'request_aaaaaaaa',
              changeSet: aiChangeSet,
              explanation: 'Shows "Santosh" from 0:00.0 for 4.0 seconds.',
              note: 'Placed where you pointed.',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      return api.handle(url, options) ?? new Response('{}', { status: 404 })
    })
    const { container } = render(<App />)

    await user.click(await screen.findByRole('button', { name: /open cleaned.mp4/i }))
    const chat = await screen.findByRole('textbox', { name: /ask for an edit/i })
    expect(screen.getByRole('group', { name: /export unavailable/i }))
      .toHaveAccessibleDescription(/accept at least one edit before exporting/i)
    fireEvent.change(chat, { target: { value: 'keep this unsent' } })

    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    if (video) video.currentTime = 7.5

    await user.click(screen.getByRole('button', { name: /studio workspace/i }))
    const expandAi = screen.queryByRole('button', { name: /^(expand ai|open ai overlay)$/i })
    if (expandAi) await user.click(expandAi)
    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(container.querySelector('video')).toBe(video)
    expect(video?.currentTime).toBe(7.5)
    expect(screen.getByRole('textbox', { name: /ask for an edit/i })).toHaveValue('keep this unsent')

    for (const workspaceName of ['Effects', 'Color', 'Audio', 'Edit']) {
      await user.click(screen.getByRole('tab', { name: workspaceName }))
      expect(screen.getByRole('tab', { name: workspaceName })).toHaveAttribute('aria-selected', 'true')
      expect(container.querySelectorAll('video')).toHaveLength(1)
      expect(container.querySelector('video')).toBe(video)
      expect(video?.currentTime).toBe(7.5)
      expect(screen.getByRole('textbox', { name: /ask for an edit/i })).toHaveValue('keep this unsent')
      expect(api.current().revision).toBe(base.revision)
    }

    await user.click(screen.getByRole('button', { name: /assist workspace/i }))
    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(container.querySelector('video')).toBe(video)
    expect(video?.currentTime).toBe(7.5)
    expect(screen.getByRole('textbox', { name: /ask for an edit/i })).toHaveValue('keep this unsent')

    fireEvent.change(chat, { target: { value: 'add my name here' } })
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    expect(await screen.findByText(/suggested by the assistant/i)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /export unavailable/i }))
      .toHaveAccessibleDescription(/pending proposal before exporting/i)
    // Asking changed nothing on the server.
    expect(api.current().revision).toBe(base.revision)

    const primary = screen.getByLabelText(/main text/i)
    fireEvent.change(primary, { target: { value: 'Santosh Budha' } })
    fireEvent.blur(primary)

    await user.click(screen.getByRole('button', { name: /studio workspace/i }))
    expect(screen.getByText(/suggested by the assistant/i)).toBeInTheDocument()
    expect(container.querySelector('video')).toBe(video)
    expect(video?.currentTime).toBe(7.5)
    expect(screen.getByLabelText(/main text/i)).toHaveValue('Santosh Budha')

    for (const workspaceName of ['Effects', 'Color', 'Audio', 'Edit']) {
      await user.click(screen.getByRole('tab', { name: workspaceName }))
      expect(screen.getByText(/suggested by the assistant/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/main text/i)).toHaveValue('Santosh Budha')
      expect(container.querySelectorAll('video')).toHaveLength(1)
      expect(api.current().revision).toBe(base.revision)
    }

    await user.click(screen.getByRole('button', { name: /assist workspace/i }))
    expect(screen.getByText(/suggested by the assistant/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/main text/i)).toHaveValue('Santosh Budha')
    expect(api.current().revision).toBe(base.revision)

    await user.click(screen.getByRole('button', { name: /^accept proposal$/i }))
    await waitFor(() => expect(api.current().revision).toBe(base.revision + 1))
    expect(screen.queryByRole('group', { name: /export unavailable/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export video/i })).toBeEnabled()
    expect(api.current().changeSets.at(-1)?.changeSet.provenance).toEqual({
      source: 'ai',
      requestId: 'request_aaaaaaaa',
    })
    expect(api.current().changeSets.at(-1)?.changeSet.operations[0]).toEqual(
      expect.objectContaining({ primaryText: 'Santosh Budha' }),
    )
    expect(intentCalls).toBe(1)
  }, 15_000)
})
