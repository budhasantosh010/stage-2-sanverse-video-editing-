import { useId, useState, type ReactNode } from 'react'

export type InspectorSectionProps = Readonly<{
  title: string
  description?: string
  defaultOpen?: boolean
  advanced?: boolean
  children: ReactNode
}>

export function InspectorSection({
  title,
  description,
  defaultOpen = false,
  advanced = false,
  children,
}: InspectorSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <section className={`inspector-section${advanced ? ' inspector-section--advanced' : ''}`}>
      <button
        type="button"
        className="inspector-section__toggle"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <strong>{title}</strong>
          {description ? <small>{description}</small> : null}
        </span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div id={contentId} className="inspector-section__content" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
