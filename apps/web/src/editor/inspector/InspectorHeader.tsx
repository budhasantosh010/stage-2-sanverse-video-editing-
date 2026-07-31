import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

import type { InspectorSelection } from './inspector-contract'

const kindLabel = (selection: Exclude<InspectorSelection, { kind: 'nothing' }>): string => {
  if (selection.kind === 'video') return 'Video clip'
  if (selection.kind === 'dialogue') return 'Dialogue'
  if (selection.kind === 'media-overlay') return 'Media overlay'
  if (selection.kind === 'nameplate') return 'Nameplate'
  if (selection.kind === 'caption') return 'Caption cue'
  if (selection.kind === 'proposal') return 'Proposed edit'
  if (selection.kind === 'blocked') return 'Blocked edit'
  return selection.kind[0].toUpperCase() + selection.kind.slice(1)
}

const stateLabel = (selection: InspectorSelection): string => {
  if (selection.kind === 'nothing' || selection.kind === 'gap') return 'Read only'
  if (selection.kind === 'proposal') return 'Pending'
  if (selection.kind === 'blocked') return 'Needs attention'
  return 'Editable'
}

const seconds = (ticks: number): string => {
  const value = ticks / PROJECT_TIMESCALE
  const rendered = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${rendered} s`
}

export function InspectorHeader({ selection }: { selection: InspectorSelection }) {
  const title = selection.kind === 'nothing' ? 'Inspector' : selection.label
  return (
    <header className="inspector__header" aria-live="polite">
      <div className="inspector__header-copy">
        <span className="inspector__kind">
          {selection.kind === 'nothing' ? 'Timeline item' : kindLabel(selection)}
        </span>
        <h2>{title}</h2>
        {selection.kind === 'nothing' ? null : (
          <p>{seconds(selection.startTicks)} · {seconds(selection.durationTicks)}</p>
        )}
      </div>
      <span className={`inspector__state inspector__state--${selection.state}`}>
        {stateLabel(selection)}
      </span>
    </header>
  )
}
