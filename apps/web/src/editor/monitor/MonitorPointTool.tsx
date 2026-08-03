import type { Ref } from 'react'

export function MonitorPointTool({ active, selected, onToggle, buttonRef }: Readonly<{
  active: boolean
  selected: boolean
  onToggle(): void
  buttonRef?: Ref<HTMLButtonElement>
}>) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`monitor-tool monitor-point-tool${active ? ' monitor-tool--active' : ''}`}
      aria-label={active ? 'Cancel Point mode' : 'Enter Point mode'}
      aria-pressed={active}
      title="Point to a place in the frame"
      onClick={onToggle}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><circle cx="12" cy="12" r="1" /></svg>
      <span className="monitor-tool__label">Point</span>
      {selected ? <span className="monitor-point-tool__badge" title="Point selected"><span className="sr-only">Point selected</span></span> : null}
    </button>
  )
}
