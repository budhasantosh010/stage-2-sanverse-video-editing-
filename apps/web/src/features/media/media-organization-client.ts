import {
  EMPTY_MEDIA_ORGANIZATION,
  MEDIA_ORGANIZATION_SCHEMA_VERSION,
  type MediaOrganizationV1,
} from '@sanverse/edit-domain/media-organization'

/**
 * Talking to the one place folders actually live: a file on the server, beside
 * the project. See DOCS/decisions/ADR-MEDIA-ORGANIZATION-V1.md for why not the
 * browser's own storage and why not inside the project.
 *
 * The rule this file exists to enforce: THE SERVER IS THE AUTHORITY. The browser
 * never edits its own copy and then tells the server about it. It sends a
 * command, waits, and shows whatever comes back. That is slower by one round
 * trip and it is worth it — the alternative is a panel that shows a folder that
 * was refused, which is a lie the user cannot detect.
 */

export class MediaOrganizationRequestError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'MediaOrganizationRequestError'
    this.code = code
  }
}

/** The commands the server will accept. Same five as the domain. */
export type MediaOrganizationCommand =
  | Readonly<{ kind: 'create-folder'; name: string }>
  | Readonly<{ kind: 'rename-folder'; folderId: string; name: string }>
  | Readonly<{ kind: 'move-asset-to-folder'; assetId: string; folderId: string }>
  | Readonly<{ kind: 'move-asset-to-root'; assetId: string }>
  | Readonly<{ kind: 'delete-folder'; folderId: string }>

const GENERIC_FAILURE = 'Your folders could not be reached. The media itself is safe.'

/**
 * Check the answer is really an organization before believing it.
 *
 * A response that is merely JSON is not proof of anything: a proxy, a login
 * page, or an older server can all return JSON. Refusing an unrecognised shape
 * keeps a corrupt answer from being displayed as though it were the user's real
 * filing — which would look exactly like "all my folders vanished".
 */
const readOrganization = (payload: unknown): MediaOrganizationV1 => {
  const body = payload as { organization?: unknown } | null
  const organization = body?.organization as MediaOrganizationV1 | undefined
  if (
    typeof organization !== 'object' || organization === null
    || organization.schemaVersion !== MEDIA_ORGANIZATION_SCHEMA_VERSION
    || !Array.isArray(organization.folders)
    || typeof organization.assetFolderAssignments !== 'object'
    || organization.assetFolderAssignments === null
  ) {
    throw new MediaOrganizationRequestError('ORGANIZATION_UNREADABLE', GENERIC_FAILURE)
  }
  return Object.freeze({
    schemaVersion: MEDIA_ORGANIZATION_SCHEMA_VERSION,
    folders: Object.freeze([...organization.folders]),
    assetFolderAssignments: Object.freeze({ ...organization.assetFolderAssignments }),
  })
}

const failureOf = async (response: Response): Promise<never> => {
  const body = await response.json().catch(() => null) as { error?: unknown; code?: unknown } | null
  throw new MediaOrganizationRequestError(
    typeof body?.code === 'string' ? body.code : 'ORGANIZATION_REQUEST_FAILED',
    typeof body?.error === 'string' && body.error.length > 0 ? body.error : GENERIC_FAILURE,
  )
}

const endpoint = (projectId: string): string => `/api/projects/${projectId}/media-organization`

export async function loadMediaOrganization(
  projectId: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<MediaOrganizationV1> {
  const response = await fetcher(endpoint(projectId), { signal })
  if (!response.ok) await failureOf(response)
  return readOrganization(await response.json().catch(() => null))
}

export async function sendMediaOrganizationCommand(
  projectId: string,
  command: MediaOrganizationCommand,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<MediaOrganizationV1> {
  const response = await fetcher(endpoint(projectId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command }),
    signal,
  })
  if (!response.ok) await failureOf(response)
  return readOrganization(await response.json().catch(() => null))
}

export { EMPTY_MEDIA_ORGANIZATION }
export type { MediaOrganizationV1 }
