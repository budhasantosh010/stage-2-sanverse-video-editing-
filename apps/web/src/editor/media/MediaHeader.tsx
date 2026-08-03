import type { MediaFolderV1 } from '@sanverse/edit-domain/media-organization'
import {
  MEDIA_IMPORT_CHOICES,
  MEDIA_SORT_FIELDS,
  MEDIA_SORT_LABELS,
  mediaSortDirectionLabel,
  type MediaImportKind,
  type MediaPresentationState,
  type MediaSortDirection,
  type MediaSortField,
} from '../../features/media'
import { MediaMenu } from './MediaMenu'

/**
 * The fixed top row of the Media panel: what this is, how much of it there is,
 * and the four things you can do to the whole shelf.
 *
 * It never scrolls. Controls that move away when you scroll are controls people
 * stop finding.
 */
export function MediaHeader({
  assetCount,
  presentation,
  folders,
  folderCounts,
  rootCount,
  busy,
  importing,
  organizationPending,
  organizationLoading,
  organizationError,
  onRetryFolders,
  onChange,
  onImport,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: Readonly<{
  assetCount: number
  presentation: MediaPresentationState
  folders: readonly MediaFolderV1[]
  folderCounts: Readonly<Record<string, number>>
  rootCount: number
  busy: boolean
  importing: boolean
  organizationPending: boolean
  organizationLoading: boolean
  /** Why the folder list could not be read, if it could not. */
  organizationError: string | null
  onRetryFolders(): void
  onChange(change: Partial<MediaPresentationState>): void
  onImport(kind: MediaImportKind): void
  onCreateFolder(): void
  onRenameFolder(folderId: string): void
  onDeleteFolder(folderId: string): void
}>) {
  const activeFolder = folders.find((folder) => folder.folderId === presentation.folderId) ?? null
  const folderLabel = activeFolder?.name ?? 'All media'

  return (
    <header className="media-bin__header">
      <div className="media-bin__identity">
        <h2>Media</h2>
        <span className="media-bin__count" data-testid="media-asset-count">
          {/* The spoken count never changes with width. Only the drawn one does,
              so a narrow panel is not a silent panel. */}
          <span className="sr-only">{assetCount} {assetCount === 1 ? 'asset' : 'assets'}</span>
          <span className="media-bin__count-wide" aria-hidden="true">· {assetCount} {assetCount === 1 ? 'asset' : 'assets'}</span>
          <span className="media-bin__count-narrow" aria-hidden="true">{assetCount}</span>
        </span>
      </div>

      <div className="media-bin__header-actions">
        <MediaMenu
          label="Import media"
          title="Import media"
          disabled={busy}
          className="media-menu--import"
          trigger={<>
            <span className="media-bin__label-wide">{importing ? 'Importing…' : 'Import'}</span>
            <span className="media-bin__label-narrow" aria-hidden="true">{importing ? '…' : '+'}</span>
          </>}
        >
          {(close) => MEDIA_IMPORT_CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              role="menuitem"
              onClick={() => { close(); onImport(choice.id) }}
            >
              <span>{choice.label}</span>
              <span className="media-menu__hint">{choice.hint}</span>
            </button>
          ))}
        </MediaMenu>

        <MediaMenu
          label={`Sort media, ${MEDIA_SORT_LABELS[presentation.sortField]}, ${mediaSortDirectionLabel(presentation.sortField, presentation.sortDirection)}`}
          title="Sort media"
          className="media-menu--sort"
          trigger={<>
            <span className="media-bin__label-wide">Sort</span>
            <span className="media-bin__label-narrow" aria-hidden="true">⇅</span>
          </>}
        >
          {(close) => (<>
            {MEDIA_SORT_FIELDS.map((field: MediaSortField) => (
              <button
                key={field}
                type="button"
                role="menuitemradio"
                aria-checked={presentation.sortField === field}
                onClick={() => { close(); onChange({ sortField: field }) }}
              >
                {MEDIA_SORT_LABELS[field]}
              </button>
            ))}
            <hr />
            {(['ascending', 'descending'] as const).map((direction: MediaSortDirection) => (
              <button
                key={direction}
                type="button"
                role="menuitemradio"
                aria-checked={presentation.sortDirection === direction}
                onClick={() => { close(); onChange({ sortDirection: direction }) }}
              >
                {mediaSortDirectionLabel(presentation.sortField, direction)}
              </button>
            ))}
          </>)}
        </MediaMenu>

        <MediaMenu
          label={`Folder, ${folderLabel} selected`}
          title="Media folders"
          disabled={organizationPending}
          className="media-menu--folder"
          align="end"
          trigger={<>
            <span className="media-bin__label-wide">Folder</span>
            <span className="media-bin__label-narrow" aria-hidden="true">▾</span>
          </>}
        >
          {(close) => (<>
            {/* Trouble with folders is reported here, where folders are, and
                never as a banner over the whole panel — the user's media and
                their video are entirely unaffected by it. */}
            {organizationLoading ? <p className="media-menu__note" role="status">Loading folders…</p> : null}
            {organizationError ? (<>
              <p className="media-menu__note" role="status">{organizationError}</p>
              <button type="button" role="menuitem" onClick={onRetryFolders}>Try again</button>
            </>) : null}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={presentation.folderId === null}
              onClick={() => { close(); onChange({ folderId: null }) }}
            >
              <span>All media</span><span className="media-menu__hint">{rootCount} at top level</span>
            </button>
            {folders.map((folder) => (
              <button
                key={folder.folderId}
                type="button"
                role="menuitemradio"
                aria-checked={presentation.folderId === folder.folderId}
                onClick={() => { close(); onChange({ folderId: folder.folderId }) }}
              >
                <span>{folder.name}</span>
                <span className="media-menu__hint">{folderCounts[folder.folderId] ?? 0}</span>
              </button>
            ))}
            <hr />
            <button type="button" role="menuitem" onClick={() => { close(); onCreateFolder() }}>Create folder…</button>
            {activeFolder ? (<>
              <button type="button" role="menuitem" onClick={() => { close(); onRenameFolder(activeFolder.folderId) }}>
                Rename “{activeFolder.name}”…
              </button>
              <button type="button" role="menuitem" onClick={() => { close(); onDeleteFolder(activeFolder.folderId) }}>
                Delete “{activeFolder.name}”
              </button>
            </>) : null}
          </>)}
        </MediaMenu>

        <MediaMenu
          label="More media options"
          title="More media options"
          className="media-menu--more"
          align="end"
          trigger={<span aria-hidden="true">⋯</span>}
        >
          {(close) => (<>
            <button type="button" role="menuitem" onClick={() => { close(); onChange({ query: '', filter: 'all', folderId: null }) }}>
              Show all media
            </button>
            <button type="button" role="menuitem" onClick={() => { close(); onCreateFolder() }}>Create folder…</button>
            <p className="media-menu__note">
              Sorting, filtering and folders change only what you see here. Your video is untouched.
            </p>
          </>)}
        </MediaMenu>
      </div>
    </header>
  )
}
