export function InspectorSectionActions({
  dirty,
  busy,
  working,
  notice,
  onApply,
  onReset,
}: Readonly<{
  dirty: boolean
  busy: boolean
  working: boolean
  notice: string | null
  onApply(): void
  onReset(): void
}>) {
  return (
    <div className="inspector-section__footer">
      <div className="inspector__actions">
        <button type="button" disabled={!dirty || busy || working} onClick={onApply}>
          {working ? 'Applying…' : 'Apply'}
        </button>
        <button type="button" disabled={!dirty || working} onClick={onReset}>Reset</button>
      </div>
      {notice ? <p className="inspector-section__notice" role="status">{notice}</p> : null}
    </div>
  )
}
