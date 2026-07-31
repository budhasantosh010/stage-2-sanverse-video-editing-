import type { InspectorGapSelection, InspectorNothingSelection } from './inspector-contract'

export function InspectorEmptyState({ selection }: { selection: InspectorNothingSelection }) {
  return (
    <div className="inspector__empty">
      <strong>Nothing selected</strong>
      <p>Select an item in the timeline to inspect its settings.</p>
    </div>
  )
}

export function InspectorGapState({ selection }: { selection: InspectorGapSelection }) {
  return (
    <div className="inspector__empty">
      <strong>Gap</strong>
      <p>This empty stretch is part of the current timeline.</p>
      <p>Use the timeline to trim, move, or remove the surrounding clips.</p>
      <dl className="inspector__facts">
        <div><dt>Start</dt><dd>{selection.startTicks} ticks</dd></div>
        <div><dt>Duration</dt><dd>{selection.durationTicks} ticks</dd></div>
      </dl>
    </div>
  )
}
