import { useEffect, useMemo, useRef, useState } from 'react'

import {
  parsePrecisionTimeInput,
  resolvePrecisionTimeInput,
  type PrecisionFrameRateV1,
  type TimelineEditPointRefV1,
  type TimelineItemView,
  type TimelinePrecisionToolV1,
} from '../../features/timeline'
import { formatTimelineTime } from './timeline-ruler-model'

export type NumericPrecisionIntentV1 = Readonly<{
  field: 'composition-start' | 'composition-end' | 'source-in' | 'trim-delta'
  resolvedTicks: number
  relative: boolean
}>

export type TimelinePrecisionPopoverProps = Readonly<{
  item: TimelineItemView | null
  editPoint: TimelineEditPointRefV1 | null
  precisionTool: TimelinePrecisionToolV1
  timescale: number
  durationTicks: number
  frameRate: PrecisionFrameRateV1
  busy: boolean
  onApply(intent: NumericPrecisionIntentV1): string | null
}>

const sourceValue = (ticks: number | null, timescale: number): string =>
  ticks === null ? '—' : formatTimelineTime(ticks, timescale, true)

export function TimelinePrecisionPopover({
  item,
  editPoint,
  precisionTool,
  timescale,
  durationTicks,
  frameRate,
  busy,
  onApply,
}: TimelinePrecisionPopoverProps) {
  const [open, setOpen] = useState(false)
  const [field, setField] = useState<NumericPrecisionIntentV1['field']>('trim-delta')
  const [text, setText] = useState('+1f')
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      rootRef.current?.querySelector<HTMLButtonElement>('[data-precision-popover-trigger]')?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => { setError(null) }, [field, item?.id, editPoint?.compositionTicks, precisionTool])

  const baseTicks = useMemo(() => {
    if (field === 'composition-start') return item?.startTicks ?? 0
    if (field === 'composition-end') return item ? item.startTicks + item.durationTicks : 0
    if (field === 'source-in') return item?.sourceStartTicks ?? 0
    return editPoint?.compositionTicks ?? item?.startTicks ?? 0
  }, [editPoint?.compositionTicks, field, item])

  const available = item !== null || editPoint !== null
  const allowedFields: readonly NumericPrecisionIntentV1['field'][] = precisionTool === 'roll'
    ? Object.freeze(['trim-delta'])
    : precisionTool === 'slip'
      ? Object.freeze(['trim-delta'])
      : precisionTool === 'slide'
        ? Object.freeze(['composition-start', 'trim-delta'])
        : Object.freeze(['composition-start', 'composition-end', 'trim-delta'])

  const apply = () => {
    if (!available) return
    const parsed = field === 'trim-delta'
      ? parsePrecisionTimeInput({ text, timescale, frameRate })
      : resolvePrecisionTimeInput({
          text,
          baseTicks,
          minTicks: field === 'source-in' ? 0 : 0,
          maxTicks: field === 'source-in'
            ? Math.max(item?.sourceStartTicks ?? 0, (item?.sourceStartTicks ?? 0) + (item?.sourceDurationTicks ?? 0) + durationTicks)
            : durationTicks,
          timescale,
          frameRate,
        })
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    if (field === 'trim-delta' && !parsed.relative) {
      setError('Trim Delta needs a relative value such as +12f, -8f, or +00:00:01:00.')
      return
    }
    const failure = onApply(Object.freeze({ field, resolvedTicks: parsed.ticks, relative: parsed.relative }))
    if (failure) {
      setError(failure)
      return
    }
    setError(null)
    setOpen(false)
  }

  return (
    <div className="timeline-v1__precision-popover" ref={rootRef}>
      <button
        type="button"
        className="timeline-v1__precision-status-button"
        data-precision-popover-trigger
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!available || busy || precisionTool === 'rate-stretch'}
        title={available ? 'Enter frame-accurate trim values.' : 'Select a clip or Roll edit point first.'}
        onClick={() => setOpen((value) => !value)}
      >
        Numeric Precision
      </button>
      {open ? (
        <div className="timeline-v1__precision-popover-card" role="dialog" aria-label="Numeric precision">
          <dl className="timeline-v1__precision-readout">
            <div><dt>Composition Start</dt><dd>{item ? formatTimelineTime(item.startTicks, timescale, true) : '—'}</dd></div>
            <div><dt>Composition End</dt><dd>{item ? formatTimelineTime(item.startTicks + item.durationTicks, timescale, true) : '—'}</dd></div>
            <div><dt>Duration</dt><dd>{item ? formatTimelineTime(item.durationTicks, timescale, true) : '—'}</dd></div>
            <div><dt>Source In</dt><dd>{sourceValue(item?.sourceStartTicks ?? null, timescale)}</dd></div>
            <div><dt>Source Out</dt><dd>{item?.sourceStartTicks !== null && item?.sourceStartTicks !== undefined && item?.sourceDurationTicks !== null && item?.sourceDurationTicks !== undefined ? sourceValue(item.sourceStartTicks + item.sourceDurationTicks, timescale) : '—'}</dd></div>
            <div><dt>Source Duration</dt><dd>{sourceValue(item?.sourceDurationTicks ?? null, timescale)}</dd></div>
            <div><dt>Speed</dt><dd>{item?.speedBadge ?? '1x'}</dd></div>
          </dl>
          <label>
            Field
            <select value={field} onChange={(event) => setField(event.target.value as NumericPrecisionIntentV1['field'])}>
              {allowedFields.map((value) => <option key={value} value={value}>{value.replaceAll('-', ' ')}</option>)}
            </select>
          </label>
          <label>
            Exact value
            <input
              value={text}
              aria-label="Numeric precision value"
              placeholder={field === 'trim-delta' ? '+12f or -00:00:01:00' : '00:01:13:12 or +12f'}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  apply()
                }
              }}
            />
          </label>
          <p className="timeline-v1__precision-hint">Project clock: {frameRate.numerator}/{frameRate.denominator} fps · integer ticks only.</p>
          {error ? <p className="timeline-v1__precision-error" role="alert">{error}</p> : null}
          <div className="timeline-v1__precision-popover-actions">
            <button type="button" onClick={apply} disabled={busy}>Apply</button>
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
