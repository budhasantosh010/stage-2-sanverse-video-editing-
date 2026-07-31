import type { ReactNode } from 'react'

export function InspectorRow({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="inspector-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
