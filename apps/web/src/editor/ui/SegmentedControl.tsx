import type { KeyboardEvent } from 'react'

export type SegmentedOption<T extends string> = Readonly<{
  value: T
  label: string
  description?: string
}>

export type SegmentedControlProps<T extends string> = {
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange(value: T): void
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  function move(event: KeyboardEvent<HTMLButtonElement>, direction: -1 | 1) {
    event.preventDefault()
    const current = options.findIndex((option) => option.value === value)
    const next = (current + direction + options.length) % options.length
    onChange(options[next].value)
  }

  return (
    <div className="sv-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="sv-segmented__option"
          aria-label={`${option.label} workspace`}
          aria-pressed={option.value === value}
          title={option.description}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(event, -1)
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(event, 1)
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
