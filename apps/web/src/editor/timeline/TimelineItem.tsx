import { useState, type MouseEvent } from 'react'

import {
  ticksToPixels,
  type TimelineGesture,
  type TimelineItemView,
  type TimelineLaneKind,
} from '../../features/timeline'
import { formatTimelineTime } from './timeline-ruler-model'
import type { TimelineSnapResult } from './timeline-snap'
import { TimelineTrimHandle } from './TimelineTrimHandle'

export type TimelineItemProps = Readonly<{
  item: TimelineItemView
  laneKind: TimelineLaneKind
  timescale: number
  pixelsPerSecond: number
  busy: boolean
  pointerTicks(clientX: number): number
  pointerTime(clientX: number, excludedTicks?: readonly number[]): TimelineSnapResult
  onSnapGuide(ticks: number | null): void
  onSelect(itemId: string): void
  onSeek(ticks: number): void
  onGesture(gesture: TimelineGesture): void
  onOpenProposal(): void
  onContextMenu(item: TimelineItemView, clientX: number, clientY: number): void
}>

const itemStateLabel = (item: TimelineItemView): string => {
  if (item.state === 'proposed') return 'Proposed'
  if (item.state === 'blocked') return 'Needs attention'
  if (!item.enabled) return 'Hidden'
  return 'Committed'
}

const itemAccessibleLabel = (item: TimelineItemView, timescale: number): string => {
  const kind = item.kind.replace('-', ' ')
  const start = formatTimelineTime(item.startTicks, timescale, true)
  const duration = formatTimelineTime(item.durationTicks, timescale, true)
  const detail = item.detail ? `, ${item.detail}` : ''
  return `${kind}, ${item.label}${detail}, starts ${start}, duration ${duration}, ${itemStateLabel(item)}`
}

export function TimelineItem({
  item,
  laneKind,
  timescale,
  pixelsPerSecond,
  busy,
  pointerTicks,
  pointerTime,
  onSnapGuide,
  onSelect,
  onSeek,
  onGesture,
  onOpenProposal,
  onContextMenu,
}: TimelineItemProps) {
  const [trimPreview, setTrimPreview] = useState<Readonly<{ edge: 'start' | 'end'; deltaTicks: number }> | null>(null)
  const canonicalLeftPx = ticksToPixels(item.startTicks, timescale, pixelsPerSecond)
  const canonicalWidthPx = ticksToPixels(item.durationTicks, timescale, pixelsPerSecond)
  const previewStartTicks = trimPreview?.edge === 'start'
    ? item.startTicks + trimPreview.deltaTicks
    : item.startTicks
  const previewDurationTicks = trimPreview
    ? item.durationTicks - trimPreview.deltaTicks
    : item.durationTicks
  const leftPx = trimPreview?.edge === 'start'
    ? ticksToPixels(previewStartTicks, timescale, pixelsPerSecond)
    : canonicalLeftPx
  const widthPx = ticksToPixels(previewDurationTicks, timescale, pixelsPerSecond)
  const canTrim = item.kind === 'clip' && item.state === 'committed' && item.clipId !== null && item.selected

  const selectAndSeek = (event?: MouseEvent<HTMLButtonElement>) => {
    onSelect(item.id)
    if (event) {
      onSeek(pointerTicks(event.clientX))
    } else {
      onSeek(Math.min(
        item.startTicks + Math.max(1, Math.floor(item.durationTicks / 2)),
        item.startTicks + item.durationTicks - 1,
      ))
    }
    if (item.state === 'proposed') onOpenProposal()
  }

  return (
    <div
      className={[
        'timeline-v1__item-shell',
        trimPreview ? 'timeline-v1__item-shell--trimming' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: `${leftPx}px`, width: `${Math.max(2, widthPx)}px` }}
      data-testid="timeline-item-shell"
      data-item-id={item.id}
      data-canonical-left={canonicalLeftPx}
      data-canonical-width={canonicalWidthPx}
    >
      <button
        type="button"
        className={[
          'timeline-v1__item',
          `timeline-v1__item--${item.kind}`,
          `timeline-v1__item--lane-${laneKind}`,
          `timeline-v1__item--${item.state}`,
          item.selected ? 'timeline-v1__item--selected' : '',
          item.enabled ? '' : 'timeline-v1__item--disabled',
        ].filter(Boolean).join(' ')}
        aria-label={itemAccessibleLabel(item, timescale)}
        aria-selected={item.selected}
        title={itemAccessibleLabel(item, timescale)}
        data-testid="timeline-item"
        data-state={item.state}
        data-kind={item.kind}
        data-lane-kind={laneKind}
        onClick={selectAndSeek}
        onContextMenu={(event) => {
          event.preventDefault()
          onSelect(item.id)
          onContextMenu(item, event.clientX, event.clientY)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            selectAndSeek()
          }
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            onSelect(item.id)
            onContextMenu(item, rect.left + rect.width / 2, rect.top + rect.height / 2)
          }
        }}
      >
        <span className="timeline-v1__item-label">{item.label}</span>
        <span className="timeline-v1__item-state">{itemStateLabel(item)}</span>
        {item.blockedReason ? <span className="timeline-v1__item-warning">Needs attention</span> : null}
      </button>

      {canTrim ? (
        <>
          <TimelineTrimHandle
            edge="start"
            disabled={busy}
            itemStartTicks={item.startTicks}
            itemDurationTicks={item.durationTicks}
            pointerTime={pointerTime}
            onSnapGuide={onSnapGuide}
            onPreview={(deltaTicks) => setTrimPreview(deltaTicks === null ? null : { edge: 'start', deltaTicks })}
            onCommit={(deltaTicks) => onGesture({ type: 'trim-start', clipId: item.clipId as string, deltaTicks })}
          />
          <TimelineTrimHandle
            edge="end"
            disabled={busy}
            itemStartTicks={item.startTicks}
            itemDurationTicks={item.durationTicks}
            pointerTime={pointerTime}
            onSnapGuide={onSnapGuide}
            onPreview={(deltaTicks) => setTrimPreview(deltaTicks === null ? null : { edge: 'end', deltaTicks })}
            onCommit={(deltaTicks) => onGesture({ type: 'trim-end', clipId: item.clipId as string, deltaTicks })}
          />
        </>
      ) : null}

      {trimPreview ? (
        <output className="timeline-v1__trim-tooltip" aria-live="polite">
          Start {formatTimelineTime(previewStartTicks, timescale, true)} · Duration {formatTimelineTime(previewDurationTicks, timescale, true)}
        </output>
      ) : null}
    </div>
  )
}
