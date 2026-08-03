import { useEffect, useRef, useState, type ReactNode } from 'react'

export function MonitorOverflowMenu({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  return <div className="monitor-overflow"><button ref={buttonRef} type="button" className="monitor-tool" aria-label="More monitor options" aria-expanded={open} onClick={() => setOpen((value) => !value)}>•••</button>{open ? <div className="monitor-overflow__menu" role="menu">{children}</div> : null}</div>
}
