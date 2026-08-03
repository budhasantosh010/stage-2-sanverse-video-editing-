import type { MediaFilter } from './media-contract'
import type { MediaSortDirection, MediaSortField } from './media-sort'

/**
 * Everything about HOW the Media panel is currently being looked at.
 *
 * All of it is presentation: a search box with words in it, a filter, a sort, a
 * chosen folder. None of it is a decision about the video, so none of it may
 * ever reach `EditProject`, create a revision, or change an export.
 *
 * It is gathered into ONE object for a specific reason. The Media panel is
 * unmounted and remounted by ordinary things the user does — switching from
 * Edit to Colour, collapsing the panel, changing workspace. React throws away
 * the state of an unmounted component. If this state lived inside the panel,
 * every one of those actions would silently clear the user's search and reset
 * their filter, and the user would have no idea why. So it is owned by the
 * screen, which stays mounted, and handed down as one prop.
 *
 * One prop rather than nine also means adding a tenth piece of presentation
 * state later does not widen the panel's interface.
 */

export type MediaPresentationState = Readonly<{
  query: string
  filter: MediaFilter
  sortField: MediaSortField
  sortDirection: MediaSortDirection
  /** null = All media (the root). Otherwise a folder id. */
  folderId: string | null
}>

export const EMPTY_MEDIA_PRESENTATION: MediaPresentationState = Object.freeze({
  query: '',
  filter: 'all' as const,
  sortField: 'added' as const,
  sortDirection: 'ascending' as const,
  folderId: null,
})

/**
 * Search text is capped where it is STORED, not where it is used.
 *
 * Capping at the point of use means every future reader has to remember to cap
 * it too, and one that forgets is a paste of a megabyte of text into a filter
 * that runs on every keystroke.
 */
const MAX_QUERY_LENGTH = 120

export type MediaPresentationChange = Partial<MediaPresentationState>

export const applyMediaPresentation = (
  state: MediaPresentationState,
  change: MediaPresentationChange,
): MediaPresentationState => {
  const next = { ...state, ...change }
  return Object.freeze({
    ...next,
    query: next.query.slice(0, MAX_QUERY_LENGTH),
  })
}

/**
 * When a folder disappears — deleted here, or deleted in another window — the
 * view must fall back to All media rather than show an empty list forever
 * pointing at something that is gone.
 */
export const reconcileFolderSelection = (
  state: MediaPresentationState,
  knownFolderIds: readonly string[],
): MediaPresentationState =>
  state.folderId === null || knownFolderIds.includes(state.folderId)
    ? state
    : Object.freeze({ ...state, folderId: null })
