import type { ReactNode } from 'react'

export function StudioPanelFrame({ label, kind, children }: Readonly<{ label: string; kind: string; children: ReactNode }>) {
  return <section className={`studio-layout-v2__frame studio-layout-v2__frame--${kind}`} aria-label={label}>{children}</section>
}
