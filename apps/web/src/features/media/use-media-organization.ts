import { useCallback, useEffect, useRef, useState } from 'react'
import {
  EMPTY_MEDIA_ORGANIZATION,
  loadMediaOrganization,
  sendMediaOrganizationCommand,
  type MediaOrganizationCommand,
  type MediaOrganizationV1,
} from './media-organization-client'

/**
 * The browser's view of the folders that live on the server.
 *
 * Three states, and the difference between them matters to the person looking:
 *
 *   loading   we have not heard back yet. Show nothing, claim nothing.
 *   ready     this is what the server says. Safe to act on.
 *   error     we asked and were refused or could not reach it. The PREVIOUS
 *             answer is still on screen, because throwing away what we knew
 *             would look identical to "your folders were deleted".
 *
 * `pending` exists to stop two commands racing. Without it, a double-click on
 * "Create folder" sends two identical creates; the first succeeds, the second
 * is refused as a duplicate, and the user is shown an error for something that
 * in fact worked.
 */
export type MediaOrganizationState = Readonly<{
  organization: MediaOrganizationV1
  loading: boolean
  pending: boolean
  error: string | null
  /**
   * Which KIND of failure this was, because the two need different offers.
   *
   *   'load'     we could not read the folder list. "Try again" is the fix.
   *   'command'  the server understood and said no — a name that clashes, a
   *              folder that is gone. Retrying sends the same refused command,
   *              so offering "Try again" would be advice that cannot work.
   */
  errorKind: 'load' | 'command' | null
}>

export type MediaOrganizationController = MediaOrganizationState & Readonly<{
  /** Returns null on success, or the plain-language refusal to show. */
  run(command: MediaOrganizationCommand): Promise<string | null>
  refresh(): void
  dismissError(): void
}>

export function useMediaOrganization(
  projectId: string | null,
  fetcher: typeof fetch = fetch,
): MediaOrganizationController {
  const [state, setState] = useState<MediaOrganizationState>(Object.freeze({
    organization: EMPTY_MEDIA_ORGANIZATION,
    loading: projectId !== null,
    pending: false,
    error: null,
    errorKind: null,
  }))
  // A counter rather than a boolean: bumping it re-runs the load effect, and
  // the effect's own cleanup makes a superseded answer harmless.
  const [reloadToken, setReloadToken] = useState(0)
  const pendingRef = useRef(false)

  useEffect(() => {
    if (projectId === null) return
    let cancelled = false
    setState((current) => Object.freeze({ ...current, loading: true }))
    void loadMediaOrganization(projectId, fetcher)
      .then((organization) => {
        if (!cancelled) setState(Object.freeze({ organization, loading: false, pending: false, error: null, errorKind: null }))
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState((current) => Object.freeze({
          ...current,
          loading: false,
          pending: false,
          error: error instanceof Error ? error.message : 'Your folders could not be reached.',
          errorKind: 'load' as const,
        }))
      })
    return () => { cancelled = true }
  }, [fetcher, projectId, reloadToken])

  const run = useCallback(async (command: MediaOrganizationCommand): Promise<string | null> => {
    if (projectId === null) return 'Open a project first.'
    // Guarded with a ref, not with state: two clicks in the same frame both see
    // the old state value, so a state-based guard would let both through.
    if (pendingRef.current) return null
    pendingRef.current = true
    setState((current) => Object.freeze({ ...current, pending: true, error: null, errorKind: null }))
    try {
      const organization = await sendMediaOrganizationCommand(projectId, command, fetcher)
      setState(Object.freeze({ organization, loading: false, pending: false, error: null, errorKind: null }))
      return null
    } catch (error: unknown) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'That folder change could not be saved.'
      // The organization field is left exactly as it was: a refused command
      // changed nothing on the server, so it must change nothing on screen.
      setState((current) => Object.freeze({ ...current, pending: false, error: message, errorKind: 'command' as const }))
      return message
    } finally {
      pendingRef.current = false
    }
  }, [fetcher, projectId])

  const refresh = useCallback(() => setReloadToken((value) => value + 1), [])
  const dismissError = useCallback(
    () => setState((current) => Object.freeze({ ...current, error: null, errorKind: null })),
    [],
  )

  return { ...state, run, refresh, dismissError }
}
