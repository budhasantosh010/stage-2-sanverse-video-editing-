import { useEffect, useState } from 'react'
import {
  animationCapabilityForProperty,
  planSetEditorKeyframeEasing,
  planSetEditorKeyframeValues,
  type EditorAnimationTrackStateV1,
  type EditorKeyframeSelectionV1,
  type VisualEasing,
} from '@sanverse/edit-domain'
import type { TimelineAnimationSubjectV1 } from '../../features/timeline'
import { InspectorRow } from './InspectorRow'
import { InspectorSection } from './InspectorSection'

const EASING_PRESETS: Readonly<Record<string, VisualEasing>> = Object.freeze({
  linear: Object.freeze({ kind: 'linear' }),
  'ease-in': Object.freeze({ kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 }),
  'ease-out': Object.freeze({ kind: 'cubic-bezier', x1: 0, y1: 0, x2: 0.58, y2: 1 }),
  'ease-in-out': Object.freeze({ kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 }),
  spring: Object.freeze({ kind: 'spring', mass: 1, stiffness: 170, damping: 26, velocity: 0 }),
  bounce: Object.freeze({ kind: 'bounce', intensity: 0.6 }),
})

export type InspectorSelectedKeyframeProps = Readonly<{
  subject: TimelineAnimationSubjectV1 | null
  selection: EditorKeyframeSelectionV1
  busy: boolean
  onCommit(state: EditorAnimationTrackStateV1): void
  onNotice(message: string): void
}>

const targetMatches = (subject: TimelineAnimationSubjectV1, kind: EditorKeyframeSelectionV1['addresses'][number]['target']): boolean =>
  subject.target.kind === kind.kind && (kind.kind === 'visual-properties'
    ? subject.target.kind === 'visual-properties' && subject.target.visualId === kind.visualId
    : subject.target.kind === 'primary-footage-motion' && subject.target.motionId === kind.motionId && subject.target.assetId === kind.assetId)

export function InspectorSelectedKeyframe({ subject, selection, busy, onCommit, onNotice }: InspectorSelectedKeyframeProps) {
  const selected = subject && selection.addresses.length === 1 && targetMatches(subject, selection.addresses[0].target)
    ? selection.addresses[0]
    : null
  const track = selected ? subject?.state.tracks.find((candidate) => candidate.property === selected.property) ?? null : null
  const frame = selected && track ? track.keyframes.find((candidate) => candidate.at.ticks === selected.canonicalAtTicks) ?? null : null
  const capability = selected && subject ? animationCapabilityForProperty(subject.state.targetKind, selected.property, subject.state) : null
  const [value, setValue] = useState('')
  const [easing, setEasing] = useState('linear')

  useEffect(() => {
    setValue(frame ? String(frame.value) : '')
    setEasing(frame?.easing.kind === 'cubic-bezier' ? 'ease-in-out' : frame?.easing.kind ?? 'linear')
  }, [frame?.at.ticks, frame?.value, frame?.easing.kind])

  if (!subject || !selected || !track || !frame || !capability) return null
  const last = track.keyframes.at(-1)?.at.ticks === frame.at.ticks

  const apply = () => {
    const numeric = Number(value)
    const valued = planSetEditorKeyframeValues({
      state: subject.state,
      updates: [Object.freeze({ property: selected.property, canonicalAtTicks: selected.canonicalAtTicks, value: numeric })],
    })
    if (!valued.ok) {
      onNotice(valued.refusal.message)
      return
    }
    let next = valued.state
    if (!last) {
      const canonical = EASING_PRESETS[easing]
      if (canonical) {
        const eased = planSetEditorKeyframeEasing({
          state: next,
          property: selected.property,
          canonicalAtTicks: [selected.canonicalAtTicks],
          easing: canonical,
        })
        if (!eased.ok) {
          onNotice(eased.refusal.message)
          return
        }
        next = eased.state
      }
    }
    onCommit(next)
    onNotice('Selected keyframe updated from Inspector. Timeline and Graph use the same value.')
  }

  return (
    <InspectorSection title="Selected keyframe" defaultOpen>
      <dl className="inspector__facts">
        <InspectorRow label="Property">{capability.label}</InspectorRow>
        <InspectorRow label="Canonical time">{selected.canonicalAtTicks} ticks</InspectorRow>
        <InspectorRow label="Current value">{frame.value}</InspectorRow>
      </dl>
      <label className="inspector__field">
        <span>Keyframe value</span>
        <input aria-label={`${capability.label} selected keyframe value`} type="number" step="0.01" value={value} onChange={(event) => setValue(event.currentTarget.value)} />
      </label>
      <label className="inspector__field">
        <span>Interpolation</span>
        <select aria-label="Selected keyframe interpolation" value={easing} disabled={last} onChange={(event) => setEasing(event.currentTarget.value)}>
          <option value="linear">Linear</option>
          <option value="ease-in">Ease In</option>
          <option value="ease-out">Ease Out</option>
          <option value="ease-in-out">Ease In-Out</option>
          <option value="spring">Spring</option>
          <option value="bounce">Bounce</option>
        </select>
      </label>
      {last ? <p className="inspector__hint">Interpolation applies from this keyframe to the next.</p> : null}
      <button type="button" disabled={busy} onClick={apply}>Apply selected keyframe</button>
    </InspectorSection>
  )
}
