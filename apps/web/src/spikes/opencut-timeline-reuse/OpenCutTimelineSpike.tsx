import { useMemo, useState } from 'react'
import { effectiveComposition, type EditProject, type TimelineOperation } from '@sanverse/edit-domain'

import { buildSplitAtPlayhead, type IdMaker } from '../../features/timeline/timeline-edits'
import {
  getTimelineZoomMin,
  sliderToZoom,
  timelineTicksToPixels,
} from './opencut-derived-math'
import {
  createOpenCutTimelineSpikeViewModel,
  type OpenCutTimelineSpikeItem,
} from './sanverse-timeline-adapter'

type Props = Readonly<{
  project: EditProject
  onOperation(operation: TimelineOperation): void
  makeOperationId: IdMaker
  makeClipId: IdMaker
}>

const VIEWPORT_WIDTH_PX = 800
const laneColor: Readonly<Record<OpenCutTimelineSpikeItem['kind'], string>> = Object.freeze({
  title: '#d8d8d8',
  video: '#111111',
  caption: '#8e8e8e',
  music: '#525252',
})

export function OpenCutTimelineSpike({
  project,
  onOperation,
  makeOperationId,
  makeClipId,
}: Props) {
  const model = useMemo(() => createOpenCutTimelineSpikeViewModel(project), [project])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [playheadTicks, setPlayheadTicks] = useState(0)
  const [zoomSlider, setZoomSlider] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [notice, setNotice] = useState('')

  const minZoom = getTimelineZoomMin({
    durationTicks: model.durationTicks,
    timescale: model.timescale,
    containerWidth: VIEWPORT_WIDTH_PX,
  })
  const zoomLevel = sliderToZoom({ sliderPosition: zoomSlider, minZoom })
  const contentWidth = Math.max(
    VIEWPORT_WIDTH_PX,
    timelineTicksToPixels({
      ticks: model.durationTicks,
      timescale: model.timescale,
      zoomLevel,
    }),
  )
  const playheadLeft = timelineTicksToPixels({
    ticks: playheadTicks,
    timescale: model.timescale,
    zoomLevel,
  })
  const selectedItem = model.items.find((item) => item.itemId === selectedItemId)

  const split = () => {
    if (!selectedItem || selectedItem.kind !== 'video') {
      setNotice('Select the primary video clip first.')
      return
    }
    const result = buildSplitAtPlayhead(
      effectiveComposition(project),
      playheadTicks,
      makeOperationId,
      makeClipId,
    )
    if (!result.ok) {
      setNotice(result.refusal.reason)
      return
    }
    if (result.operation.kind !== 'split-clip' || result.operation.clipId !== selectedItem.itemId) {
      setNotice('The selected clip and playhead do not refer to the same Sanverse clip.')
      return
    }
    setNotice('')
    onOperation(result.operation)
  }

  return (
    <section aria-label="Disposable OpenCut timeline spike">
      <header>
        <strong>OpenCut interaction spike</strong>
        <span> · Sanverse revision {model.sourceRevision}</span>
      </header>

      <label>
        Timeline zoom
        <input
          aria-label="Timeline zoom"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={zoomSlider}
          onChange={(event) => setZoomSlider(Number(event.currentTarget.value))}
        />
      </label>

      <div>
        {[0, 12, 24].filter((seconds) => seconds * model.timescale <= model.durationTicks).map((seconds) => (
          <button
            key={seconds}
            type="button"
            aria-label={`Seek to ${seconds} seconds`}
            onClick={() => setPlayheadTicks(seconds * model.timescale)}
          >
            {seconds}s
          </button>
        ))}
      </div>

      <div
        data-testid="opencut-spike-viewport"
        data-scroll-left={scrollLeft}
        onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
        style={{ width: VIEWPORT_WIDTH_PX, maxWidth: '100%', overflowX: 'auto' }}
      >
        <div style={{ width: contentWidth, position: 'relative', paddingTop: 18 }}>
          <div
            data-testid="opencut-spike-playhead"
            data-playhead-seconds={playheadTicks / model.timescale}
            style={{
              position: 'absolute',
              left: playheadLeft,
              top: 0,
              bottom: 0,
              width: 2,
              background: '#000',
              pointerEvents: 'none',
            }}
          />
          {model.items.map((item) => {
            const left = timelineTicksToPixels({
              ticks: item.startTicks,
              timescale: model.timescale,
              zoomLevel,
            })
            const width = Math.max(24, timelineTicksToPixels({
              ticks: item.durationTicks,
              timescale: model.timescale,
              zoomLevel,
            }))
            return (
              <div key={item.itemId} style={{ height: 34, position: 'relative' }}>
                <button
                  type="button"
                  aria-label={`Select ${item.kind === 'video' ? 'primary video clip' : item.label}`}
                  aria-pressed={selectedItemId === item.itemId}
                  onClick={() => setSelectedItemId(item.itemId)}
                  style={{
                    position: 'absolute',
                    left,
                    width,
                    height: 28,
                    overflow: 'hidden',
                    color: item.kind === 'title' ? '#111' : '#fff',
                    background: laneColor[item.kind],
                    border: selectedItemId === item.itemId ? '2px solid #000' : '1px solid #777',
                    textAlign: 'left',
                  }}
                >
                  {item.label}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <button type="button" aria-label="Split selected clip at playhead" onClick={split}>
        Split selected clip at playhead
      </button>
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  )
}
