import { useEffect, useState } from 'react'
import {
  planSetEditorKeyframeEasing,
  type EditorAnimationPropertyIdV1,
  type EditorAnimationTrackStateV1,
  type VisualEasing,
  type VisualKeyframe,
} from '@sanverse/edit-domain'

const PRESETS: Readonly<Record<string, VisualEasing>> = Object.freeze({
  Linear: Object.freeze({ kind: 'linear' }),
  'Ease In': Object.freeze({ kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 }),
  'Ease Out': Object.freeze({ kind: 'cubic-bezier', x1: 0, y1: 0, x2: 0.58, y2: 1 }),
  'Ease In-Out': Object.freeze({ kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 }),
  'Custom Bezier': Object.freeze({ kind: 'cubic-bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }),
  Spring: Object.freeze({ kind: 'spring', mass: 1, stiffness: 170, damping: 26, velocity: 0 }),
  Bounce: Object.freeze({ kind: 'bounce', intensity: 0.6 }),
})

export type TimelineGraphInterpolationControlsProps = Readonly<{
  state: EditorAnimationTrackStateV1
  property: EditorAnimationPropertyIdV1
  selectedTicks: readonly number[]
  selectedFrame: VisualKeyframe | null
  hasNextFrame: boolean
  busy: boolean
  onCommit(state: EditorAnimationTrackStateV1): void
  onNotice(message: string): void
}>

export function TimelineGraphInterpolationControls({
  state,
  property,
  selectedTicks,
  selectedFrame,
  hasNextFrame,
  busy,
  onCommit,
  onNotice,
}: TimelineGraphInterpolationControlsProps) {
  const [spring, setSpring] = useState<Extract<VisualEasing, { kind: 'spring' }>>(
    selectedFrame?.easing.kind === 'spring'
      ? selectedFrame.easing
      : Object.freeze({ kind: 'spring', mass: 1, stiffness: 170, damping: 26, velocity: 0 }),
  )
  const [bounce, setBounce] = useState(
    selectedFrame?.easing.kind === 'bounce' ? selectedFrame.easing.intensity : 0.6,
  )

  useEffect(() => {
    if (selectedFrame?.easing.kind === 'spring') setSpring(selectedFrame.easing)
    if (selectedFrame?.easing.kind === 'bounce') setBounce(selectedFrame.easing.intensity)
  }, [selectedFrame])

  const apply = (easing: VisualEasing) => {
    const planned = planSetEditorKeyframeEasing({ state, property, canonicalAtTicks: selectedTicks, easing })
    if (!planned.ok) {
      onNotice(planned.refusal.message)
      return
    }
    onCommit(planned.state)
    onNotice('Interpolation updated. Undo restores the previous curve.')
  }

  const disabled = busy || selectedTicks.length === 0 || !hasNextFrame

  return (
    <div className="timeline-graph__interpolation" aria-label="Interpolation controls">
      {Object.entries(PRESETS).map(([label, easing]) => (
        <button type="button" key={label} disabled={disabled} onClick={() => apply(easing)}>{label}</button>
      ))}
      {!hasNextFrame && selectedFrame ? (
        <span title="Interpolation applies from this keyframe to the next.">Final keyframe has no outgoing interpolation.</span>
      ) : null}
      {selectedFrame?.easing.kind === 'spring' ? (
        <fieldset className="timeline-graph__parameters">
          <legend>Spring</legend>
          {(['mass', 'stiffness', 'damping', 'velocity'] as const).map((field) => (
            <label key={field}>
              {field}
              <input
                type="number"
                value={spring[field]}
                step={field === 'stiffness' ? 1 : 0.1}
                onChange={(event) => setSpring(Object.freeze({ ...spring, [field]: Number(event.currentTarget.value) }))}
              />
            </label>
          ))}
          <button type="button" disabled={disabled} onClick={() => apply(spring)}>Apply spring</button>
        </fieldset>
      ) : null}
      {selectedFrame?.easing.kind === 'bounce' ? (
        <fieldset className="timeline-graph__parameters">
          <legend>Bounce</legend>
          <label>
            intensity
            <input type="number" min="0" max="1" step="0.05" value={bounce} onChange={(event) => setBounce(Number(event.currentTarget.value))} />
          </label>
          <button type="button" disabled={disabled} onClick={() => apply(Object.freeze({ kind: 'bounce', intensity: bounce }))}>Apply bounce</button>
        </fieldset>
      ) : null}
    </div>
  )
}
