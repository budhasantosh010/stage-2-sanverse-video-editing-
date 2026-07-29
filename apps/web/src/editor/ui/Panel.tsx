import type { HTMLAttributes, ReactNode } from 'react'

export type PanelProps = HTMLAttributes<HTMLElement> & {
  title?: string
  action?: ReactNode
  children: ReactNode
}

export function Panel({ title, action, className = '', children, ...props }: PanelProps) {
  return (
    <section {...props} className={`sv-panel ${className}`.trim()}>
      {title || action ? (
        <header className="sv-panel__header">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      <div className="sv-panel__body">{children}</div>
    </section>
  )
}
