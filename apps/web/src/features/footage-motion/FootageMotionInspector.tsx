import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  DEFAULT_FOOTAGE_MOTION_STATE,
  FOOTAGE_MOTION_CAPABILITY_ID,
  evaluateFootageMotionAt,
  mediaTime,
  type MediaTime,
  type SetFootageMotionOperation,
  type TimeRange,
  type VisualCrop,
  type VisualEasing,
  type VisualProperty,
  type VisualPropertyTrack,
  type VisualTransform,
} from '@sanverse/edit-domain'

import './FootageMotionInspector.css'

export type FootageMotionDraft = Readonly<{
  motionId: string
  assetId: string
  sourceInterval: TimeRange
  transform: VisualTransform
  crop: VisualCrop
  tracks: readonly VisualPropertyTrack[]
}>

export type SupportedFootageMotionProperty = Exclude<VisualProperty, 'opacity'>
type SupportedProperty = SupportedFootageMotionProperty
type EasingChoice = 'linear' | 'smooth' | 'spring' | 'bounce'

export type FootageMotionInspectorProps = Readonly<{
  draft: FootageMotionDraft
  accepted: SetFootageMotionOperation | null
  sourceTime: MediaTime | null
  busy: boolean
  setDraft: Dispatch<SetStateAction<FootageMotionDraft | null>>
  onApply(operation: SetFootageMotionOperation): Promise<string | null>
  onSeekSourceTime(sourceTime: MediaTime): void
}>

const PROPERTY_OPTIONS: readonly Readonly<{ value: SupportedProperty; label: string }>[] = Object.freeze([
  { value: 'scale', label: 'Scale' },
  { value: 'translate-x', label: 'Position X' },
  { value: 'translate-y', label: 'Position Y' },
  { value: 'rotation', label: 'Rotation' },
  { value: 'crop-top', label: 'Crop top' },
  { value: 'crop-right', label: 'Crop right' },
  { value: 'crop-bottom', label: 'Crop bottom' },
  { value: 'crop-left', label: 'Crop left' },
])

const easingFor = (choice: EasingChoice): VisualEasing => {
  switch (choice) {
    case 'smooth':
      return Object.freeze({ kind: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 })
    case 'spring':
      return Object.freeze({ kind: 'spring', mass: 1, stiffness: 180, damping: 18, velocity: 0 })
    case 'bounce':
      return Object.freeze({ kind: 'bounce', intensity: 0.45 })
    default:
      return Object.freeze({ kind: 'linear' })
  }
}

const currentValue = (draft: FootageMotionDraft, property: SupportedProperty): number => {
  switch (property) {
    case 'scale': return draft.transform.scale
    case 'translate-x': return draft.transform.translateX
    case 'translate-y': return draft.transform.translateY
    case 'rotation': return draft.transform.rotationDegrees
    case 'crop-top': return draft.crop.top
    case 'crop-right': return draft.crop.right
    case 'crop-bottom': return draft.crop.bottom
    case 'crop-left': return draft.crop.left
    default: return 0
  }
}

const withBaseValue = (
  draft: FootageMotionDraft,
  property: SupportedProperty,
  value: number,
): FootageMotionDraft => {
  switch (property) {
    case 'scale':
      return Object.freeze({ ...draft, transform: Object.freeze({ ...draft.transform, scale: value }) })
    case 'translate-x':
      return Object.freeze({ ...draft, transform: Object.freeze({ ...draft.transform, translateX: value }) })
    case 'translate-y':
      return Object.freeze({ ...draft, transform: Object.freeze({ ...draft.transform, translateY: value }) })
    case 'rotation':
      return Object.freeze({ ...draft, transform: Object.freeze({ ...draft.transform, rotationDegrees: value }) })
    case 'crop-top':
      return Object.freeze({ ...draft, crop: Object.freeze({ ...draft.crop, top: value }) })
    case 'crop-right':
      return Object.freeze({ ...draft, crop: Object.freeze({ ...draft.crop, right: value }) })
    case 'crop-bottom':
      return Object.freeze({ ...draft, crop: Object.freeze({ ...draft.crop, bottom: value }) })
    case 'crop-left':
      return Object.freeze({ ...draft, crop: Object.freeze({ ...draft.crop, left: value }) })
    default:
      return draft
  }
}

const relativeTicksAt = (draft: FootageMotionDraft, sourceTime: MediaTime | null): number | null => {
  if (!sourceTime) return null
  const relative = sourceTime.ticks - draft.sourceInterval.start.ticks
  return relative >= 0 && relative <= draft.sourceInterval.duration.ticks ? relative : null
}

const upsertKeyframe = (
  draft: FootageMotionDraft,
  property: SupportedProperty,
  atTicks: number,
  value: number,
  easing: VisualEasing,
): FootageMotionDraft => {
  const existing = draft.tracks.find((track) => track.property === property)
  const durationTicks = draft.sourceInterval.duration.ticks
  const seed = existing?.keyframes ?? Object.freeze([
    Object.freeze({ at: mediaTime(0), value: currentValue(draft, property), easing }),
    Object.freeze({ at: mediaTime(durationTicks), value: currentValue(draft, property), easing: Object.freeze({ kind: 'linear' as const }) }),
  ])
  const keyframes = seed
    .filter((keyframe) => keyframe.at.ticks !== atTicks)
    .concat(Object.freeze({ at: mediaTime(atTicks), value, easing }))
    .sort((left, right) => left.at.ticks - right.at.ticks)
  const tracks = draft.tracks
    .filter((track) => track.property !== property)
    .concat(Object.freeze({ property, keyframes: Object.freeze(keyframes) }))
  return Object.freeze({ ...draft, tracks: Object.freeze(tracks) })
}

export const updateFootageMotionValueAtSourceTime = (
  draft: FootageMotionDraft,
  property: SupportedProperty,
  value: number,
  sourceTime: MediaTime | null,
  easing: VisualEasing = Object.freeze({ kind: 'linear' }),
): FootageMotionDraft => {
  const track = draft.tracks.find((candidate) => candidate.property === property)
  const relative = relativeTicksAt(draft, sourceTime)
  if (track && relative !== null) return upsertKeyframe(draft, property, relative, value, easing)
  return withBaseValue(draft, property, value)
}

const animatedPreset = (draft: FootageMotionDraft, from: number, to: number): FootageMotionDraft =>
  Object.freeze({
    ...draft,
    transform: Object.freeze({ ...draft.transform, scale: from }),
    tracks: Object.freeze([
      ...draft.tracks.filter((track) => track.property !== 'scale'),
      Object.freeze({
        property: 'scale' as const,
        keyframes: Object.freeze([
          Object.freeze({ at: mediaTime(0), value: from, easing: easingFor('smooth') }),
          Object.freeze({ at: mediaTime(draft.sourceInterval.duration.ticks), value: to, easing: easingFor('linear') }),
        ]),
      }),
    ]),
  })

export const createWideFootageMotionDraft = (
  motionId: string,
  assetId: string,
  sourceInterval: TimeRange,
): FootageMotionDraft => Object.freeze({
  motionId,
  assetId,
  sourceInterval,
  transform: DEFAULT_FOOTAGE_MOTION_STATE.transform,
  crop: DEFAULT_FOOTAGE_MOTION_STATE.crop,
  tracks: Object.freeze([]),
})

export const footageMotionDraftFromOperation = (
  operation: SetFootageMotionOperation,
): FootageMotionDraft => Object.freeze({
  motionId: operation.motionId,
  assetId: operation.assetId,
  sourceInterval: operation.sourceInterval,
  transform: operation.transform,
  crop: operation.crop,
  tracks: operation.tracks,
})

export const buildFootageMotionOperation = (
  draft: FootageMotionDraft,
  operationId: string,
): SetFootageMotionOperation => Object.freeze({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'set-footage-motion',
  capabilityId: FOOTAGE_MOTION_CAPABILITY_ID,
  motionId: draft.motionId,
  assetId: draft.assetId,
  sourceInterval: draft.sourceInterval,
  transform: draft.transform,
  crop: draft.crop,
  tracks: draft.tracks,
  extensions: Object.freeze({}),
})

const numberInput = (
  label: string,
  value: number,
  unit: string,
  min: number,
  max: number,
  step: number,
  onChange: (value: number) => void,
  disabled: boolean,
) => (
  <label className="footage-motion__field">
    <span>{label}</span>
    <span className="footage-motion__input-wrap">
      <input
        aria-label={`${label} ${unit}`}
        type="number"
        value={Number(value.toFixed(3))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.currentTarget.value)
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
        }}
      />
      <span aria-hidden="true">{unit}</span>
    </span>
  </label>
)

export function FootageMotionInspector({
  draft,
  accepted,
  sourceTime,
  busy,
  setDraft,
  onApply,
  onSeekSourceTime,
}: FootageMotionInspectorProps) {
  const [keyframeProperty, setKeyframeProperty] = useState<SupportedProperty>('scale')
  const [easingChoice, setEasingChoice] = useState<EasingChoice>('smooth')
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const relativeTicks = relativeTicksAt(draft, sourceTime)
  const evaluated = useMemo(() => evaluateFootageMotionAt({
    motion: buildFootageMotionOperation(draft, 'operation_previewmotion'),
    sourceTime: sourceTime ?? draft.sourceInterval.start,
  }), [draft, sourceTime])
  const keyframes = draft.tracks
    .flatMap((track) => track.keyframes.map((keyframe) => Object.freeze({
      property: track.property,
      atTicks: keyframe.at.ticks,
      value: keyframe.value,
      easing: keyframe.easing.kind,
    })))
    .sort((left, right) => left.atTicks - right.atTicks || left.property.localeCompare(right.property))

  const update = (property: SupportedProperty, value: number) => {
    setNotice(null)
    setDraft((current) => current
      ? updateFootageMotionValueAtSourceTime(current, property, value, sourceTime, easingFor(easingChoice))
      : current)
  }

  const apply = async (remove = false) => {
    if (saving || busy) return
    setSaving(true)
    setNotice(null)
    const source = remove
      ? createWideFootageMotionDraft(draft.motionId, draft.assetId, draft.sourceInterval)
      : draft
    const error = await onApply(buildFootageMotionOperation(source, createOperationId()))
    setSaving(false)
    setNotice(error ?? (remove ? 'Motion removed.' : 'Motion applied.'))
  }

  const setPreset = (kind: 'wide' | '110' | '120' | '135' | 'left' | 'right' | 'zoom-in' | 'zoom-out') => {
    setNotice(null)
    setDraft((current) => {
      if (!current) return current
      switch (kind) {
        case 'wide': return createWideFootageMotionDraft(current.motionId, current.assetId, current.sourceInterval)
        case '110': return Object.freeze({ ...current, transform: Object.freeze({ ...current.transform, scale: 1.1 }), tracks: Object.freeze([]) })
        case '120': return Object.freeze({ ...current, transform: Object.freeze({ ...current.transform, scale: 1.2 }), tracks: Object.freeze([]) })
        case '135': return Object.freeze({ ...current, transform: Object.freeze({ ...current.transform, scale: 1.35 }), tracks: Object.freeze([]) })
        case 'left': return Object.freeze({ ...current, transform: Object.freeze({ ...current.transform, translateX: -0.18 }) })
        case 'right': return Object.freeze({ ...current, transform: Object.freeze({ ...current.transform, translateX: 0.18 }) })
        case 'zoom-in': return animatedPreset(current, 1, 1.2)
        case 'zoom-out': return animatedPreset(current, 1.2, 1)
        default: return current
      }
    })
  }

  const addKeyframe = () => {
    if (relativeTicks === null) {
      setNotice('Move the playhead inside this motion interval before adding a keyframe.')
      return
    }
    setDraft((current) => current
      ? upsertKeyframe(current, keyframeProperty, relativeTicks, currentValue(current, keyframeProperty), easingFor(easingChoice))
      : current)
    setNotice('Keyframe added or updated at the playhead.')
  }

  const seekKeyframe = (direction: -1 | 1) => {
    if (keyframes.length === 0 || relativeTicks === null) return
    const candidate = direction < 0
      ? keyframes.filter((keyframe) => keyframe.atTicks < relativeTicks).at(-1)
      : keyframes.find((keyframe) => keyframe.atTicks > relativeTicks)
    if (candidate) onSeekSourceTime(mediaTime(draft.sourceInterval.start.ticks + candidate.atTicks))
  }

  return (
    <section className="footage-motion" aria-labelledby="footage-motion-heading">
      <div className="footage-motion__heading">
        <div>
          <p className="footage-motion__eyebrow">Primary footage</p>
          <h3 id="footage-motion-heading">Motion</h3>
        </div>
        <span className="footage-motion__status">{accepted ? 'Accepted motion' : 'Local draft'}</span>
      </div>

      <p className="footage-motion__interval">
        Source interval: {(draft.sourceInterval.start.ticks / 1_440_000).toFixed(3)}s–
        {((draft.sourceInterval.start.ticks + draft.sourceInterval.duration.ticks) / 1_440_000).toFixed(3)}s
      </p>
      <p className="footage-motion__current" aria-live="polite">
        At playhead: {Math.round(evaluated.transform.scale * 100)}% · X {Math.round(evaluated.transform.translateX * 100)}% · Y {Math.round(evaluated.transform.translateY * 100)}% · {evaluated.transform.rotationDegrees.toFixed(1)}°
      </p>

      <div className="footage-motion__presets" aria-label="Motion presets">
        <button type="button" onClick={() => setPreset('wide')} disabled={busy || saving}>Reset / Wide</button>
        <button type="button" onClick={() => setPreset('110')} disabled={busy || saving}>Punch in 110%</button>
        <button type="button" onClick={() => setPreset('120')} disabled={busy || saving}>Punch in 120%</button>
        <button type="button" onClick={() => setPreset('135')} disabled={busy || saving}>Punch in 135%</button>
        <button type="button" onClick={() => setPreset('left')} disabled={busy || saving}>Reframe left</button>
        <button type="button" onClick={() => setPreset('right')} disabled={busy || saving}>Reframe right</button>
        <button type="button" onClick={() => setPreset('zoom-in')} disabled={busy || saving}>Smooth zoom in</button>
        <button type="button" onClick={() => setPreset('zoom-out')} disabled={busy || saving}>Smooth zoom out</button>
      </div>

      <div className="footage-motion__grid">
        {numberInput('Scale', draft.transform.scale * 100, '%', 1, 2000, 1, (value) => update('scale', value / 100), busy || saving)}
        {numberInput('Position X', draft.transform.translateX * 100, '% frame', -200, 200, 1, (value) => update('translate-x', value / 100), busy || saving)}
        {numberInput('Position Y', draft.transform.translateY * 100, '% frame', -200, 200, 1, (value) => update('translate-y', value / 100), busy || saving)}
        {numberInput('Rotation', draft.transform.rotationDegrees, '°', -3600, 3600, 0.5, (value) => update('rotation', value), busy || saving)}
        {numberInput('Crop top', draft.crop.top * 100, '%', 0, 99, 1, (value) => update('crop-top', value / 100), busy || saving)}
        {numberInput('Crop right', draft.crop.right * 100, '%', 0, 99, 1, (value) => update('crop-right', value / 100), busy || saving)}
        {numberInput('Crop bottom', draft.crop.bottom * 100, '%', 0, 99, 1, (value) => update('crop-bottom', value / 100), busy || saving)}
        {numberInput('Crop left', draft.crop.left * 100, '%', 0, 99, 1, (value) => update('crop-left', value / 100), busy || saving)}
      </div>

      <fieldset className="footage-motion__keyframes">
        <legend>Keyframes</legend>
        <label>
          Property
          <select value={keyframeProperty} onChange={(event) => setKeyframeProperty(event.currentTarget.value as SupportedProperty)} disabled={busy || saving}>
            {PROPERTY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          Easing
          <select value={easingChoice} onChange={(event) => setEasingChoice(event.currentTarget.value as EasingChoice)} disabled={busy || saving}>
            <option value="linear">Linear</option>
            <option value="smooth">Smooth cubic</option>
            <option value="spring">Spring</option>
            <option value="bounce">Bounce</option>
          </select>
        </label>
        <div className="footage-motion__keyframe-actions">
          <button type="button" onClick={() => seekKeyframe(-1)} disabled={busy || saving || keyframes.length === 0}>Previous keyframe</button>
          <button type="button" onClick={addKeyframe} disabled={busy || saving}>Add/update at playhead</button>
          <button type="button" onClick={() => seekKeyframe(1)} disabled={busy || saving || keyframes.length === 0}>Next keyframe</button>
        </div>
        <ul aria-label="Motion keyframe list">
          {keyframes.length === 0 ? <li>No animated properties.</li> : keyframes.map((keyframe) => (
            <li key={`${keyframe.property}:${keyframe.atTicks}`}>
              {keyframe.property} · {(keyframe.atTicks / 1_440_000).toFixed(3)}s · {Number(keyframe.value.toFixed(3))} · {keyframe.easing}
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="footage-motion__actions">
        <button type="button" className="footage-motion__apply" onClick={() => void apply(false)} disabled={busy || saving}>
          {accepted ? 'Apply motion repair' : 'Apply motion'}
        </button>
        <button type="button" onClick={() => setPreset('wide')} disabled={busy || saving}>Reset draft</button>
        {accepted ? <button type="button" onClick={() => void apply(true)} disabled={busy || saving}>Remove motion</button> : null}
      </div>
      {notice ? <p className="footage-motion__notice" role={notice.includes('inside') ? 'alert' : 'status'}>{notice}</p> : null}
    </section>
  )
}

function createOperationId() {
  const bytes = new Uint32Array(4)
  globalThis.crypto.getRandomValues(bytes)
  return `operation_${Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join('')}`.slice(0, 42)
}
