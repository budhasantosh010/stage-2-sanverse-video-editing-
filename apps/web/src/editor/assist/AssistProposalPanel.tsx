import { useRef, type ReactNode, type RefObject } from 'react'

import type { ConversationState, PendingProposal } from '../../app/app-state'
import './AssistProposalPanel.css'

export type AssistProposalPanelProps = {
  proposal: PendingProposal | null
  conversation: ConversationState
  editError: string | null
  placedStartMs: number
  durationMs: number
  summaryRef: RefObject<HTMLDivElement | null>
  onAccept(): void
  onReject(): void
  onOpenStudio(): void
  showOpenStudio?: boolean
  children?: ReactNode
}

function formatClock(milliseconds: number) {
  const totalSeconds = Math.max(0, milliseconds) / 1_000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = (totalSeconds % 60).toFixed(1).padStart(4, '0')
  return `${minutes}:${seconds}`
}

function formatDuration(milliseconds: number) {
  const seconds = milliseconds / 1_000
  const value = Number.isInteger(seconds) ? seconds : seconds.toFixed(1)
  return `${value} ${seconds === 1 ? 'second' : 'seconds'}`
}

export function AssistProposalPanel({
  proposal,
  conversation,
  editError,
  placedStartMs,
  durationMs,
  summaryRef,
  onAccept,
  onReject,
  onOpenStudio,
  showOpenStudio = true,
  children,
}: AssistProposalPanelProps) {
  const repairRef = useRef<HTMLDivElement>(null)
  const busy = conversation.status === 'sending'

  return (
    <section className="assist-proposal" aria-labelledby="assist-proposal-title">
      <div className="assist-proposal__heading">
        <h3 id="assist-proposal-title">Proposal</h3>
        {proposal ? <span>Pending — preview only</span> : null}
      </div>

      {busy ? (
        <p role="status">Preparing a proposal… Nothing has changed yet.</p>
      ) : null}

      {!proposal && !busy ? (
        <>
          <div className="assist-proposal__empty">
            <strong>Tell Sanverse what you want to change.</strong>
            <span>Pause and point when location matters.</span>
            <span>Nothing changes until you accept.</span>
          </div>
        </>
      ) : null}

      {proposal ? (
        <>
          <div
            ref={summaryRef}
            className="assist-proposal__summary"
            role="status"
            tabIndex={-1}
          >
            <strong>{proposal.operation.primaryText}</strong>
            {proposal.operation.secondaryText ? <span>{proposal.operation.secondaryText}</span> : null}
            <small>
              Starts {formatClock(placedStartMs)} · {formatDuration(durationMs)} · 1 change
            </small>
            <small>
              {proposal.origin.source === 'ai' ? 'Suggested by the assistant' : 'Made by you'}
            </small>
            {proposal.origin.explanation ? <p>{proposal.origin.explanation}</p> : null}
            {proposal.origin.note ? <p>{proposal.origin.note}</p> : null}
          </div>
          <div ref={repairRef} className="assist-proposal__repair">
            {children}
          </div>
          <div className="assist-proposal__actions">
            {children ? (
              <button
                type="button"
                onClick={() => repairRef.current?.querySelector<HTMLElement>('input, button')?.focus()}
              >
                Refine proposal
              </button>
            ) : null}
            {showOpenStudio ? (
              <button type="button" onClick={onOpenStudio}>
                Open proposal in Studio
              </button>
            ) : null}
            <button type="button" onClick={onReject}>
              Reject proposal
            </button>
            <button type="button" className="assist-proposal__accept" onClick={onAccept}>
              Accept proposal
            </button>
          </div>
        </>
      ) : null}

      {editError ? <p className="assist-proposal__error" role="alert">{editError}</p> : null}
    </section>
  )
}
