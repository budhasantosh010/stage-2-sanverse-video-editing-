import { useState } from 'react'

import {
  CALLOUT_COMPONENT_ID,
  DEFAULT_CALLOUT_STYLE_ID,
  DEFAULT_MUSIC_GAIN_DB,
  DEFAULT_TITLE_STYLE_ID,
  MEDIA_OVERLAY_COMPONENT_ID,
  MUSIC_COMPONENT_ID,
  OPERATION_SCHEMA_VERSION,
  TITLE_COMPONENT_ID,
  clipAtCompositionTime,
  clipTimeToSource,
  compositionTimeToClip,
  effectiveComposition,
  type EditOperation,
  type EditProject,
  type MediaAsset,
} from '@sanverse/edit-domain'

import './AddOverlayPanel.css'

/**
 * The one place a user adds anything to their video that is not a cut.
 *
 * PROGRESSIVE DISCLOSURE (G5C-08). Five families of controls shown at once is
 * an aeroplane cockpit, and the product standard is that no editing knowledge
 * should be required. So the screen shows:
 *
 *     one button          "Add to your video"
 *          ↓
 *     four plain choices  a title · point something out · another clip · music
 *          ↓
 *     ONE short form      only the fields that choice actually needs
 *
 * At no point are more than about four things visible. Nothing is hidden that
 * the user needs — it is one click away and labelled in words they would use.
 */

export type OverlayFamily = 'title' | 'callout' | 'broll' | 'music'

const FAMILY_LABELS: Readonly<Record<OverlayFamily, { label: string; hint: string }>> = Object.freeze({
  title: { label: 'A title', hint: 'Big words over the picture.' },
  callout: { label: 'Point something out', hint: 'A box around part of the picture.' },
  broll: { label: 'Another clip or picture', hint: 'Shown on top while you talk.' },
  music: { label: 'Music', hint: 'Playing quietly under the whole video.' },
})

export type AddOverlayPanelProps = {
  editProject: EditProject
  /** Where the finished video is currently paused, in milliseconds. */
  playheadMs: number
  busy: boolean
  /** Accept one new edit. Resolves to a plain sentence on failure, null on success. */
  onCreate(operation: EditOperation): Promise<string | null>
  /** Upload one extra file. Resolves to the asset it became, or a sentence. */
  onUploadAsset(file: File): Promise<MediaAsset | string>
}

const TICKS_PER_MS = 1_440

const randomId = (prefix: string): string => {
  // Long enough that two edits made in the same second cannot collide, and
  // built from the browser's own randomness rather than from a counter that
  // would restart when the page reloads.
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return `${prefix}${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Turn "where the finished video is paused" into "which moment of the original
 * footage that is".
 *
 * Every overlay except music is pinned to the footage (ADR-005), so this
 * conversion has to happen before an edit can be written down. It returns null
 * when the playhead is sitting in a deliberate hole, where there is no footage
 * to pin anything to.
 */
const sourceMomentAt = (
  project: EditProject,
  playheadMs: number,
): { assetId: string; startTicks: number; remainingTicks: number } | null => {
  const composition = effectiveComposition(project)
  const ticks = Math.round(playheadMs * TICKS_PER_MS)
  const clip = clipAtCompositionTime(composition, { ticks, timescale: 1_440_000 })
  if (!clip) return null
  const clipTime = compositionTimeToClip(clip, { ticks, timescale: 1_440_000 })
  const sourceTime = clipTimeToSource(clip, clipTime)
  const remaining = clip.sourceRange.start.ticks + clip.sourceRange.duration.ticks - sourceTime.ticks
  return { assetId: clip.assetId, startTicks: sourceTime.ticks, remainingTicks: remaining }
}

const time = (ticks: number) => ({ ticks, timescale: 1_440_000 as const })

export function AddOverlayPanel({
  editProject,
  playheadMs,
  busy,
  onCreate,
  onUploadAsset,
}: AddOverlayPanelProps) {
  const [open, setOpen] = useState(false)
  const [family, setFamily] = useState<OverlayFamily | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const [headline, setHeadline] = useState('')
  const [subhead, setSubhead] = useState('')
  const [placement, setPlacement] = useState<'center' | 'lower-third'>('center')
  const [label, setLabel] = useState('')
  const [seconds, setSeconds] = useState(3)

  const disabled = busy || working

  const reset = () => {
    setFamily(null)
    setHeadline('')
    setSubhead('')
    setLabel('')
    setSeconds(3)
  }

  const submit = async (build: () => EditOperation | string) => {
    setNotice(null)
    const built = build()
    if (typeof built === 'string') {
      setNotice(built)
      return
    }
    setWorking(true)
    const failure = await onCreate(built)
    setWorking(false)
    if (failure) {
      setNotice(failure)
      return
    }
    reset()
    setOpen(false)
  }

  /** The moment on the footage, and how much of it is left, or a sentence. */
  const anchored = (): { assetId: string; startTicks: number; durationTicks: number } | string => {
    const moment = sourceMomentAt(editProject, playheadMs)
    if (!moment) return 'Move the playhead onto a part of the video that still has footage.'
    const wanted = Math.round(seconds * 1_440_000)
    if (moment.remainingTicks < 1_440_000) return 'There is less than a second of video left here. Choose an earlier moment.'
    return {
      assetId: moment.assetId,
      startTicks: moment.startTicks,
      // Shortened to what is actually left rather than refused, so a title
      // asked for near the end still appears — just for as long as there is
      // video to show it over.
      durationTicks: Math.min(wanted, moment.remainingTicks),
    }
  }

  const uploadThen = async (file: File, build: (asset: MediaAsset) => EditOperation | string) => {
    setNotice(null)
    setWorking(true)
    const uploaded = await onUploadAsset(file)
    if (typeof uploaded === 'string') {
      setWorking(false)
      setNotice(uploaded)
      return
    }
    const built = build(uploaded)
    if (typeof built === 'string') {
      setWorking(false)
      setNotice(built)
      return
    }
    const failure = await onCreate(built)
    setWorking(false)
    if (failure) {
      setNotice(failure)
      return
    }
    reset()
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="add-overlay">
        <button
          type="button"
          className="add-overlay__open"
          data-testid="add-overlay-open"
          disabled={disabled}
          onClick={() => { setOpen(true); setNotice(null) }}
        >
          Add to your video
        </button>
      </div>
    )
  }

  return (
    <div className="add-overlay add-overlay--open">
      <div className="add-overlay__header">
        <h3>Add to your video</h3>
        <button
          type="button"
          className="add-overlay__close"
          data-testid="add-overlay-close"
          onClick={() => { setOpen(false); reset(); setNotice(null) }}
        >
          Close
        </button>
      </div>

      {family === null ? (
        <ul className="add-overlay__choices">
          {(Object.keys(FAMILY_LABELS) as OverlayFamily[]).map((key) => (
            <li key={key}>
              <button
                type="button"
                data-testid={`add-overlay-choose-${key}`}
                disabled={disabled}
                onClick={() => { setFamily(key); setNotice(null) }}
              >
                <span className="add-overlay__choice-label">{FAMILY_LABELS[key].label}</span>
                <span className="add-overlay__choice-hint">{FAMILY_LABELS[key].hint}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="add-overlay__form">
          <button type="button" className="add-overlay__back" onClick={() => { reset(); setNotice(null) }}>
            ← Choose something else
          </button>

          {family === 'title' ? (
            <>
              <label>
                <span>What should it say?</span>
                <input
                  value={headline}
                  data-testid="title-headline"
                  maxLength={60}
                  onChange={(event) => setHeadline(event.currentTarget.value)}
                />
              </label>
              <label>
                <span>A smaller second line (optional)</span>
                <input
                  value={subhead}
                  data-testid="title-subhead"
                  maxLength={90}
                  onChange={(event) => setSubhead(event.currentTarget.value)}
                />
              </label>
              <label>
                <span>Where</span>
                <select
                  value={placement}
                  data-testid="title-placement"
                  onChange={(event) => setPlacement(event.currentTarget.value as 'center' | 'lower-third')}
                >
                  <option value="center">In the middle</option>
                  <option value="lower-third">Near the bottom</option>
                </select>
              </label>
              <SecondsField seconds={seconds} onChange={setSeconds} />
              <button
                type="button"
                className="add-overlay__submit"
                data-testid="title-submit"
                disabled={disabled || headline.trim().length === 0}
                onClick={() => void submit(() => {
                  const where = anchored()
                  if (typeof where === 'string') return where
                  return {
                    schemaVersion: OPERATION_SCHEMA_VERSION,
                    operationId: randomId('operation_'),
                    kind: 'add-title',
                    capabilityId: TITLE_COMPONENT_ID,
                    titleId: randomId('title_'),
                    assetId: where.assetId,
                    sourceInterval: { start: time(where.startTicks), duration: time(where.durationTicks) },
                    headline: headline.trim(),
                    subhead: subhead.trim(),
                    placement,
                    styleId: DEFAULT_TITLE_STYLE_ID,
                    extensions: {},
                  } as EditOperation
                })}
              >
                Add the title
              </button>
            </>
          ) : null}

          {family === 'callout' ? (
            <>
              <p className="add-overlay__note">
                A box appears over the middle-right of the picture. You will be able to
                move it once dragging arrives; for now it starts in a sensible place.
              </p>
              <label>
                <span>Label (optional)</span>
                <input
                  value={label}
                  data-testid="callout-label"
                  maxLength={60}
                  onChange={(event) => setLabel(event.currentTarget.value)}
                />
              </label>
              <SecondsField seconds={seconds} onChange={setSeconds} />
              <button
                type="button"
                className="add-overlay__submit"
                data-testid="callout-submit"
                disabled={disabled}
                onClick={() => void submit(() => {
                  const where = anchored()
                  if (typeof where === 'string') return where
                  return {
                    schemaVersion: OPERATION_SCHEMA_VERSION,
                    operationId: randomId('operation_'),
                    kind: 'add-callout',
                    capabilityId: CALLOUT_COMPONENT_ID,
                    calloutId: randomId('callout_'),
                    assetId: where.assetId,
                    sourceInterval: { start: time(where.startTicks), duration: time(where.durationTicks) },
                    region: { coordinateSpace: 'composition-normalized', x: 0.55, y: 0.25, width: 0.3, height: 0.3 },
                    label: label.trim(),
                    styleId: DEFAULT_CALLOUT_STYLE_ID,
                    extensions: {},
                  } as EditOperation
                })}
              >
                Draw the box
              </button>
            </>
          ) : null}

          {family === 'broll' ? (
            <>
              <p className="add-overlay__note">
                Choose a video or a picture. It appears in the top-left quarter of the
                screen from where you are paused. Nothing is sent anywhere.
              </p>
              <SecondsField seconds={seconds} onChange={setSeconds} />
              <label className="add-overlay__file">
                <span>Choose a clip or picture</span>
                <input
                  type="file"
                  data-testid="broll-file"
                  accept="video/*,image/*"
                  disabled={disabled}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ''
                    if (!file) return
                    void uploadThen(file, (asset) => {
                      if (asset.mediaKind === 'audio') return 'That is a piece of music. Choose “Music” instead.'
                      const where = anchored()
                      if (typeof where === 'string') return where
                      // A clip shorter than the stretch asked for would be
                      // refused by the domain, so the ask is trimmed to what
                      // the clip actually holds before it is ever sent.
                      const available = asset.mediaKind === 'video' ? asset.duration.ticks : where.durationTicks
                      const duration = Math.min(where.durationTicks, available)
                      if (duration < 1_440_000) return 'That clip is too short to show. Choose a longer one.'
                      return {
                        schemaVersion: OPERATION_SCHEMA_VERSION,
                        operationId: randomId('operation_'),
                        kind: 'add-media-overlay',
                        capabilityId: MEDIA_OVERLAY_COMPONENT_ID,
                        overlayId: randomId('broll_'),
                        overlayAssetId: asset.assetId,
                        assetId: where.assetId,
                        sourceInterval: { start: time(where.startTicks), duration: time(duration) },
                        overlaySourceStart: time(0),
                        region: { coordinateSpace: 'composition-normalized', x: 0.04, y: 0.06, width: 0.42, height: 0.42 },
                        opacity: 1,
                        useOverlayAudio: false,
                        extensions: {},
                      } as EditOperation
                    })
                  }}
                />
              </label>
            </>
          ) : null}

          {family === 'music' ? (
            <>
              <p className="add-overlay__note">
                Music plays under the whole video, quietly enough to talk over. It keeps
                playing straight through any cut you make.
              </p>
              <label className="add-overlay__file">
                <span>Choose a piece of music</span>
                <input
                  type="file"
                  data-testid="music-file"
                  accept="audio/*"
                  disabled={disabled}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ''
                    if (!file) return
                    void uploadThen(file, (asset) => {
                      if (asset.mediaKind !== 'audio') return 'That is not a piece of music. Choose “Another clip or picture” instead.'
                      return {
                        schemaVersion: OPERATION_SCHEMA_VERSION,
                        operationId: randomId('operation_'),
                        kind: 'add-music',
                        capabilityId: MUSIC_COMPONENT_ID,
                        musicId: randomId('music_'),
                        assetId: asset.assetId,
                        compositionStart: time(0),
                        sourceStart: time(0),
                        gainDb: DEFAULT_MUSIC_GAIN_DB,
                        fadeIn: time(1_440_000),
                        fadeOut: time(2 * 1_440_000),
                        extensions: {},
                      } as EditOperation
                    })
                  }}
                />
              </label>
            </>
          ) : null}
        </div>
      )}

      {notice ? (
        <p className="add-overlay__notice" role="status" data-testid="add-overlay-notice">
          {notice}
        </p>
      ) : null}
    </div>
  )
}

function SecondsField({ seconds, onChange }: { seconds: number; onChange(value: number): void }) {
  return (
    <label>
      <span>How long, in seconds</span>
      <input
        type="number"
        min={1}
        max={30}
        step={1}
        value={seconds}
        data-testid="overlay-seconds"
        onChange={(event) => {
          const parsed = Number(event.currentTarget.value)
          if (Number.isFinite(parsed)) onChange(Math.min(30, Math.max(1, Math.round(parsed))))
        }}
      />
    </label>
  )
}
