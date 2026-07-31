import { useEffect, useMemo, useState } from 'react'

import {
  PROJECT_TIMESCALE,
  VISUAL_PROPERTIES,
  type EditOperation,
  type VisualEasing,
  type VisualEffect,
  type VisualProperties,
  type VisualProperty,
  type VisualPropertyTrack,
  type VisualTransitionKind,
} from '@sanverse/edit-domain'

import type { SharedVisualDraftController } from '../canvas/canvas-contract'
import type {
  InspectorCaptionSelection,
  InspectorCalloutSelection,
  InspectorMediaOverlaySelection,
  InspectorNameplateSelection,
  InspectorTitleSelection,
} from './inspector-contract'
import { createInspectorOperationId } from './inspector-operation-id'
import { buildVisualPropertiesOperation } from './inspector-operations'
import { InspectorSection } from './InspectorSection'
import { InspectorSectionActions } from './InspectorSectionActions'
import { useInspectorSectionDraft } from './useInspectorSectionDraft'

export type InspectorVisualSelection =
  | InspectorCaptionSelection
  | InspectorNameplateSelection
  | InspectorTitleSelection
  | InspectorCalloutSelection
  | InspectorMediaOverlaySelection

export type InspectorVisualSectionsProps = Readonly<{
  selection: InspectorVisualSelection
  busy: boolean
  playheadTicks: number
  onSeek(ticks: number): void
  onApply(operation: EditOperation): Promise<string | null>
  onDirtyChange(sectionId: string, dirty: boolean): void
  visualDraftController?: SharedVisualDraftController
  onRequestCanvasCrop?(): void
}>

type EasingPreset = 'linear' | 'ease' | 'spring' | 'bounce'

const seconds = (ticks: number): number => Number((ticks / PROJECT_TIMESCALE).toFixed(3))
const ticks = (secondsValue: number): number => Math.max(0, Math.round(secondsValue * PROJECT_TIMESCALE))
const percent = (value: number): number => Number((value * 100).toFixed(2))

const EASING_PRESETS: Readonly<Record<EasingPreset, VisualEasing>> = Object.freeze({
  linear: Object.freeze({ kind: 'linear' }),
  ease: Object.freeze({ kind: 'cubic-bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }),
  spring: Object.freeze({ kind: 'spring', mass: 1, stiffness: 170, damping: 26, velocity: 0 }),
  bounce: Object.freeze({ kind: 'bounce', intensity: 0.65 }),
})

const easingPreset = (easing: VisualEasing): EasingPreset => {
  if (easing.kind === 'cubic-bezier') return 'ease'
  if (easing.kind === 'spring') return 'spring'
  if (easing.kind === 'bounce') return 'bounce'
  return 'linear'
}

const baseValue = (properties: VisualProperties, property: VisualProperty): number => {
  if (property === 'translate-x') return properties.transform.translateX
  if (property === 'translate-y') return properties.transform.translateY
  if (property === 'scale') return properties.transform.scale
  if (property === 'rotation') return properties.transform.rotationDegrees
  if (property === 'opacity') return properties.transform.opacity
  if (property === 'crop-top') return properties.crop.top
  if (property === 'crop-right') return properties.crop.right
  if (property === 'crop-bottom') return properties.crop.bottom
  return properties.crop.left
}

const propertyLabel = (property: VisualProperty): string => ({
  'translate-x': 'Position X',
  'translate-y': 'Position Y',
  scale: 'Scale',
  rotation: 'Rotation',
  opacity: 'Opacity',
  'crop-top': 'Crop top',
  'crop-right': 'Crop right',
  'crop-bottom': 'Crop bottom',
  'crop-left': 'Crop left',
})[property]

const transitionKinds: readonly VisualTransitionKind[] = [
  'none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom',
]

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: Readonly<{
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange(value: number): void
}>) {
  return (
    <label className="inspector-field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}

const effectDefault = (kind: VisualEffect['kind']): number =>
  kind === 'contrast' || kind === 'saturation' ? 1 : 0

const effectValue = (properties: VisualProperties, kind: VisualEffect['kind']): number =>
  properties.effects.find((effect) => effect.kind === kind)?.amount ?? effectDefault(kind)

const setEffect = (
  properties: VisualProperties,
  kind: VisualEffect['kind'],
  amount: number,
): VisualProperties => {
  const without = properties.effects.filter((effect) => effect.kind !== kind)
  const effects = amount === effectDefault(kind)
    ? without
    : [...without, Object.freeze({ kind, amount }) as VisualEffect]
  return Object.freeze({ ...properties, effects: Object.freeze(effects) })
}

const setTrack = (
  properties: VisualProperties,
  property: VisualProperty,
  track: VisualPropertyTrack | null,
): VisualProperties => Object.freeze({
  ...properties,
  tracks: Object.freeze([
    ...properties.tracks.filter((candidate) => candidate.property !== property),
    ...(track ? [track] : []),
  ].sort((left, right) => VISUAL_PROPERTIES.indexOf(left.property) - VISUAL_PROPERTIES.indexOf(right.property))),
})

const NOOP_DIRTY = () => {}

export function InspectorVisualSections({
  selection,
  busy,
  playheadTicks,
  onSeek,
  onApply,
  onDirtyChange,
  visualDraftController,
  onRequestCanvasCrop,
}: InspectorVisualSectionsProps) {
  const key = `${selection.timelineItemId}:${selection.projectRevision}`
  const localVisual = useInspectorSectionDraft({
    sectionId: 'visual-properties',
    selectionKey: key,
    projectRevision: selection.projectRevision,
    authoritative: selection.visualProperties,
    onDirtyChange: visualDraftController ? NOOP_DIRTY : onDirtyChange,
  })
  const visual = visualDraftController ?? localVisual

  useEffect(() => {
    if (!visualDraftController) return
    onDirtyChange('visual-properties', visualDraftController.draft?.dirty ?? false)
    return () => onDirtyChange('visual-properties', false)
  }, [onDirtyChange, visualDraftController, visualDraftController?.draft?.dirty])
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [keyframeProperty, setKeyframeProperty] = useState<VisualProperty>('scale')

  const update = (next: VisualProperties) => visual.update(Object.freeze(next))
  const apply = async () => {
    const value = visual.draft?.value ?? selection.visualProperties
    const result = buildVisualPropertiesOperation(selection, value, createInspectorOperationId())
    if (!result.ok) {
      setNotice(result.message)
      return
    }
    setWorking(true)
    setNotice(null)
    const failure = await onApply(result.operation)
    setWorking(false)
    if (failure) {
      setNotice(failure)
      return
    }
    visual.markApplied()
    setNotice('Applied. Undo takes back this visual change.')
  }

  const properties = visual.draft?.value ?? selection.visualProperties
  const visualDirty = visual.draft?.dirty ?? false
  const interaction = visual.draft && 'interaction' in visual.draft ? visual.draft.interaction : null
  const sharedNotice = visual.draft && 'notice' in visual.draft ? visual.draft.notice : null
  const relativePlayhead = Math.max(0, Math.min(selection.durationTicks, playheadTicks - selection.startTicks))
  const selectedTrack = properties.tracks.find((track) => track.property === keyframeProperty) ?? null
  const keyframeEnabled = selectedTrack !== null
  const currentBaseValue = baseValue(properties, keyframeProperty)

  const enableKeyframes = (enabled: boolean) => {
    if (!enabled) {
      update(setTrack(properties, keyframeProperty, null))
      return
    }
    const endAt = Math.max(1, selection.durationTicks)
    update(setTrack(properties, keyframeProperty, Object.freeze({
      property: keyframeProperty,
      keyframes: Object.freeze([
        Object.freeze({ at: Object.freeze({ ticks: 0, timescale: PROJECT_TIMESCALE }), value: currentBaseValue, easing: EASING_PRESETS.linear }),
        Object.freeze({ at: Object.freeze({ ticks: endAt, timescale: PROJECT_TIMESCALE }), value: currentBaseValue, easing: EASING_PRESETS.linear }),
      ]),
    })))
  }

  const addKeyframeAtPlayhead = () => {
    const track = selectedTrack ?? Object.freeze({
      property: keyframeProperty,
      keyframes: Object.freeze([
        Object.freeze({ at: Object.freeze({ ticks: 0, timescale: PROJECT_TIMESCALE }), value: currentBaseValue, easing: EASING_PRESETS.linear }),
        Object.freeze({ at: Object.freeze({ ticks: Math.max(1, selection.durationTicks), timescale: PROJECT_TIMESCALE }), value: currentBaseValue, easing: EASING_PRESETS.linear }),
      ]),
    })
    const frames = track.keyframes.filter((frame) => frame.at.ticks !== relativePlayhead)
    frames.push(Object.freeze({
      at: Object.freeze({ ticks: relativePlayhead, timescale: PROJECT_TIMESCALE }),
      value: currentBaseValue,
      easing: EASING_PRESETS.linear,
    }))
    frames.sort((left, right) => left.at.ticks - right.at.ticks)
    update(setTrack(properties, keyframeProperty, Object.freeze({
      property: keyframeProperty,
      keyframes: Object.freeze(frames),
    })))
  }

  const updateKeyframe = (index: number, patch: Readonly<{ atTicks?: number; value?: number; easing?: VisualEasing }>) => {
    if (!selectedTrack) return
    const frames = selectedTrack.keyframes.map((frame, frameIndex) => frameIndex === index
      ? Object.freeze({
          at: Object.freeze({ ticks: patch.atTicks ?? frame.at.ticks, timescale: PROJECT_TIMESCALE }),
          value: patch.value ?? frame.value,
          easing: patch.easing ?? frame.easing,
        })
      : frame)
      .slice()
      .sort((left, right) => left.at.ticks - right.at.ticks)
    update(setTrack(properties, keyframeProperty, Object.freeze({
      property: keyframeProperty,
      keyframes: Object.freeze(frames),
    })))
  }

  const removeKeyframe = (index: number) => {
    if (!selectedTrack) return
    const frames = selectedTrack.keyframes.filter((_, frameIndex) => frameIndex !== index)
    update(setTrack(properties, keyframeProperty, frames.length < 2 ? null : Object.freeze({
      property: keyframeProperty,
      keyframes: Object.freeze(frames),
    })))
  }

  const adjacent = useMemo(() => {
    if (!selectedTrack) return { previous: null, next: null }
    const previous = selectedTrack.keyframes.filter((frame) => frame.at.ticks < relativePlayhead).at(-1) ?? null
    const next = selectedTrack.keyframes.find((frame) => frame.at.ticks > relativePlayhead) ?? null
    return { previous, next }
  }, [relativePlayhead, selectedTrack])

  const footer = (
    <InspectorSectionActions
      dirty={visualDirty}
      busy={busy || interaction !== null}
      working={working}
      notice={interaction ? 'Dragging…' : sharedNotice ?? notice}
      onReset={() => {
        visual.reset()
        setNotice(null)
      }}
      onApply={() => void apply()}
    />
  )

  return (
    <>
      <InspectorSection title="Transform" defaultOpen>
        <div className="inspector-field-grid">
          <NumberField label="Position X (%)" value={percent(properties.transform.translateX)} min={-200} max={200} onChange={(value) => update({ ...properties, transform: { ...properties.transform, translateX: value / 100 } })} />
          <NumberField label="Position Y (%)" value={percent(properties.transform.translateY)} min={-200} max={200} onChange={(value) => update({ ...properties, transform: { ...properties.transform, translateY: value / 100 } })} />
          <NumberField label="Scale (%)" value={percent(properties.transform.scale)} min={1} max={2000} onChange={(value) => update({ ...properties, transform: { ...properties.transform, scale: value / 100 } })} />
          <NumberField label="Rotation (degrees)" value={properties.transform.rotationDegrees} min={-3600} max={3600} onChange={(value) => update({ ...properties, transform: { ...properties.transform, rotationDegrees: value } })} />
          <NumberField label="Opacity (%)" value={percent(properties.transform.opacity)} min={0} max={100} onChange={(value) => update({ ...properties, transform: { ...properties.transform, opacity: value / 100 } })} />
        </div>
      </InspectorSection>

      <InspectorSection title="Crop">
        {selection.kind === 'media-overlay' && onRequestCanvasCrop ? (
          <button type="button" className="inspector__canvas-crop-action" disabled={busy || interaction !== null} onClick={onRequestCanvasCrop}>
            Crop on canvas
          </button>
        ) : null}
        <div className="inspector-field-grid inspector-field-grid--four">
          <NumberField label="Crop top (%)" value={percent(properties.crop.top)} min={0} max={99} onChange={(value) => update({ ...properties, crop: { ...properties.crop, top: value / 100 } })} />
          <NumberField label="Crop right (%)" value={percent(properties.crop.right)} min={0} max={99} onChange={(value) => update({ ...properties, crop: { ...properties.crop, right: value / 100 } })} />
          <NumberField label="Crop bottom (%)" value={percent(properties.crop.bottom)} min={0} max={99} onChange={(value) => update({ ...properties, crop: { ...properties.crop, bottom: value / 100 } })} />
          <NumberField label="Crop left (%)" value={percent(properties.crop.left)} min={0} max={99} onChange={(value) => update({ ...properties, crop: { ...properties.crop, left: value / 100 } })} />
        </div>
      </InspectorSection>

      <InspectorSection title="Layer, mask and effects">
        <div className="inspector-field-grid">
          <NumberField label="Layer" value={properties.layer} min={-100} max={100} step={1} onChange={(value) => update({ ...properties, layer: Math.round(value) })} />
          <label className="inspector-field"><span>Mask</span><select aria-label="Mask shape" value={properties.mask.shape} onChange={(event) => update({ ...properties, mask: { shape: event.currentTarget.value as typeof properties.mask.shape, feather: event.currentTarget.value === 'none' ? 0 : properties.mask.feather } })}><option value="none">None</option><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option></select></label>
          {properties.mask.shape !== 'none' ? <NumberField label="Mask feather (%)" value={percent(properties.mask.feather)} min={0} max={50} onChange={(value) => update({ ...properties, mask: { ...properties.mask, feather: value / 100 } })} /> : null}
        </div>
        <div className="inspector-field-grid">
          <NumberField label="Blur (%)" value={percent(effectValue(properties, 'blur'))} min={0} max={10} step={0.5} onChange={(value) => update(setEffect(properties, 'blur', value / 100))} />
          <NumberField label="Brightness (%)" value={percent(effectValue(properties, 'brightness'))} min={-100} max={100} onChange={(value) => update(setEffect(properties, 'brightness', value / 100))} />
          <NumberField label="Contrast (%)" value={percent(effectValue(properties, 'contrast'))} min={0} max={400} onChange={(value) => update(setEffect(properties, 'contrast', value / 100))} />
          <NumberField label="Saturation (%)" value={percent(effectValue(properties, 'saturation'))} min={0} max={400} onChange={(value) => update(setEffect(properties, 'saturation', value / 100))} />
          <NumberField label="Grayscale (%)" value={percent(effectValue(properties, 'grayscale'))} min={0} max={100} onChange={(value) => update(setEffect(properties, 'grayscale', value / 100))} />
        </div>
      </InspectorSection>

      <InspectorSection title="Entrance and exit">
        {(['enter', 'exit'] as const).map((phase) => {
          const value = properties.transition[phase]
          return (
            <fieldset className="inspector-subsection" key={phase}>
              <legend>{phase === 'enter' ? 'Entrance' : 'Exit'}</legend>
              <label className="inspector-field"><span>Motion</span><select aria-label={`${phase} transition`} value={value.kind} onChange={(event) => {
                const kind = event.currentTarget.value as VisualTransitionKind
                update({ ...properties, transition: { ...properties.transition, [phase]: { ...value, kind, duration: { ticks: kind === 'none' ? 0 : Math.max(value.duration.ticks, Math.round(PROJECT_TIMESCALE / 2)), timescale: PROJECT_TIMESCALE } } } })
              }}>{transitionKinds.map((kind) => <option key={kind} value={kind}>{kind.replaceAll('-', ' ')}</option>)}</select></label>
              {value.kind !== 'none' ? <div className="inspector-field-grid"><NumberField label={`${phase} duration (seconds)`} value={seconds(value.duration.ticks)} min={0.05} max={10} step={0.05} onChange={(duration) => update({ ...properties, transition: { ...properties.transition, [phase]: { ...value, duration: { ticks: ticks(duration), timescale: PROJECT_TIMESCALE } } } })} /><label className="inspector-field"><span>Easing</span><select aria-label={`${phase} easing`} value={easingPreset(value.easing)} onChange={(event) => update({ ...properties, transition: { ...properties.transition, [phase]: { ...value, easing: EASING_PRESETS[event.currentTarget.value as EasingPreset] } } })}>{(Object.keys(EASING_PRESETS) as EasingPreset[]).map((preset) => <option key={preset} value={preset}>{preset}</option>)}</select></label></div> : null}
            </fieldset>
          )
        })}
      </InspectorSection>

      <InspectorSection title="Keyframes V1">
        <p className="inspector__guidance">Simple property keyframes only. A full curve editor is deliberately deferred.</p>
        <label className="inspector-field"><span>Property</span><select aria-label="Keyframe property" value={keyframeProperty} onChange={(event) => setKeyframeProperty(event.currentTarget.value as VisualProperty)}>{VISUAL_PROPERTIES.map((property) => <option key={property} value={property}>{propertyLabel(property)}</option>)}</select></label>
        <label className="inspector-field inspector-field--checkbox"><input aria-label="Enable keyframes" type="checkbox" checked={keyframeEnabled} onChange={(event) => enableKeyframes(event.currentTarget.checked)} /><span>Enable keyframes</span></label>
        {keyframeEnabled && selectedTrack ? (
          <>
            <div className="inspector__actions">
              <button type="button" disabled={!adjacent.previous} onClick={() => adjacent.previous && onSeek(selection.startTicks + adjacent.previous.at.ticks)}>Previous</button>
              <button type="button" onClick={addKeyframeAtPlayhead}>Add at playhead</button>
              <button type="button" disabled={!adjacent.next} onClick={() => adjacent.next && onSeek(selection.startTicks + adjacent.next.at.ticks)}>Next</button>
            </div>
            <ol className="inspector-keyframes" aria-label={`${propertyLabel(keyframeProperty)} keyframes`}>
              {selectedTrack.keyframes.map((frame, index) => (
                <li key={`${frame.at.ticks}:${index}`}>
                  <NumberField label={`Keyframe ${index + 1} time (seconds)`} value={seconds(frame.at.ticks)} min={0} max={seconds(selection.durationTicks)} step={0.01} onChange={(value) => updateKeyframe(index, { atTicks: ticks(value) })} />
                  <NumberField label={`Keyframe ${index + 1} value`} value={frame.value} step={0.01} onChange={(value) => updateKeyframe(index, { value })} />
                  <label className="inspector-field"><span>Easing</span><select aria-label={`Keyframe ${index + 1} easing`} value={easingPreset(frame.easing)} onChange={(event) => updateKeyframe(index, { easing: EASING_PRESETS[event.currentTarget.value as EasingPreset] })}>{(Object.keys(EASING_PRESETS) as EasingPreset[]).map((preset) => <option key={preset} value={preset}>{preset}</option>)}</select></label>
                  <button type="button" onClick={() => removeKeyframe(index)}>Remove</button>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </InspectorSection>

      <section className="inspector__visual-apply" aria-label="Apply visual properties">
        {footer}
      </section>
    </>
  )
}
