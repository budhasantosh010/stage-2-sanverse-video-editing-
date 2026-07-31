export function CanvasInteractionToolbar({
  canCrop,
  cropMode,
  safeAreas,
  busy,
  modeLabel,
  onToggleCrop,
  onToggleSafeAreas,
  onDoneCrop,
  onResetCrop,
  onCancel,
}: Readonly<{
  canCrop: boolean
  cropMode: boolean
  safeAreas: boolean
  busy: boolean
  modeLabel: string
  onToggleCrop(): void
  onToggleSafeAreas(): void
  onDoneCrop(): void
  onResetCrop(): void
  onCancel(): void
}>) {
  return (
    <div className="canvas-interaction-toolbar" role="toolbar" aria-label="Canvas controls">
      <span>{modeLabel}</span>
      <button type="button" aria-pressed={safeAreas} onClick={onToggleSafeAreas}>Guides</button>
      {canCrop ? <button type="button" aria-pressed={cropMode} disabled={busy} onClick={onToggleCrop}>Crop</button> : null}
      {cropMode ? (
        <>
          <button type="button" disabled={busy} onClick={onDoneCrop}>Done</button>
          <button type="button" disabled={busy} onClick={onResetCrop}>Reset crop</button>
          <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
        </>
      ) : null}
    </div>
  )
}
