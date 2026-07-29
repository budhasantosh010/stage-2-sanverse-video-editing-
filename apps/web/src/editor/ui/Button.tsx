import type { ButtonHTMLAttributes, ReactNode } from 'react'

import './ui.css'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  density?: 'regular' | 'compact'
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  density = 'regular',
  loading = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`sv-button sv-button--${variant} sv-button--${density} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="sv-button__spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  )
}
