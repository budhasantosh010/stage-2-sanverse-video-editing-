import type {
  InspectorBlockedSelection,
  InspectorProposalSelection,
} from './inspector-contract'

export function InspectorBlockedState({ selection }: { selection: InspectorBlockedSelection }) {
  return (
    <div className="inspector__notice inspector__notice--blocked" role="status">
      <strong>Needs attention</strong>
      <p>{selection.reason}</p>
      <p>Undo the edit that removed the target, or choose another current timeline item.</p>
    </div>
  )
}

export type InspectorProposalStateProps = Readonly<{
  selection: InspectorProposalSelection
  busy: boolean
  onAccept(): void
  onReject(): void
  onOpen(): void
}>

export function InspectorProposalState({
  selection,
  busy,
  onAccept,
  onReject,
  onOpen,
}: InspectorProposalStateProps) {
  const summary = selection.operation
    ? selection.operation.kind.replaceAll('-', ' ')
    : 'The proposed operation is no longer available.'

  return (
    <div className="inspector__proposal">
      <div className="inspector__notice" role="status">
        <strong>Pending — preview only</strong>
        <p>{summary}</p>
        <p>Accept or reject this proposal through the existing proposal controls.</p>
      </div>
      <div className="inspector__actions">
        <button type="button" disabled={busy} onClick={onReject}>Reject proposal</button>
        <button type="button" disabled={busy} onClick={onOpen}>Open in Assist</button>
        <button type="button" disabled={busy} onClick={onAccept}>Accept proposal</button>
      </div>
    </div>
  )
}
