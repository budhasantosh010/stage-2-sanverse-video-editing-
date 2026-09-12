import type { SyntheticEvent } from 'react'

/** Keep the disclosure's contents mounted, but lift the panel out of clipped docks. */
export function toggleDetailsPopover(event: SyntheticEvent<HTMLDetailsElement>) {
  if (event.target !== event.currentTarget) return
  const details = event.currentTarget
  const panel = details.querySelector<HTMLElement>(':scope > [popover]')
  if (!panel || typeof panel.showPopover !== 'function') return
  if (!details.open) {
    if (panel.matches(':popover-open')) panel.hidePopover()
    return
  }
  panel.showPopover()
  const anchor = details.querySelector('summary')?.getBoundingClientRect()
  if (!anchor) return
  const rect = panel.getBoundingClientRect()
  const left = Math.max(8, Math.min(window.innerWidth - rect.width - 8, anchor.right - rect.width))
  const preferredTop = anchor.top >= rect.height + 16 ? anchor.top - rect.height - 8 : anchor.bottom + 8
  const top = Math.max(8, Math.min(window.innerHeight - rect.height - 8, preferredTop))
  panel.style.left = `${left}px`
  panel.style.top = `${top}px`
}

/** Native Escape/outside-click dismissal must also reset the disclosure arrow. */
export function syncPopoverDisclosure(event: SyntheticEvent<HTMLDivElement>) {
  if (event.target !== event.currentTarget) return
  const panel = event.currentTarget
  if (typeof panel.showPopover !== 'function' || panel.matches(':popover-open')) return
  const details = panel.closest('details')
  if (details) details.open = false
}
