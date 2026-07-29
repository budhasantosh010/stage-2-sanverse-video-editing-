import type { ReactNode } from 'react'

export type TabItem<T extends string> = Readonly<{
  value: T
  label: string
  content: ReactNode
}>

export type TabsProps<T extends string> = {
  label: string
  value: T
  items: readonly TabItem<T>[]
  onChange(value: T): void
}

export function Tabs<T extends string>({ label, value, items, onChange }: TabsProps<T>) {
  const active = items.find((item) => item.value === value)

  return (
    <div className="sv-tabs">
      <div className="sv-tabs__list" role="tablist" aria-label={label}>
        {items.map((item) => (
          <button
            key={item.value}
            id={`sv-tab-${item.value}`}
            type="button"
            role="tab"
            aria-selected={item.value === value}
            aria-controls={`sv-panel-${item.value}`}
            tabIndex={item.value === value ? 0 : -1}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {active ? (
        <div
          id={`sv-panel-${active.value}`}
          role="tabpanel"
          aria-labelledby={`sv-tab-${active.value}`}
        >
          {active.content}
        </div>
      ) : null}
    </div>
  )
}
