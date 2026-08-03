import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/**
 * One popup menu, used by Import, Sort, Folder, More and the row actions.
 *
 * There is one of these rather than five because the fiddly parts are identical
 * every time and are exactly the parts that get forgotten:
 *
 *   Escape closes it            and focus goes BACK to the button
 *   clicking elsewhere closes   without swallowing that click's real target
 *   the first item is focused   so a keyboard user is not stranded
 *   the button says open/closed to a screen reader (aria-expanded)
 *
 * "Focus returns to the button" is the one people skip. Without it, pressing
 * Escape leaves focus on nothing, and the next Tab starts again from the top of
 * the page — a keyboard user has to walk the whole panel to get back to where
 * they were.
 */
export function MediaMenu({
  label,
  trigger,
  title,
  disabled = false,
  align = 'start',
  className = '',
  children,
}: Readonly<{
  /** Accessible name of the button, e.g. "Import media". */
  label: string
  /** What the button shows. */
  trigger: ReactNode
  /** Accessible name of the menu itself. */
  title: string
  disabled?: boolean
  align?: 'start' | 'end'
  className?: string
  /** Menu items. Receives `close` so an item can dismiss the menu. */
  children(close: () => void): ReactNode
}>) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]:not(:disabled)')?.focus()
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null
      if (target && (menuRef.current?.contains(target) || buttonRef.current?.contains(target))) return
      // Closed WITHOUT stealing focus back: the user is clicking something
      // else, and yanking focus to the button would undo their click.
      setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  // A disabled control cannot be left open behind a busy state.
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])

  return (
    <div className={`media-menu${className ? ` ${className}` : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        className="media-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={title}
          className={`media-menu__panel media-menu__panel--${align}`}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  )
}
