import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { Button } from './Button'

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  icon: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function IconButton({ label, icon, variant = 'ghost', className = '', ...props }: IconButtonProps) {
  return (
    <Button
      {...props}
      className={`sv-icon-button ${className}`.trim()}
      variant={variant}
      density="compact"
      aria-label={label}
      title={props.title ?? label}
    >
      <span aria-hidden="true">{icon}</span>
    </Button>
  )
}
