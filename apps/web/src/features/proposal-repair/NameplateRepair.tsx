import { useEffect, useState } from 'react'
import { toMilliseconds, type AddNameplateOperation } from '@sanverse/edit-domain'

import type { ProposalRepair } from '../../app/app-state'
import { formatPointTargetTime } from '../point-target/point-target'
import './NameplateRepair.css'

export type NameplateRepairProps = {
  proposal: AddNameplateOperation
  /** Where the video is right now, so "start here" means something. */
  playheadMs: number
  /** True while the user is re-pointing this proposal. */
  isMovingPoint: boolean
  onRepair(repair: ProposalRepair): void
  onMovePoint(): void
}

const secondsOf = (milliseconds: number) => Number((milliseconds / 1_000).toFixed(1))

/**
 * Fix a proposal by hand instead of asking again.
 *
 * Asking again throws away everything that was already right and returns an
 * answer that has to be judged from scratch. Changing the wording or the timing
 * keeps the rest exactly as approved. Nothing here calls the assistant.
 */
export function NameplateRepair({ proposal, playheadMs, isMovingPoint, onRepair, onMovePoint }: NameplateRepairProps) {
  const startMs = toMilliseconds(proposal.compositionInterval.start)
  const durationMs = toMilliseconds(proposal.compositionInterval.duration)

  const [primaryText, setPrimaryText] = useState(proposal.primaryText)
  const [secondaryText, setSecondaryText] = useState(proposal.secondaryText)
  const [seconds, setSeconds] = useState(String(secondsOf(durationMs)))

  // A different proposal means different values in the boxes.
  useEffect(() => {
    setPrimaryText(proposal.primaryText)
    setSecondaryText(proposal.secondaryText)
    setSeconds(String(secondsOf(toMilliseconds(proposal.compositionInterval.duration))))
  }, [proposal.operationId, proposal.primaryText, proposal.secondaryText, proposal.compositionInterval.duration])

  const commitDuration = () => {
    const parsed = Number(seconds)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSeconds(String(secondsOf(durationMs)))
      return
    }
    onRepair({ durationMs: Math.round(parsed * 1_000) })
  }

  return (
    <section className="nameplate-repair" aria-labelledby="nameplate-repair-title">
      <h3 id="nameplate-repair-title">Change it</h3>

      <label htmlFor="repair-primary">Main text</label>
      <input
        id="repair-primary"
        value={primaryText}
        onChange={(event) => setPrimaryText(event.target.value)}
        onBlur={() => {
          if (primaryText.trim() !== proposal.primaryText) onRepair({ primaryText })
        }}
      />

      <label htmlFor="repair-secondary">Smaller line</label>
      <input
        id="repair-secondary"
        value={secondaryText}
        onChange={(event) => setSecondaryText(event.target.value)}
        onBlur={() => {
          if (secondaryText.trim() !== proposal.secondaryText) onRepair({ secondaryText })
        }}
      />

      <label htmlFor="repair-seconds">Visible for (seconds)</label>
      <input
        id="repair-seconds"
        type="number"
        min="0.5"
        step="0.5"
        value={seconds}
        onChange={(event) => setSeconds(event.target.value)}
        onBlur={commitDuration}
      />

      <div className="nameplate-repair__actions">
        <button type="button" onClick={() => onRepair({ startMs: playheadMs })}>
          Start at {formatPointTargetTime(playheadMs)}
        </button>
        <button type="button" aria-pressed={isMovingPoint} onClick={onMovePoint}>
          {isMovingPoint ? 'Cancel move' : 'Move it'}
        </button>
      </div>

      <p className="nameplate-repair__hint">
        Starts at {formatPointTargetTime(startMs)}. Nothing is saved until you accept it.
      </p>
    </section>
  )
}
