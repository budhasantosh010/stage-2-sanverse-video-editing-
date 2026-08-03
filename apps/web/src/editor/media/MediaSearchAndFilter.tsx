import type { MediaBinViewModel, MediaFilter, MediaPresentationState } from '../../features/media'
import { MediaMenu } from './MediaMenu'

/**
 * Search, the folder you are in, and the kind filter.
 *
 * The filter is the part that has to change shape with the panel width, and the
 * rule it obeys is: NEVER five equal squeezed buttons. Below about 320px, five
 * buttons each get roughly 55px, the words are clipped to "Vid…", "Ima…", and
 * the control becomes a guessing game. So instead:
 *
 *   wide       All | Video | Image | Audio | Missing      five real buttons
 *   standard   All | Video | Image | Audio | More         two rarest fold away
 *   compact    Filter · Video                             one button, one menu
 *   minimum    ▾ (with a dot when a filter is on)         icon plus indicator
 *
 * Every one of those routes to the SAME `filter` value and the SAME callback.
 * There is one filter, shown four ways — not four filters that have to be kept
 * in step, which is how a panel ends up saying "Video" in one place and showing
 * pictures in another.
 */

const FILTERS: readonly Readonly<{ id: MediaFilter; label: string }>[] = Object.freeze([
  Object.freeze({ id: 'all' as const, label: 'All' }),
  Object.freeze({ id: 'video' as const, label: 'Video' }),
  Object.freeze({ id: 'image' as const, label: 'Image' }),
  Object.freeze({ id: 'audio' as const, label: 'Audio' }),
  Object.freeze({ id: 'missing' as const, label: 'Missing' }),
])

/** Kept visible longest, because they are what people reach for most. */
const PRIMARY_FILTERS: readonly MediaFilter[] = Object.freeze(['all', 'video', 'image'])

const countFor = (model: MediaBinViewModel, id: MediaFilter): number =>
  id === 'all' ? model.counts.all
    : id === 'missing' ? model.counts.missing
      : model.counts[id]

export function MediaSearchAndFilter({
  model,
  presentation,
  folderLabel,
  resultCount,
  onChange,
}: Readonly<{
  model: MediaBinViewModel
  presentation: MediaPresentationState
  folderLabel: string
  resultCount: number
  onChange(change: Partial<MediaPresentationState>): void
}>) {
  const active = FILTERS.find((item) => item.id === presentation.filter) ?? FILTERS[0]
  const filterIsOn = presentation.filter !== 'all'

  const item = (entry: (typeof FILTERS)[number]) => (
    <button
      key={entry.id}
      type="button"
      aria-pressed={presentation.filter === entry.id}
      onClick={() => onChange({ filter: entry.id })}
    >
      {entry.label}<span>{countFor(model, entry.id)}</span>
    </button>
  )

  return (
    <div className="media-bin__toolbar">
      <label className="media-bin__search">
        <span className="sr-only">Search media</span>
        <input
          value={presentation.query}
          maxLength={120}
          placeholder="Search media"
          onChange={(event) => onChange({ query: event.currentTarget.value })}
        />
      </label>
      {presentation.query ? (
        <button type="button" className="media-bin__clear" onClick={() => onChange({ query: '' })}>Clear</button>
      ) : null}

      {/* Wide and standard: real buttons. `--secondary` ones fold into More. */}
      <div className="media-bin__filters" role="group" aria-label="Filter media by kind">
        {FILTERS.map((entry) => (
          <span key={entry.id} className="media-bin__filter-slot" data-filter={entry.id}>
            {item(entry)}
          </span>
        ))}
        <span className="media-bin__filter-slot media-bin__filter-slot--overflow">
          <MediaMenu
            label={`More filters, ${active.label} selected`}
            title="More media filters"
            align="end"
            trigger={<>More{filterIsOn && !PRIMARY_FILTERS.includes(presentation.filter) ? <span className="media-bin__filter-dot" aria-hidden="true" /> : null}</>}
          >
            {(close) => FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="menuitemradio"
                aria-checked={presentation.filter === entry.id}
                onClick={() => { close(); onChange({ filter: entry.id }) }}
              >
                <span>{entry.label}</span><span className="media-menu__hint">{countFor(model, entry.id)}</span>
              </button>
            ))}
          </MediaMenu>
        </span>
      </div>

      {/* Compact and minimum: one control, never a squeezed row. */}
      <div className="media-bin__filter-compact">
        <MediaMenu
          label={`Filter media, ${active.label} selected`}
          title="Media filters"
          align="end"
          trigger={<>
            <span className="media-bin__label-wide">Filter · {active.label}</span>
            <span className="media-bin__label-narrow" aria-hidden="true">
              ⚟{filterIsOn ? <span className="media-bin__filter-dot" /> : null}
            </span>
          </>}
        >
          {(close) => FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="menuitemradio"
              aria-checked={presentation.filter === entry.id}
              onClick={() => { close(); onChange({ filter: entry.id }) }}
            >
              <span>{entry.label}</span><span className="media-menu__hint">{countFor(model, entry.id)}</span>
            </button>
          ))}
        </MediaMenu>
      </div>

      <p className="media-bin__result-count" role="status">
        <span data-testid="media-current-folder">{folderLabel}</span>
        {' · '}
        {resultCount} {resultCount === 1 ? 'result' : 'results'}
        {filterIsOn ? ` · ${active.label} only` : ''}
      </p>
    </div>
  )
}
