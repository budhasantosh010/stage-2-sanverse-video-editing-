import { useState } from 'react'

import {
  CALLOUT_PRIMITIVE_ID,
  MEDIA_OVERLAY_PRIMITIVE_ID,
  MUSIC_PRIMITIVE_ID,
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  TITLE_PRIMITIVE_ID,
  type EditOperation,
  type EditProject,
  type ResolvedOverlayOperation,
} from '@sanverse/edit-domain'

import { sourceMomentAt } from './AddOverlayPanel'
import './OverlayRepairPanel.css'

export type OverlayRepairPanelProps = {
  editProject: EditProject
  item: ResolvedOverlayOperation
  playheadMs: number
  busy: boolean
  onRepair(operation: EditOperation): Promise<string | null>
}

const time = (ticks: number) => ({ ticks, timescale: 1_440_000 as const })
const seconds = (ticks: number) => ticks / PROJECT_TIMESCALE
const ticks = (value: number) => Math.round(value * PROJECT_TIMESCALE)

const operationId = () => {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return `operation_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

const labelFor = (item: ResolvedOverlayOperation) => ({
  'add-title': 'title',
  'add-callout': 'callout',
  'add-media-overlay': 'clip or picture',
  'add-music': 'music',
})[item.kind]

export function OverlayRepairPanel({
  editProject,
  item,
  playheadMs,
  busy,
  onRepair,
}: OverlayRepairPanelProps) {
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [headline, setHeadline] = useState(item.kind === 'add-title' ? item.headline : '')
  const [subhead, setSubhead] = useState(item.kind === 'add-title' ? item.subhead : '')
  const [label, setLabel] = useState(item.kind === 'add-callout' ? item.label : '')
  const [duration, setDuration] = useState(
    item.kind === 'add-music' ? 0 : seconds(item.sourceInterval.duration.ticks),
  )
  const [gainDb, setGainDb] = useState(item.kind === 'add-music' ? item.gainDb : -18)
  const [fadeIn, setFadeIn] = useState(item.kind === 'add-music' ? seconds(item.fadeIn.ticks) : 0)
  const [fadeOut, setFadeOut] = useState(item.kind === 'add-music' ? seconds(item.fadeOut.ticks) : 0)
  const [x, setX] = useState(item.kind === 'add-callout' || item.kind === 'add-media-overlay' ? item.region.x : 0)
  const [y, setY] = useState(item.kind === 'add-callout' || item.kind === 'add-media-overlay' ? item.region.y : 0)
  const [width, setWidth] = useState(item.kind === 'add-callout' || item.kind === 'add-media-overlay' ? item.region.width : 0)
  const [height, setHeight] = useState(item.kind === 'add-callout' || item.kind === 'add-media-overlay' ? item.region.height : 0)
  const [opacity, setOpacity] = useState(item.kind === 'add-media-overlay' ? item.opacity : 1)
  const [useOverlayAudio, setUseOverlayAudio] = useState(
    item.kind === 'add-media-overlay' ? item.useOverlayAudio : false,
  )
  const [sourceStart, setSourceStart] = useState(
    item.kind === 'add-music' ? 0 : item.sourceInterval.start.ticks,
  )
  const [sourceAssetId, setSourceAssetId] = useState(
    item.kind === 'add-music' ? '' : item.assetId,
  )

  const moveToPlayhead = () => {
    if (item.kind === 'add-music') return
    const moment = sourceMomentAt(editProject, playheadMs)
    if (!moment) {
      setNotice('Move the playhead onto footage first.')
      return
    }
    setSourceAssetId(moment.assetId)
    setSourceStart(moment.startTicks)
    setNotice('This will now start at the playhead.')
  }

  const submit = async () => {
    setNotice(null)
    let repair: EditOperation
    const common = {
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: operationId(),
      extensions: {},
    } as const

    if (item.kind === 'add-title') {
      repair = {
        ...item,
        ...common,
        kind: 'set-title',
        capabilityId: TITLE_PRIMITIVE_ID,
        assetId: sourceAssetId,
        sourceInterval: { start: time(sourceStart), duration: time(ticks(duration)) },
        headline: headline.trim(),
        subhead: subhead.trim(),
      }
    } else if (item.kind === 'add-callout') {
      repair = {
        ...item,
        ...common,
        kind: 'set-callout',
        capabilityId: CALLOUT_PRIMITIVE_ID,
        assetId: sourceAssetId,
        sourceInterval: { start: time(sourceStart), duration: time(ticks(duration)) },
        region: { coordinateSpace: 'composition-normalized', x, y, width, height },
        label: label.trim(),
      }
    } else if (item.kind === 'add-media-overlay') {
      repair = {
        ...item,
        ...common,
        kind: 'set-media-overlay',
        capabilityId: MEDIA_OVERLAY_PRIMITIVE_ID,
        assetId: sourceAssetId,
        sourceInterval: { start: time(sourceStart), duration: time(ticks(duration)) },
        region: { coordinateSpace: 'composition-normalized', x, y, width, height },
        opacity,
        useOverlayAudio,
      }
    } else {
      repair = {
        ...item,
        ...common,
        kind: 'set-music',
        capabilityId: MUSIC_PRIMITIVE_ID,
        gainDb,
        fadeIn: time(ticks(fadeIn)),
        fadeOut: time(ticks(fadeOut)),
      }
    }

    setWorking(true)
    const failure = await onRepair(repair)
    setWorking(false)
    if (failure) {
      setNotice(failure)
      return
    }
    setNotice('Saved. Undo takes back only this change.')
    setOpen(false)
  }

  const family = labelFor(item)
  if (!open) {
    return (
      <div className="overlay-repair">
        <span>{family}</span>
        <button type="button" disabled={busy} onClick={() => setOpen(true)}>
          Adjust {family}
        </button>
        {notice ? <p role="status">{notice}</p> : null}
      </div>
    )
  }

  return (
    <section className="overlay-repair overlay-repair--open" aria-label={`Adjust ${family}`}>
      {item.kind === 'add-title' ? (
        <>
          <label>Main words<input aria-label="Main words" value={headline} maxLength={60} onChange={(event) => setHeadline(event.currentTarget.value)} /></label>
          <label>Smaller line<input value={subhead} maxLength={90} onChange={(event) => setSubhead(event.currentTarget.value)} /></label>
        </>
      ) : null}
      {item.kind === 'add-callout' ? (
        <label>Label<input value={label} maxLength={60} onChange={(event) => setLabel(event.currentTarget.value)} /></label>
      ) : null}
      {item.kind !== 'add-music' ? (
        <>
          <label>Visible for (seconds)<input type="number" min={1} max={30} value={duration} onChange={(event) => setDuration(Number(event.currentTarget.value))} /></label>
          <button type="button" onClick={moveToPlayhead}>Start at the playhead</button>
        </>
      ) : null}
      {item.kind === 'add-callout' || item.kind === 'add-media-overlay' ? (
        <div className="overlay-repair__region">
          <label>Left<input type="number" min={0} max={1} step={0.01} value={x} onChange={(event) => setX(Number(event.currentTarget.value))} /></label>
          <label>Top<input type="number" min={0} max={1} step={0.01} value={y} onChange={(event) => setY(Number(event.currentTarget.value))} /></label>
          <label>Width<input type="number" min={0.01} max={1} step={0.01} value={width} onChange={(event) => setWidth(Number(event.currentTarget.value))} /></label>
          <label>Height<input type="number" min={0.01} max={1} step={0.01} value={height} onChange={(event) => setHeight(Number(event.currentTarget.value))} /></label>
        </div>
      ) : null}
      {item.kind === 'add-media-overlay' ? (
        <>
          <label>Opacity<input type="number" min={0.01} max={1} step={0.05} value={opacity} onChange={(event) => setOpacity(Number(event.currentTarget.value))} /></label>
          <label><input type="checkbox" checked={useOverlayAudio} onChange={(event) => setUseOverlayAudio(event.currentTarget.checked)} />Hear this clip too</label>
        </>
      ) : null}
      {item.kind === 'add-music' ? (
        <>
          <label>Music level in dB<input aria-label="Music level in dB" type="number" min={-60} max={12} value={gainDb} onChange={(event) => setGainDb(Number(event.currentTarget.value))} /></label>
          <label>Fade in (seconds)<input type="number" min={0} value={fadeIn} onChange={(event) => setFadeIn(Number(event.currentTarget.value))} /></label>
          <label>Fade out (seconds)<input type="number" min={0} value={fadeOut} onChange={(event) => setFadeOut(Number(event.currentTarget.value))} /></label>
        </>
      ) : null}
      <div className="overlay-repair__actions">
        <button type="button" disabled={busy || working} onClick={() => void submit()}>
          Save {family} changes
        </button>
        <button type="button" disabled={working} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  )
}
