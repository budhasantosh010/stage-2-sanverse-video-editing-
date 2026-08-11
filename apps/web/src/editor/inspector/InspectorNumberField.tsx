import type { KeyboardEvent } from 'react'

const clamp = (value: number, min?: number, max?: number): number => {
  let next = value
  if (typeof min === 'number') next = Math.max(min, next)
  if (typeof max === 'number') next = Math.min(max, next)
  return next
}

/**
 * One numeric interaction language for the Inspector.
 *
 * The field changes a section DRAFT only. The surrounding section decides when
 * that draft becomes one accepted edit (usually Apply for multi-field forms).
 * Arrow keys use the declared step; Shift+Arrow makes the same adjustment ten
 * times larger. Invalid text never becomes a project value.
 */
export function InspectorNumberField({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
}: Readonly<{
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange(value: number): void
}>) {
  const commitParsed = (raw: string) => {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    onChange(clamp(parsed, min, max))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
      return
    }
    if (!event.shiftKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    const direction = event.key === 'ArrowUp' ? 1 : -1
    const largerStep = Math.max(Number.EPSILON, step) * 10
    onChange(clamp(value + direction * largerStep, min, max))
  }

  return (
    <label className="inspector-field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => commitParsed(event.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
    </label>
  )
}
