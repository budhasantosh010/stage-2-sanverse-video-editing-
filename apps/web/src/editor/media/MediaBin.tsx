import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import {
  EMPTY_MEDIA_ORGANIZATION,
  type MediaOrganizationV1,
} from '@sanverse/edit-domain/media-organization'
import {
  applyMediaPresentation,
  EMPTY_MEDIA_PRESENTATION,
  mediaFolderCounts,
  mediaImportChoice,
  reconcileFolderSelection,
  selectMediaResults,
  splitImportFiles,
  type MediaBinViewModel,
  type MediaImportKind,
  type MediaPresentationState,
} from '../../features/media'
import type { MediaOrganizationController } from '../../features/media/use-media-organization'
import { DisabledAction } from '../ui/DisabledAction'
import { MediaHeader } from './MediaHeader'
import { MediaSearchAndFilter } from './MediaSearchAndFilter'
import { MediaResults } from './MediaResults'
import { MediaContextMenu } from './MediaContextMenu'
import './MediaBin.css'

/**
 * The Media panel: the shelf the project's material sits on.
 *
 *   MediaHeader            fixed   what this is, and the four whole-shelf menus
 *   MediaSearchAndFilter   fixed   search, which folder, which kind
 *   MediaResults           SCROLLS the rows
 *   details                fixed   what you can do with the one you picked
 *
 * Nothing in this panel is an edit. Searching, filtering, sorting, choosing a
 * folder, and moving something between folders all leave the project's revision,
 * its history, and the exported MP4 exactly as they were. The two things here
 * that DO touch the project are importing (which adds an asset — still not an
 * edit, see ADR-007) and the two "Add …" actions, which propose a real edit
 * through the callbacks the screen owns.
 *
 * Presentation state is a PROP, not local state, because this component is
 * unmounted whenever the user switches workspace — see media-presentation.ts.
 */
export function MediaBin({
  model,
  selectedAssetId,
  busy,
  presentation = EMPTY_MEDIA_PRESENTATION,
  organization,
  onPresentationChange,
  onSelect,
  onImport,
  onAddAsBroll,
  onAddAsMusic,
}: Readonly<{
  model: MediaBinViewModel
  selectedAssetId: string | null
  busy: boolean
  presentation?: MediaPresentationState
  /** Server-owned folders. Absent in surfaces that do not offer folders yet. */
  organization?: MediaOrganizationController
  onPresentationChange?(next: MediaPresentationState): void
  onSelect(assetId: string): void
  onImport(files: readonly File[]): Promise<string | null>
  onAddAsBroll(assetId: string): Promise<string | null>
  onAddAsMusic(assetId: string): Promise<string | null>
}>) {
  const [localPresentation, setLocalPresentation] = useState<MediaPresentationState>(presentation)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [refusals, setRefusals] = useState<readonly string[]>(Object.freeze([]))
  const [dropActive, setDropActive] = useState(false)
  const [menuAssetId, setMenuAssetId] = useState<string | null>(null)
  const [folderPrompt, setFolderPrompt] = useState<Readonly<{ folderId: string | null; value: string }> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const importingRef = useRef(false)

  // When the screen owns the state, that is the truth. When it does not — the
  // panel used standalone, or in a test — the panel keeps its own copy so it is
  // never a broken control. One of the two, never a mix of both.
  const view = onPresentationChange ? presentation : localPresentation
  const change = (patch: Partial<MediaPresentationState>) => {
    const next = applyMediaPresentation(view, patch)
    if (onPresentationChange) onPresentationChange(next)
    else setLocalPresentation(next)
  }

  const folders = organization?.organization.folders ?? EMPTY_MEDIA_ORGANIZATION.folders
  const organizationValue: MediaOrganizationV1 = organization?.organization ?? EMPTY_MEDIA_ORGANIZATION
  const organizationPending = organization?.pending ?? false

  // A folder that has gone — deleted here, or in another window — must not leave
  // the panel pointing at an empty list forever.
  useEffect(() => {
    const reconciled = reconcileFolderSelection(view, folders.map((folder) => folder.folderId))
    if (reconciled !== view) {
      if (onPresentationChange) onPresentationChange(reconciled)
      else setLocalPresentation(reconciled)
    }
  }, [folders, onPresentationChange, view])

  const results = useMemo(
    () => selectMediaResults(model, view, organizationValue),
    [model, organizationValue, view],
  )
  const counts = useMemo(() => mediaFolderCounts(model, organizationValue), [model, organizationValue])
  const selected = model.assets.find((item) => item.assetId === selectedAssetId) ?? null
  const menuAsset = model.assets.find((item) => item.assetId === menuAssetId) ?? null
  const disabled = busy || working
  const activeFolder = folders.find((folder) => folder.folderId === view.folderId) ?? null
  const assignments = organizationValue.assetFolderAssignments

  const importFiles = async (files: readonly File[]) => {
    if (disabled || importingRef.current || files.length === 0) return
    const split = splitImportFiles(files)
    setRefusals(split.refusals)
    if (split.accepted.length === 0) {
      setNotice(null)
      return
    }
    // A ref, not the `working` flag: two file-chooser events in the same frame
    // both read the old state, so only a ref can stop the same files being
    // uploaded twice.
    importingRef.current = true
    setWorking(true)
    setNotice(null)
    const failure = await onImport(split.accepted)
    importingRef.current = false
    setWorking(false)
    setNotice(failure ?? `${split.accepted.length} ${split.accepted.length === 1 ? 'file' : 'files'} imported.`)
  }

  /**
   * One hidden file input for all four Import choices. Its `accept` is set
   * directly on the element rather than through React state because the dialog
   * has to open in the same user gesture — a state update would not have been
   * applied yet, and the user would get the previous choice's filter.
   */
  const openPicker = (kind: MediaImportKind) => {
    const input = inputRef.current
    if (!input || disabled) return
    input.accept = mediaImportChoice(kind).accept
    input.click()
  }

  const run = async (action: () => Promise<string | null>) => {
    if (disabled) return
    setWorking(true)
    setNotice(null)
    const failure = await action()
    setWorking(false)
    setMenuAssetId(null)
    setNotice(failure ?? 'Added. Undo removes the placement but keeps the imported media.')
  }

  const runOrganization = async (command: Parameters<MediaOrganizationController['run']>[0]) => {
    if (!organization) return
    setMenuAssetId(null)
    const failure = await organization.run(command)
    // A refused folder change is answered in the same place every other Media
    // outcome is answered, so the user has one place to look.
    setNotice(failure)
  }

  const submitFolderPrompt = async () => {
    if (!folderPrompt || !organization) return
    const name = folderPrompt.value.trim()
    if (name.length === 0) return
    const command = folderPrompt.folderId === null
      ? Object.freeze({ kind: 'create-folder' as const, name })
      : Object.freeze({ kind: 'rename-folder' as const, folderId: folderPrompt.folderId, name })
    const failure = await organization.run(command)
    // A refused name leaves the form open with the text still in it, so the
    // user can fix a clash instead of typing the whole thing again.
    if (!failure) setFolderPrompt(null)
  }

  const navigate = (event: KeyboardEvent<HTMLButtonElement>, assetId: string) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(assetId)
      return
    }
    event.preventDefault()
    const current = results.visible.findIndex((item) => item.assetId === assetId)
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
    const next = results.visible[(current + direction + results.visible.length) % results.visible.length]
    if (!next) return
    onSelect(next.assetId)
    listRef.current?.querySelector<HTMLButtonElement>(`[data-asset-id="${next.assetId}"]`)?.focus()
  }

  const openMenu = (assetId: string, _event: MouseEvent<HTMLButtonElement>) => {
    onSelect(assetId)
    setMenuAssetId(assetId)
  }

  return (
    <div className="media-bin" data-testid="media-panel">
      <MediaHeader
        assetCount={model.counts.all}
        presentation={view}
        folders={folders}
        folderCounts={counts.byFolder}
        rootCount={counts.root}
        busy={disabled}
        importing={working}
        organizationPending={organizationPending}
        organizationLoading={organization?.loading ?? false}
        organizationError={organization?.errorKind === 'load' ? organization.error : null}
        onRetryFolders={() => organization?.refresh()}
        onChange={change}
        onImport={openPicker}
        onCreateFolder={() => setFolderPrompt(Object.freeze({ folderId: null, value: '' }))}
        onRenameFolder={(folderId) => setFolderPrompt(Object.freeze({
          folderId,
          value: folders.find((folder) => folder.folderId === folderId)?.name ?? '',
        }))}
        onDeleteFolder={(folderId) => void runOrganization({ kind: 'delete-folder', folderId })}
      />

      <input
        ref={inputRef}
        className="media-bin__file-input"
        type="file"
        aria-label="Choose media files to import"
        accept={mediaImportChoice('all').accept}
        multiple
        disabled={disabled}
        onChange={(event) => {
          const files = Object.freeze([...(event.currentTarget.files ?? [])])
          event.currentTarget.value = ''
          void importFiles(files)
        }}
      />

      <MediaSearchAndFilter
        model={model}
        presentation={view}
        folderLabel={activeFolder?.name ?? 'All media'}
        resultCount={results.visible.length}
        onChange={change}
      />

      {folderPrompt ? (
        <form
          className="media-bin__folder-prompt"
          onSubmit={(event) => { event.preventDefault(); void submitFolderPrompt() }}
        >
          <label>
            <span className="sr-only">{folderPrompt.folderId === null ? 'New folder name' : 'New name for this folder'}</span>
            <input
              autoFocus
              value={folderPrompt.value}
              maxLength={64}
              placeholder={folderPrompt.folderId === null ? 'New folder name' : 'Rename folder'}
              onChange={(event) => setFolderPrompt(Object.freeze({ ...folderPrompt, value: event.currentTarget.value }))}
              onKeyDown={(event) => { if (event.key === 'Escape') setFolderPrompt(null) }}
            />
          </label>
          <button type="submit" disabled={organizationPending || folderPrompt.value.trim().length === 0}>
            {folderPrompt.folderId === null ? 'Create' : 'Rename'}
          </button>
          <button type="button" onClick={() => setFolderPrompt(null)}>Cancel</button>
        </form>
      ) : null}

      {/*
        A folder failure is reported INSIDE the folder controls, never as a
        panel-wide banner. The user asked about folders; their media, their
        timeline and their export are all untouched by it, and a red bar across
        the whole panel would say otherwise.
      */}
      {organization?.error && folderPrompt ? (
        <p className="media-bin__folder-state media-bin__folder-state--error" role="status">
          {organization.error}
          <button type="button" onClick={organization.dismissError}>Dismiss</button>
        </p>
      ) : null}

      <div ref={listRef} className="media-bin__results-host">
        <MediaResults
          assets={results.visible}
          totalAssets={model.assets.length}
          selectedAssetId={selectedAssetId}
          dropActive={dropActive}
          onSelect={onSelect}
          onOpenMenu={openMenu}
          onKeyDown={navigate}
          onShowAll={() => change({ query: '', filter: 'all', folderId: null })}
          onDropFiles={(files) => void importFiles(files)}
          onDropActiveChange={setDropActive}
        />
      </div>

      {selected ? (
        <section className="media-bin__details" aria-label={`${selected.displayName} details`}>
          <div>
            <strong>{selected.displayName}</strong>
            <span>{selected.status === 'missing'
              ? `Missing media · ${selected.usageCount === 0 ? 'Unused' : `Used ${selected.usageCount} ${selected.usageCount === 1 ? 'time' : 'times'}`}`
              : selected.status === 'checking'
                ? `Checking source · ${selected.usageCount === 0 ? 'Unused' : `Used ${selected.usageCount} ${selected.usageCount === 1 ? 'time' : 'times'}`}`
                : selected.usageCount === 0
                  ? 'Unused'
                  : `Used ${selected.usageCount} ${selected.usageCount === 1 ? 'time' : 'times'}`}</span>
          </div>
          {selected.status === 'checking' ? <p>Checking whether the local source is available. Placement and preview stay unavailable until this finishes.</p> : null}
          {selected.status === 'missing' ? <p>The project still references this asset, but the local source is unavailable.</p> : null}
          <div className="media-bin__actions">
            {(selected.kind === 'video' || selected.kind === 'image') && selected.assetId !== model.assets[0]?.assetId ? (
              <button type="button" disabled={disabled || !selected.canAddAsOverlay} onClick={() => void run(() => onAddAsBroll(selected.assetId))}>
                {selected.kind === 'video' ? 'Add as B-roll' : 'Add at playhead'}
              </button>
            ) : null}
            {selected.kind === 'audio' ? (
              <button type="button" disabled={disabled || !selected.canAddAsMusic} onClick={() => void run(() => onAddAsMusic(selected.assetId))}>Add as music</button>
            ) : null}
            {selected.previewSource ? <a href={selected.previewSource} target="_blank" rel="noreferrer">Preview</a> : null}
            <DisabledAction
              disabled
              label={`Remove ${selected.displayName}`}
              reason={selected.removeBlockedReason}
            >
              <button type="button" disabled>Remove</button>
            </DisabledAction>
          </div>
          {selected.removeBlockedReason ? <p className="media-bin__disabled-reason">{selected.removeBlockedReason}</p> : null}
        </section>
      ) : null}

      {menuAsset ? (
        <MediaContextMenu
          asset={menuAsset}
          folders={folders}
          currentFolderId={assignments[menuAsset.assetId] ?? null}
          busy={disabled}
          organizationPending={organizationPending}
          onAddAsBroll={() => void run(() => onAddAsBroll(menuAsset.assetId))}
          onAddAsMusic={() => void run(() => onAddAsMusic(menuAsset.assetId))}
          onMoveToFolder={(folderId) => void runOrganization({ kind: 'move-asset-to-folder', assetId: menuAsset.assetId, folderId })}
          onMoveToRoot={() => void runOrganization({ kind: 'move-asset-to-root', assetId: menuAsset.assetId })}
          onShowSource={() => {
            setMenuAssetId(null)
            setNotice(
              `${menuAsset.displayName} · ${menuAsset.originalName ?? 'name unknown'} · ` +
              `${menuAsset.width && menuAsset.height ? `${menuAsset.width}×${menuAsset.height}` : 'no picture size'} · ` +
              (menuAsset.status === 'available' ? 'local source available' : `source ${menuAsset.status}`),
            )
          }}
          onClose={() => setMenuAssetId(null)}
        />
      ) : null}

      {refusals.length > 0 ? (
        <ul className="media-bin__refusals" aria-label="Files that were not imported">
          {refusals.map((reason) => <li key={reason} role="alert">{reason}</li>)}
        </ul>
      ) : null}
      {notice ? <p className="media-bin__notice" role="status" aria-live="polite">{notice}</p> : null}
    </div>
  )
}
