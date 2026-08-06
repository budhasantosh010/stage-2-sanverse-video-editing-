import { useEffect, useRef, useState } from 'react'

import {
  DEFAULT_VERTICAL_ZOOM_BASIS_POINTS,
  HORIZONTAL_ZOOM_LEVELS,
  MAX_VERTICAL_ZOOM_BASIS_POINTS,
  MIN_VERTICAL_ZOOM_BASIS_POINTS,
  VERTICAL_ZOOM_STEP_BASIS_POINTS,
  horizontalZoomAtLevel,
  horizontalZoomAtMaximum,
  horizontalZoomAtMinimum,
  horizontalZoomLevelIndex,
  PLACEMENT_MODES,
  type PlacementMode,
  type TimelineVerticalZoomV1,
  type TimelineViewportState,
} from '../../features/timeline'
import { formatTimelineTime } from './timeline-ruler-model'

/**
 * The Timeline's controls.
 *
 * ## Why symbols and not words
 *
 * Nine tools written out — Select, Razor, Trim, Magnet, Snap, Marker, Speed,
 * Transition, More — is a wall of text that pushes the zoom controls and the
 * running time off a 1024-pixel screen. Symbols fit, and they are what every
 * editor a person may have used already shows.
 *
 * The words are NOT thrown away. Every button carries:
 *
 *   - a `title`, so hovering says what it is and which key does it;
 *   - an `aria-label`, so a screen reader hears the same sentence;
 *   - and when it cannot be used, BOTH of those become the reason why.
 *
 * A greyed-out button with no explanation is the product refusing to explain
 * itself. That rule was already here and it still holds — it just travels
 * inside the symbol now instead of next to it.
 *
 * ## Nothing here lies about what it can do
 *
 * Speed is shown and disabled, and says plainly that it is not built yet. The
 * alternative — hiding it — means the toolbar changes shape between versions and
 * a user who read about the feature concludes it is missing rather than coming.
 * The alternative that would be WRONG is a Speed button that does nothing when
 * pressed, and that is not what this is: it cannot be pressed, and it says why.
 */

export type TimelineToolbarAction =
  | 'split'
  | 'lift'
  | 'ripple-delete'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'duplicate'
  | 'group'
  | 'ungroup'
  | 'add-marker'
  | 'close-gap'
  | 'transition'
  | 'speed'

/** The tool the pointer is currently holding. Only Select is a real mode today. */
export type TimelineTool = 'select' | 'razor' | 'trim'

export type TimelineToolbarProps = Readonly<{
  durationTicks: number
  timescale: number
  viewport: TimelineViewportState
  verticalZoom: TimelineVerticalZoomV1
  selectedSummary: string | null
  selectedCount: number
  /** Null when the action is available; otherwise the reason it is not, in words. */
  disabledReasons: Readonly<Record<TimelineToolbarAction, string | null>>
  /** The key each action currently answers to, already written for this machine. */
  shortcuts: Readonly<Partial<Record<TimelineToolbarAction, string>>>
  tool: TimelineTool
  snappingEnabled: boolean
  placementMode: PlacementMode
  busy: boolean
  onTool(tool: TimelineTool): void
  onAction(action: TimelineToolbarAction): void
  onToggleSnapping(): void
  onPlacementMode(mode: PlacementMode): void
  onZoomOut(): void
  onZoomIn(): void
  onHorizontalZoom(pixelsPerSecond: number): void
  onReduceTrackHeight(): void
  onIncreaseTrackHeight(): void
  onVerticalZoom(scaleBasisPoints: number): void
  onFitTimeline(): void
  onFitTracks(): void
  onResetVerticalZoom(): void
}>

const MODE_LABELS: Readonly<Record<PlacementMode, string>> = Object.freeze({
  normal: 'Normal',
  insert: 'Insert',
  overwrite: 'Overwrite',
  append: 'Append',
})

const MODE_HINTS: Readonly<Record<PlacementMode, string>> = Object.freeze({
  normal: 'Put it where you drop it, and refuse if something is already there.',
  insert: 'Put it where you drop it and push everything after it along.',
  overwrite: 'Put it where you drop it and cut back whatever it lands on.',
  append: 'Put it after the last thing on that track.',
})

/**
 * One symbol, drawn as lines rather than shipped as a picture file.
 *
 * Drawn lines take the colour of the text around them, so they stay readable in
 * a light theme, a dark theme and high-contrast mode without three sets of
 * files. A picture file would need all three and would get one of them wrong.
 */
const Icon = ({ path }: { path: string }) => (
  <svg
    className="timeline-v1__icon"
    viewBox="0 0 20 20"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d={path} />
  </svg>
)

const ICONS = Object.freeze({
  select: 'M4 3l6 14 2-6 6-2z',
  razor: 'M4 3l9 9M16 3l-9 9M6 16.5a2 2 0 104 0 2 2 0 10-4 0',
  trim: 'M5 3v14M15 3v14M8 10h4',
  magnet: 'M5 4v6a5 5 0 0010 0V4M5 4h3v6M15 4h-3v6',
  snap: 'M10 2v16M5 6h2M13 6h2M5 14h2M13 14h2',
  marker: 'M5 3v14M5 3h9l-2.2 3L14 9H5',
  speed: 'M3 14a7 7 0 1114 0M10 11l4-3',
  transition: 'M3 4h6v12H3zM11 4h6v12h-6zM9 10h2',
  more: 'M5 10h.01M10 10h.01M15 10h.01',
  copy: 'M7 7h8v9H7zM5 13V4h9',
  cut: 'M5 3l10 10M15 3L5 13M4 15.5a2 2 0 104 0 2 2 0 10-4 0M12 15.5a2 2 0 104 0 2 2 0 10-4 0',
  paste: 'M6 4h8v12H6zM8 4V2h4v2',
  duplicate: 'M4 6h8v10H4zM8 6V3h8v10h-4',
  group: 'M3 3h6v6H3zM11 11h6v6h-6zM9 6h2v5h-2',
  ungroup: 'M3 3h6v6H3zM11 11h6v6h-6M13 6l4 4',
  gap: 'M3 6v8M17 6v8M6 10h8M6 8v4M14 8v4',
  delete: 'M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10',
  rippleDelete: 'M4 6h9V4h-4M5 6l1 10h5l1-10M15 8l2 2-2 2',
  horizontalAxis: 'M3 10h14M3 10l3-3M3 10l3 3M17 10l-3-3M17 10l-3 3',
  verticalAxis: 'M10 3v14M10 3L7 6M10 3l3 3M10 17l-3-3M10 17l3-3',
  zoom: 'M8.5 4a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM12 12l4 4M6.5 8.5h4M8.5 6.5v4',
})

type ButtonSpec = Readonly<{
  action: TimelineToolbarAction
  /** The NAME of the action. One word wherever the app already has one. */
  label: string
  /** What it does, in plain words. Shown after the name, never instead of it. */
  hint: string
  icon: string
}>

/** The actions that always have a symbol of their own. */
const PRIMARY_BUTTONS: readonly ButtonSpec[] = Object.freeze([
  /*
   * These three keep the names the app has always used.
   *
   * "Split" was nearly renamed to "Cut where the playhead is" while this was
   * being written. That would have been a mistake twice over: the rest of the
   * app says Split, and the word Cut already means taking something to the
   * clipboard. Two meanings for one word on the same toolbar is exactly the
   * drift CLAUDE.md warns about.
   */
  { action: 'split', label: 'Split', hint: 'Cut the clip where the playhead is', icon: ICONS.razor },
  { action: 'lift', label: 'Delete', hint: 'Take it out and leave the space', icon: ICONS.delete },
  { action: 'ripple-delete', label: 'Ripple delete', hint: 'Take it out and close the space', icon: ICONS.rippleDelete },
])

/** The actions that live behind More, so the row still fits a small screen. */
const OVERFLOW_BUTTONS: readonly ButtonSpec[] = Object.freeze([
  { action: 'copy', label: 'Copy', hint: 'Take a copy of what you picked', icon: ICONS.copy },
  { action: 'cut', label: 'Cut', hint: 'Take a copy and remove it', icon: ICONS.cut },
  { action: 'paste', label: 'Paste', hint: 'Put the copy down where the playhead is', icon: ICONS.paste },
  { action: 'duplicate', label: 'Duplicate', hint: 'Make another one, right after this', icon: ICONS.duplicate },
  { action: 'group', label: 'Group', hint: 'Make these move together', icon: ICONS.group },
  { action: 'ungroup', label: 'Ungroup', hint: 'Stop these moving together', icon: ICONS.ungroup },
  { action: 'close-gap', label: 'Close gap', hint: 'Pull everything after the empty space back', icon: ICONS.gap },
  { action: 'transition', label: 'Transition', hint: 'Fade between this clip and the next', icon: ICONS.transition },
  { action: 'speed', label: 'Speed', hint: 'Change how fast this plays', icon: ICONS.speed },
])

const TOOL_SPECS: readonly Readonly<{ tool: TimelineTool; label: string; hint: string; icon: string; key: string }>[] =
  Object.freeze([
    { tool: 'select', label: 'Select', hint: 'Click things to pick them. Drag empty space to draw a box round several.', icon: ICONS.select, key: 'V' },
    { tool: 'razor', label: 'Razor', hint: 'Click a clip to cut it where you click.', icon: ICONS.razor, key: 'C' },
    { tool: 'trim', label: 'Trim', hint: 'Drag the edge of a clip to make it shorter or longer.', icon: ICONS.trim, key: 'T' },
  ])

export function TimelineToolbar({
  durationTicks,
  timescale,
  viewport,
  verticalZoom,
  selectedSummary,
  selectedCount,
  disabledReasons,
  shortcuts,
  tool,
  snappingEnabled,
  placementMode,
  busy,
  onTool,
  onAction,
  onToggleSnapping,
  onPlacementMode,
  onZoomOut,
  onZoomIn,
  onHorizontalZoom,
  onReduceTrackHeight,
  onIncreaseTrackHeight,
  onVerticalZoom,
  onFitTimeline,
  onFitTracks,
  onResetVerticalZoom,
}: TimelineToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [compactZoom, setCompactZoom] = useState(() => typeof window !== 'undefined' && window.innerWidth < 600)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setCompactZoom(window.innerWidth < 600)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  /*
   * Closing More by clicking elsewhere, and by pressing Escape.
   *
   * Both, because a keyboard user has no "elsewhere" to click, and a menu that
   * can only be closed by the mouse is a trap for them.
   */
  useEffect(() => {
    if (!moreOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMoreOpen(false)
      moreRef.current?.querySelector<HTMLButtonElement>('[data-timeline-more]')?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [moreOpen])

  const reasonFor = (action: TimelineToolbarAction): string | null =>
    busy ? 'Project edits are paused right now.' : disabledReasons[action]

  const actionButton = (spec: ButtonSpec, inMenu: boolean) => {
    const reason = reasonFor(spec.action)
    const shortcut = shortcuts[spec.action]
    // The name first, then the key, then what it does. A screen reader hears
    // the same sentence, and a disabled button says the reason INSTEAD — because
    // "why can I not press this" is the only question that matters then.
    const title = reason ?? `${spec.label}${shortcut ? ` (${shortcut})` : ''} — ${spec.hint}`
    return (
      <button
        key={spec.action}
        type="button"
        // Inside the menu it IS a menu item, so a screen reader announces the
        // list as a list rather than as loose buttons on the page.
        role={inMenu ? 'menuitem' : undefined}
        className={inMenu ? 'timeline-v1__more-item' : 'timeline-v1__icon-button'}
        disabled={reason !== null}
        title={title}
        aria-label={reason ? `${spec.label} — ${reason}` : spec.label}
        data-timeline-action={spec.action}
        onClick={() => {
          onAction(spec.action)
          if (inMenu) setMoreOpen(false)
        }}
      >
        <Icon path={spec.icon} />
        {inMenu ? (
          <>
            <span className="timeline-v1__more-label">{spec.label}</span>
            {shortcut ? <kbd className="timeline-v1__more-key">{shortcut}</kbd> : null}
          </>
        ) : null}
      </button>
    )
  }

  const zoomControls = (
    <div className="timeline-v1__zoom-panel" role="group" aria-label="Timeline Zoom">
      <div className="timeline-v1__zoom-axis" role="group" aria-label="Horizontal timeline zoom controls">
        <span className="timeline-v1__zoom-axis-icon" title="Horizontal zoom"><Icon path={ICONS.horizontalAxis} /></span>
        <button
          type="button"
          onClick={onZoomOut}
          disabled={horizontalZoomAtMinimum(viewport.pixelsPerSecond)}
          aria-label="Zoom Timeline out"
          title="Zoom Timeline out"
        >−</button>
        <input
          type="range"
          min={0}
          max={HORIZONTAL_ZOOM_LEVELS.length - 1}
          step={1}
          value={horizontalZoomLevelIndex(viewport.pixelsPerSecond)}
          aria-label="Timeline horizontal zoom"
          aria-valuetext={`${Math.round(viewport.pixelsPerSecond)} pixels per second`}
          onChange={(event) => onHorizontalZoom(horizontalZoomAtLevel(Number(event.currentTarget.value)))}
        />
        <button
          type="button"
          onClick={onZoomIn}
          disabled={horizontalZoomAtMaximum(viewport.pixelsPerSecond)}
          aria-label="Zoom Timeline in"
          title="Zoom Timeline in"
        >+</button>
        <output aria-label="Timeline horizontal zoom value">{Math.round(viewport.pixelsPerSecond)} px/s</output>
      </div>

      <div className="timeline-v1__zoom-axis" role="group" aria-label="Vertical timeline zoom controls">
        <span className="timeline-v1__zoom-axis-icon" title="Vertical zoom"><Icon path={ICONS.verticalAxis} /></span>
        <button
          type="button"
          onClick={onReduceTrackHeight}
          disabled={verticalZoom.scaleBasisPoints <= MIN_VERTICAL_ZOOM_BASIS_POINTS}
          aria-label="Reduce track height"
          title="Reduce track height"
        >−</button>
        <input
          type="range"
          min={MIN_VERTICAL_ZOOM_BASIS_POINTS}
          max={MAX_VERTICAL_ZOOM_BASIS_POINTS}
          step={VERTICAL_ZOOM_STEP_BASIS_POINTS}
          value={verticalZoom.scaleBasisPoints}
          aria-label="Timeline vertical zoom"
          aria-valuetext={`${Math.round(verticalZoom.scaleBasisPoints / 100)} percent`}
          onChange={(event) => onVerticalZoom(Number(event.currentTarget.value))}
        />
        <button
          type="button"
          onClick={onIncreaseTrackHeight}
          disabled={verticalZoom.scaleBasisPoints >= MAX_VERTICAL_ZOOM_BASIS_POINTS}
          aria-label="Increase track height"
          title="Increase track height"
        >+</button>
        <output aria-label="Timeline vertical zoom value">{Math.round(verticalZoom.scaleBasisPoints / 100)}%</output>
      </div>

      <div className="timeline-v1__zoom-fits" role="group" aria-label="Fit timeline controls">
        <button type="button" onClick={onFitTimeline} aria-label="Fit Timeline horizontally">Fit Timeline</button>
        <button type="button" onClick={onFitTracks} aria-label="Fit tracks vertically">Fit Tracks</button>
        <button
          type="button"
          onClick={onResetVerticalZoom}
          disabled={verticalZoom.scaleBasisPoints === DEFAULT_VERTICAL_ZOOM_BASIS_POINTS}
          aria-label="Reset vertical zoom"
        >Reset height</button>
      </div>
    </div>
  )

  return (
    <div className="timeline-v1__toolbar" aria-label="Timeline controls">
      <div className="timeline-v1__toolbar-group" role="radiogroup" aria-label="Tool">
        {TOOL_SPECS.map((spec) => (
          <button
            key={spec.tool}
            type="button"
            role="radio"
            className="timeline-v1__icon-button"
            aria-checked={tool === spec.tool}
            data-timeline-tool={spec.tool}
            title={`${spec.label} (${spec.key}) — ${spec.hint}`}
            aria-label={`${spec.label}. ${spec.hint}`}
            onClick={() => onTool(spec.tool)}
          >
            <Icon path={spec.icon} />
          </button>
        ))}
      </div>

      <div className="timeline-v1__toolbar-group" role="group" aria-label="Edit">
        {PRIMARY_BUTTONS.map((spec) => actionButton(spec, false))}
        {(() => {
          const reason = reasonFor('add-marker')
          const shortcut = shortcuts['add-marker']
          return (
            <button
              type="button"
              className="timeline-v1__icon-button"
              disabled={reason !== null}
              title={reason ?? `Marker${shortcut ? ` (${shortcut})` : ''} — leave a note here`}
              aria-label={reason ? `Marker — ${reason}` : 'Marker — leave a note here'}
              data-timeline-action="add-marker"
              onClick={() => onAction('add-marker')}
            >
              <Icon path={ICONS.marker} />
            </button>
          )
        })()}
      </div>

      <div className="timeline-v1__toolbar-group" role="group" aria-label="Helpers">
        {/*
          Magnet and Snap are two different things and are deliberately two
          buttons. MAGNET is about what happens to the OTHER clips when
          something lands — do they shuffle along, or does it refuse. SNAP is
          about where the pointer lands — does it jump to a nearby edge. A user
          can want either without the other.
        */}
        <button
          type="button"
          className="timeline-v1__icon-button"
          aria-pressed={placementMode === 'insert'}
          data-timeline-magnet
          title={`Push clips along (magnet). ${MODE_HINTS.insert}`}
          aria-label={`Push clips along. ${MODE_HINTS.insert}`}
          onClick={() => onPlacementMode(placementMode === 'insert' ? 'normal' : 'insert')}
        >
          <Icon path={ICONS.magnet} />
        </button>
        <button
          type="button"
          className="timeline-v1__icon-button"
          aria-pressed={snappingEnabled}
          data-timeline-snapping
          title={`Snapping${shortcuts['add-marker'] ? '' : ''} — jump to the edges of nearby items and to the playhead. Hold Shift while dragging to ignore it.`}
          aria-label="Snapping — jump to the edges of nearby items and to the playhead."
          onClick={onToggleSnapping}
        >
          <Icon path={ICONS.snap} />
        </button>
      </div>

      <div className="timeline-v1__toolbar-group" role="group" aria-label="How a drop lands">
        {PLACEMENT_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className="timeline-v1__toolbar-button"
            aria-pressed={placementMode === mode}
            data-placement-mode={mode}
            title={MODE_HINTS[mode]}
            onClick={() => onPlacementMode(mode)}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <div className="timeline-v1__more" ref={moreRef}>
        <button
          type="button"
          className="timeline-v1__icon-button"
          data-timeline-more
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          title="More things you can do"
          aria-label="More things you can do"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <Icon path={ICONS.more} />
        </button>
        {moreOpen ? (
          <div className="timeline-v1__more-menu" role="menu" aria-label="More things you can do">
            {OVERFLOW_BUTTONS.map((spec) => actionButton(spec, true))}
          </div>
        ) : null}
      </div>

      <details
        className="timeline-v1__zoom-controls"
        open={!compactZoom || zoomOpen}
        onToggle={(event) => {
          if (compactZoom) setZoomOpen(event.currentTarget.open)
        }}
      >
        <summary aria-label="Timeline Zoom" title="Timeline Zoom">
          <Icon path={ICONS.zoom} />
          <span>Timeline Zoom</span>
        </summary>
        {zoomControls}
      </details>

      <p className="timeline-v1__selection-summary" title={selectedSummary ?? undefined}>
        <span className="timeline-v1__toolbar-duration">{formatTimelineTime(durationTicks, timescale)}</span>
        {busy
          ? ' · edits paused'
          : selectedCount > 1
            ? ` · ${selectedCount} things picked`
            : selectedSummary ? ` · ${selectedSummary}` : ''}
      </p>
    </div>
  )
}
