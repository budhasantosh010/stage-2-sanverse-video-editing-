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
    <div className="inspector-section__footer" data-draft-state={dirty ? 'changed' : 'saved'}>
      {dirty ? <p className="inspector-section__draft-status" role="status">Changes not applied yet.</p> : null}
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
