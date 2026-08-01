import { useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'

export function WorkspaceSplitter({
  label,
  className = '',
  orientation,
  value,
  minimum,
  maximum,
  direction = 1,
  smallStep = 12,
  largeStep = 40,
  onChange,
  onCommit,
  onCancel,
}: Readonly<{
  label: string
  className?: string
  orientation: 'horizontal' | 'vertical'
  value: number
  minimum: number
  maximum: number
  direction?: 1 | -1
  smallStep?: number
  largeStep?: number
  onChange(value: number): void
  onCommit(value: number): void
  onCancel(value: number): void
}>) {
  const session = useRef<Readonly<{ pointerId: number; startCoordinate: number; startValue: number }> | null>(null)
  const latestValue = useRef(value)
  latestValue.current = value
  const clamp = (next: number) => Math.min(maximum, Math.max(minimum, next))

  useEffect(() => {
    const cancel = (event: globalThis.KeyboardEvent) => {
      const current = session.current
      if (!current || event.key !== 'Escape') return
      event.preventDefault()
      session.current = null
      latestValue.current = current.startValue
      onChange(current.startValue)
      onCancel(current.startValue)
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [onCancel, onChange])

  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const negative = orientation === 'horizontal' ? event.key === 'ArrowLeft' : event.key === 'ArrowUp'
    const positive = orientation === 'horizontal' ? event.key === 'ArrowRight' : event.key === 'ArrowDown'
    let next: number | null = null
    if (negative) next = value - (event.shiftKey ? largeStep : smallStep) * direction
    else if (positive) next = value + (event.shiftKey ? largeStep : smallStep) * direction
    else if (event.key === 'Home') next = minimum
    else if (event.key === 'End') next = maximum
    else if (event.key === 'Escape') {
      event.preventDefault()
      onCancel(value)
      return
    }
    if (next === null) return
    event.preventDefault()
    const bounded = clamp(next)
    latestValue.current = bounded
    onChange(bounded)
    onCommit(bounded)
  }

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    latestValue.current = value
    session.current = Object.freeze({
      pointerId: event.pointerId,
      startCoordinate: orientation === 'horizontal' ? event.clientX : event.clientY,
      startValue: value,
    })
  }

  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = session.current
    if (!current || current.pointerId !== event.pointerId) return
    const coordinate = orientation === 'horizontal' ? event.clientX : event.clientY
    const next = clamp(current.startValue + (coordinate - current.startCoordinate) * direction)
    latestValue.current = next
    onChange(next)
  }

  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = session.current
    if (!current || current.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    session.current = null
    onCommit(clamp(latestValue.current))
  }

  const pointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = session.current
    if (!current || current.pointerId !== event.pointerId) return
    session.current = null
    latestValue.current = current.startValue
    onChange(current.startValue)
    onCancel(current.startValue)
  }

  return (
    <div
      className={`workspace-splitter workspace-splitter--${orientation}${className ? ` ${className}` : ''}`}
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={Math.round(minimum)}
      aria-valuemax={Math.round(maximum)}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      onKeyDown={key}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerCancel}
    >
      <span aria-hidden="true" />
    </div>
  )
}
