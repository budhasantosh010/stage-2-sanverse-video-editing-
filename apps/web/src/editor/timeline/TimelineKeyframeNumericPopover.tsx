import { useEffect, useMemo, useState } from 'react'
import {
  animationCapabilityForProperty,
  compositionTicksToAnimationKeyframeTicks,
  planMoveEditorKeyframes,
  planSetEditorKeyframeEasing,
  planSetEditorKeyframeValues,
  projectAnimationKeyframeToCompositionTicks,
  type EditorAnimationTrackStateV1,
  type EditorKeyframeAddressV1,
  type VisualEasing,
} from '@sanverse/edit-domain'
import {
  resolvePrecisionTimeInput,
  ticksToFrameCount,
  type PrecisionFrameRateV1,
  type TimelineAnimationSubjectV1,
} from '../../features/timeline'

const EASINGS: Readonly<Record<string, VisualEasing>> = Object.freeze({
  linear: Object.freeze({ kind: 'linear' }),
  'ease-in': Object.freeze({ kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 }),
  'ease-out': Object.freeze({ kind: 'cubic-bezier', x1: 0, y1: 0, x2: 0.58, y2: 1 }),
  'ease-in-out': Object.freeze({ kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 }),
  'custom-bezier': Object.freeze({ kind: 'cubic-bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }),
  spring: Object.freeze({ kind: 'spring', mass: 1, stiffness: 170, damping: 26, velocity: 0 }),
  bounce: Object.freeze({ kind: 'bounce', intensity: 0.6 }),
})

export type TimelineKeyframeNumericPopoverProps = Readonly<{
  subject: TimelineAnimationSubjectV1
  state: EditorAnimationTrackStateV1
  address: EditorKeyframeAddressV1 | null
  timescale: number
  frameRate: PrecisionFrameRateV1
  compositionDurationTicks: number
  busy: boolean
  onCommit(state: EditorAnimationTrackStateV1): void
  onSelectionTimeChange(nextCanonicalTicks: number): void
  onNotice(message: string): void
}>

export function TimelineKeyframeNumericPopover({
  subject,
  state,
  address,
  timescale,
  frameRate,
  compositionDurationTicks,
  busy,
  onCommit,
  onSelectionTimeChange,
  onNotice,
}: TimelineKeyframeNumericPopoverProps) {
  const track = address ? state.tracks.find((candidate) => candidate.property === address.property) ?? null : null
  const frame = address && track ? track.keyframes.find((candidate) => candidate.at.ticks === address.canonicalAtTicks) ?? null : null
  const capability = address ? animationCapabilityForProperty(state.targetKind, address.property, state) : null
  const compositionTicks = address ? projectAnimationKeyframeToCompositionTicks(subject.timeContext, address.canonicalAtTicks) : null
  const [timeText, setTimeText] = useState('')
  const [valueText, setValueText] = useState('')
  const [easingText, setEasingText] = useState('linear')

  const canonicalSignature = `${address?.property ?? ''}:${address?.canonicalAtTicks ?? ''}:${frame?.value ?? ''}:${frame?.easing.kind ?? ''}`
  useEffect(() => {
    if (!address || !frame || compositionTicks === null) {
      setTimeText('')
      setValueText('')
      setEasingText('linear')
      return
    }
    setTimeText(`${ticksToFrameCount(compositionTicks, timescale, frameRate)}f`)
    setValueText(String(frame.value))
    setEasingText(frame.easing.kind === 'cubic-bezier' ? 'custom-bezier' : frame.easing.kind)
  }, [canonicalSignature, compositionTicks, frameRate, timescale])

  const lastTick = track?.keyframes.at(-1)?.at.ticks ?? null
  const outgoing = address !== null && lastTick !== address.canonicalAtTicks
  const unit = useMemo(() => capability?.unit === 'degrees' ? 'degrees' : capability?.property === 'scale' || capability?.unit === 'fraction' || capability?.unit === 'frame-fraction' ? 'domain value' : '', [capability])

  if (!address || !track || !frame || !capability || compositionTicks === null) return null

  const apply = () => {
    const resolved = resolvePrecisionTimeInput({
      text: timeText,
      baseTicks: compositionTicks,
      minTicks: 0,
      maxTicks: compositionDurationTicks,
      timescale,
      frameRate,
    })
    if (!resolved.ok) {
      onNotice(resolved.message)
      return
    }
    const canonical = compositionTicksToAnimationKeyframeTicks(subject.timeContext, resolved.ticks)
    if (canonical === null) {
      onNotice('That project time is outside this animation source range.')
      return
    }
    const value = Number(valueText)
    if (!Number.isFinite(value)) {
      onNotice('Enter a finite keyframe value.')
      return
    }
    const moved = canonical === address.canonicalAtTicks
      ? Object.freeze({ ok: true as const, state, selectedTicks: Object.freeze([canonical]) })
      : planMoveEditorKeyframes({ state, moves: [Object.freeze({ property: address.property, fromTicks: address.canonicalAtTicks, toTicks: canonical })] })
    if (!moved.ok) {
      onNotice(moved.refusal.message)
      return
    }
    const valued = planSetEditorKeyframeValues({ state: moved.state, updates: [Object.freeze({ property: address.property, canonicalAtTicks: canonical, value })] })
    if (!valued.ok) {
      onNotice(valued.refusal.message)
      return
    }
    let nextState = valued.state
    if (outgoing) {
      const easing = EASINGS[easingText]
      if (easing) {
        const eased = planSetEditorKeyframeEasing({ state: nextState, property: address.property, canonicalAtTicks: [canonical], easing })
        if (!eased.ok) {
          onNotice(eased.refusal.message)
          return
        }
        nextState = eased.state
      }
    }
    onCommit(nextState)
    onSelectionTimeChange(canonical)
    onNotice('Keyframe time, value and interpolation applied as one edit.')
  }

  return (
    <div className="timeline-keyframe-numeric" role="group" aria-label="Selected keyframe properties">
      <label>
        Time
        <input aria-label="Keyframe time" value={timeText} onChange={(event) => setTimeText(event.currentTarget.value)} placeholder="120f or +2f" />
      </label>
      <label>
        Value <span aria-hidden="true">({unit})</span>
        <input aria-label={`${capability.label} keyframe value`} type="number" step="0.01" value={valueText} onChange={(event) => setValueText(event.currentTarget.value)} />
      </label>
      <label>
        Interpolation
        <select aria-label="Keyframe interpolation" value={easingText} disabled={!outgoing} onChange={(event) => setEasingText(event.currentTarget.value)}>
          <option value="linear">Linear</option>
          <option value="ease-in">Ease In</option>
          <option value="ease-out">Ease Out</option>
          <option value="ease-in-out">Ease In-Out</option>
          <option value="custom-bezier">Custom Bezier</option>
          <option value="spring">Spring</option>
          <option value="bounce">Bounce</option>
        </select>
      </label>
      <button type="button" disabled={busy} onClick={apply}>Apply Keyframe</button>
      {!outgoing ? <span title="Interpolation applies from this keyframe to the next.">Final keyframe has no outgoing interpolation.</span> : null}
    </div>
  )
}
