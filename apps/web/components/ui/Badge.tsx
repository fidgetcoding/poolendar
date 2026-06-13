'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1.5',
    'rounded-full px-2.5 py-0.5',
    'text-xs font-medium',
    'select-none',
  ],
  {
    variants: {
      variant: {
        default: 'bg-[var(--accent)] text-[var(--bg)]',
        secondary: 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]',
        outline: 'bg-transparent text-[var(--fg)] border border-[var(--border)]',
        destructive: 'bg-[var(--destructive)] text-white',
        success: 'bg-[var(--success)] text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
  dotColor?: string
}

function Badge({
  className,
  variant,
  dot,
  dotColor,
  children,
  ...props
}: BadgeProps) {
  const defaultDotColors: Record<string, string> = {
    default: 'var(--bg)',
    secondary: 'var(--muted)',
    outline: 'var(--fg)',
    destructive: '#ffffff',
    success: '#ffffff',
  }

  const resolvedDotColor =
    dotColor || defaultDotColors[variant || 'default'] || 'var(--fg)'

  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: resolvedDotColor }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
