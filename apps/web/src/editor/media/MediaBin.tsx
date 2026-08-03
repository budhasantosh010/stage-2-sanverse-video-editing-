import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { filterMediaAssets, type MediaAssetView, type MediaBinViewModel, type MediaFilter } from '../../features/media'
import { DisabledAction } from '../ui/DisabledAction'
import { MediaAssetCard } from './MediaAssetCard'
import { MediaContextMenu } from './MediaContextMenu'
import './MediaBin.css'

const FILTERS: readonly Readonly<{ id: MediaFilter; label: string }>[] = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Images' },
  { id: 'audio', label: 'Audio' },
  { id: 'missing', label: 'Missing' },
])

export function MediaBin({
  model,
  selectedAssetId,
  busy,
  onSelect,
  onImport,
  onAddAsBroll,
  onAddAsMusic,
}: Readonly<{
  model: MediaBinViewModel
  selectedAssetId: string | null
  busy: boolean
  onSelect(assetId: string): void
  onImport(files: readonly File[]): Promise<string | null>
  onAddAsBroll(assetId: string): Promise<string | null>
  onAddAsMusic(assetId: string): Promise<string | null>
}>) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [menuAssetId, setMenuAssetId] = useState<string | null>(null)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const filtered = useMemo(() => filterMediaAssets(model, query, filter), [filter, model, query])
  const selected = model.assets.find((asset) => asset.assetId === selectedAssetId) ?? null
  const menuAsset = model.assets.find((asset) => asset.assetId === menuAssetId) ?? null
  const disabled = busy || working

  useEffect(() => {
    if (!filterMenuOpen) return
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setFilterMenuOpen(false)
      filterButtonRef.current?.focus()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [filterMenuOpen])

  const importFiles = async (files: readonly File[]) => {
    if (disabled || files.length === 0) return
    setWorking(true)
    setNotice(null)
    const failure = await onImport(files)
    setWorking(false)
    setNotice(failure ?? `${files.length} ${files.length === 1 ? 'file' : 'files'} imported.`)
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

  const navigate = (event: KeyboardEvent<HTMLButtonElement>, assetId: string) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(assetId)
      return
    }
    event.preventDefault()
    const current = filtered.findIndex((asset) => asset.assetId === assetId)
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
    const next = filtered[(current + direction + filtered.length) % filtered.length]
    if (!next) return
    onSelect(next.assetId)
    listRef.current?.querySelector<HTMLButtonElement>(`[data-asset-id="${next.assetId}"]`)?.focus()
  }

  const drop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragActive(false)
    void importFiles(Object.freeze([...event.dataTransfer.files]))
  }

  const openMenu = (assetId: string, _event: MouseEvent<HTMLButtonElement>) => {
    onSelect(assetId)
    setMenuAssetId(assetId)
  }

  return (
    <div
      className={`media-bin${dragActive ? ' media-bin--drag-active' : ''}`}
      onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragActive(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragActive(false) }}
      onDrop={drop}
    >
      <header className="media-bin__header">
        <div><h2>Media</h2><span>{model.counts.all} {model.counts.all === 1 ? 'asset' : 'assets'}</span></div>
      </header>
      <div className="media-bin__toolbar">
        <label className="media-bin__search">
          <span className="sr-only">Search media</span>
          <input value={query} maxLength={120} placeholder="Search media" onChange={(event) => setQuery(event.currentTarget.value)} />
        </label>
        {query ? <button type="button" className="media-bin__clear" onClick={() => setQuery('')}>Clear</button> : null}
        <button type="button" className="media-bin__import" disabled={disabled} onClick={() => inputRef.current?.click()}>
          {working ? 'Working…' : 'Import media'}
        </button>
        <input
          ref={inputRef}
          className="media-bin__file-input"
          type="file"
          aria-label="Choose media files to import"
          accept="video/*,image/*,audio/*"
          multiple
          disabled={disabled}
          onChange={(event) => {
            const files = Object.freeze([...(event.currentTarget.files ?? [])])
            event.currentTarget.value = ''
            void importFiles(files)
          }}
        />
        <div className="media-bin__filters" aria-label="Filter media">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
              {item.label}<span>{item.id === 'all' ? model.counts.all : item.id === 'missing' ? model.counts.missing : model.counts[item.id]}</span>
            </button>
          ))}
        </div>
        <div className="media-bin__filter-overflow">
          <button ref={filterButtonRef} type="button" aria-label={`Filter media, ${FILTERS.find((item) => item.id === filter)?.label ?? 'All'} selected`} aria-expanded={filterMenuOpen} onClick={() => setFilterMenuOpen((value) => !value)}>Filter <span>{FILTERS.find((item) => item.id === filter)?.label}</span></button>
          {filterMenuOpen ? <div role="menu" aria-label="Media filters">{FILTERS.map((item) => <button key={item.id} role="menuitemradio" aria-checked={filter === item.id} type="button" onClick={() => { setFilter(item.id); setFilterMenuOpen(false); filterButtonRef.current?.focus() }}>{item.label} <span>{item.id === 'all' ? model.counts.all : item.id === 'missing' ? model.counts.missing : model.counts[item.id]}</span></button>)}</div> : null}
        </div>
        <p className="media-bin__result-count" role="status">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</p>
      </div>

      <div className="media-bin__results">
      {model.assets.length === 0 ? (
        <div className="media-bin__empty">
          <strong>No media yet</strong>
          <p>Import a video, image, or audio file to keep it with this project.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="media-bin__empty">
          <strong>No matching media</strong>
          <p>Clear the search or choose another filter.</p>
          <button type="button" onClick={() => { setQuery(''); setFilter('all') }}>Show all media</button>
        </div>
      ) : (
        <ul ref={listRef} className="media-bin__list" role="listbox" aria-label="Project media assets">
          {filtered.map((asset, index) => (
            <MediaAssetCard
              key={asset.assetId}
              asset={asset}
              selected={asset.assetId === selectedAssetId}
              tabIndex={asset.assetId === selectedAssetId || selectedAssetId === null && index === 0 ? 0 : -1}
              onSelect={() => onSelect(asset.assetId)}
              onOpenMenu={(event) => openMenu(asset.assetId, event)}
              onKeyDown={(event) => navigate(event, asset.assetId)}
            />
          ))}
        </ul>
      )}

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
      </div>

      {menuAsset ? (
        <MediaContextMenu
          asset={menuAsset}
          busy={disabled}
          onAddAsBroll={() => void run(() => onAddAsBroll(menuAsset.assetId))}
          onAddAsMusic={() => void run(() => onAddAsMusic(menuAsset.assetId))}
          onClose={() => setMenuAssetId(null)}
        />
      ) : null}
      {dragActive ? <p className="media-bin__drop-message">Drop files to import them</p> : null}
      {notice ? <p className="media-bin__notice" role="status" aria-live="polite">{notice}</p> : null}
    </div>
  )
}
