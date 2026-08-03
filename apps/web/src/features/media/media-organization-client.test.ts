import { describe, expect, it, vi } from 'vitest'
import {
  loadMediaOrganization,
  MediaOrganizationRequestError,
  sendMediaOrganizationCommand,
} from './media-organization-client'

const PROJECT = 'project_1234567890abcdef'

const organization = Object.freeze({
  schemaVersion: 'sanverse.media-organization/v1',
  folders: Object.freeze([Object.freeze({ folderId: 'folder_aaaaaaaa', name: 'B-roll', createdAt: '2026-08-03T10:00:00.000Z' })]),
  assetFolderAssignments: Object.freeze({ asset_00000001: 'folder_aaaaaaaa' }),
})

/**
 * A fresh Response per call. Reusing one Response silently fails the second
 * read, because a body can only be consumed once.
 */
const answering = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }))

describe('reading folders from the server', () => {
  it('asks the project-scoped endpoint and returns what the server says', async () => {
    const fetcher = answering(200, { organization })
    expect(await loadMediaOrganization(PROJECT, fetcher as unknown as typeof fetch)).toEqual(organization)
    expect(fetcher).toHaveBeenCalledWith(`/api/projects/${PROJECT}/media-organization`, { signal: undefined })
  })

  it('refuses an answer it does not recognise instead of showing it as your filing', async () => {
    // A proxy, a login page, or an older server can all return valid JSON.
    // Believing one would look exactly like "all my folders have vanished".
    for (const body of [
      {},
      { organization: null },
      { organization: { schemaVersion: 'sanverse.media-organization/v2', folders: [], assetFolderAssignments: {} } },
      { organization: { schemaVersion: 'sanverse.media-organization/v1', folders: 'none', assetFolderAssignments: {} } },
      { organization: { schemaVersion: 'sanverse.media-organization/v1', folders: [], assetFolderAssignments: null } },
    ]) {
      await expect(loadMediaOrganization(PROJECT, answering(200, body) as unknown as typeof fetch))
        .rejects.toBeInstanceOf(MediaOrganizationRequestError)
    }
  })

  it('passes the server refusal through in the server words, with its code', async () => {
    const fetcher = answering(400, { error: 'A folder with that name already exists.', code: 'FOLDER_NAME_DUPLICATE' })
    await expect(loadMediaOrganization(PROJECT, fetcher as unknown as typeof fetch))
      .rejects.toMatchObject({ code: 'FOLDER_NAME_DUPLICATE', message: 'A folder with that name already exists.' })
  })

  it('says something plain when the server says nothing useful at all', async () => {
    const fetcher = vi.fn(async () => new Response('<html>gateway</html>', { status: 502 }))
    await expect(loadMediaOrganization(PROJECT, fetcher as unknown as typeof fetch))
      .rejects.toMatchObject({ message: expect.stringContaining('The media itself is safe.') })
  })
})

describe('sending one folder command', () => {
  it('sends the command in the envelope the server expects', async () => {
    const fetcher = answering(200, { organization })
    await sendMediaOrganizationCommand(PROJECT, { kind: 'create-folder', name: 'B-roll' }, fetcher as unknown as typeof fetch)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`/api/projects/${PROJECT}/media-organization`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ command: { kind: 'create-folder', name: 'B-roll' } })
  })

  it('reports a refused command rather than pretending it worked', async () => {
    const fetcher = answering(400, { error: 'A folder with that name already exists.', code: 'FOLDER_NAME_DUPLICATE' })
    await expect(sendMediaOrganizationCommand(PROJECT, { kind: 'create-folder', name: 'B-roll' }, fetcher as unknown as typeof fetch))
      .rejects.toMatchObject({ code: 'FOLDER_NAME_DUPLICATE' })
  })
})
