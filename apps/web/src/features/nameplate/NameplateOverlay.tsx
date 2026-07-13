import type { AddNameplateAction } from '@sanverse/edit-domain'

import './NameplateOverlay.css'

export type NameplateOverlayProps = {
  action: AddNameplateAction
  currentTimeMs: number
}

export function NameplateOverlay({ action, currentTimeMs }: NameplateOverlayProps) {
  const endMs = action.startMs + action.durationMs
  if (
    !Number.isFinite(currentTimeMs) ||
    currentTimeMs < 0 ||
    currentTimeMs < action.startMs ||
    currentTimeMs >= endMs
  ) {
    return null
  }

  return (
    <div
      className="nameplate-overlay"
      data-testid="nameplate-overlay"
      style={{ left: `${action.target.x * 100}%`, top: `${action.target.y * 100}%` }}
    >
      <strong>{action.primaryText}</strong>
      {action.secondaryText ? <span>{action.secondaryText}</span> : null}
    </div>
  )
}
