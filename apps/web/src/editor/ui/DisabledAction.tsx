import { useId, type ReactElement } from 'react'

export type DisabledActionProps = {
  disabled: boolean
  label: string
  reason: string | null
  children: ReactElement
}

export function DisabledAction({
  disabled,
  label,
  reason,
  children,
}: DisabledActionProps) {
  const reasonId = useId()

  if (!disabled) {
    return <span className="sv-disabled-action">{children}</span>
  }

  return (
    <span
      className="sv-disabled-action sv-disabled-action--disabled"
      role="group"
      aria-label={`${label} unavailable`}
      aria-describedby={reason ? reasonId : undefined}
      tabIndex={0}
    >
      {children}
      {reason ? (
        <span id={reasonId} role="tooltip" className="sv-disabled-action__reason">
          {reason}
        </span>
      ) : null}
    </span>
  )
}
