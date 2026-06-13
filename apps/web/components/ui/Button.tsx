'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-lg font-medium',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
    'disabled:pointer-events-none disabled:opacity-50',
    'cursor-pointer',
    'select-none',
  ],
  {
    variants: {
      variant: {
        default:
          'bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)]',
        outline:
          'border border-[var(--border)] bg-transparent text-[var(--fg)] hover:bg-[var(--surface-hover)] hover:border-[var(--muted)]',
        ghost:
          'bg-transparent text-[var(--fg)] hover:bg-[var(--surface-hover)]',
        destructive:
          'bg-[var(--destructive)] text-white hover:bg-[#dc2626]',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        default: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<
        React.HTMLAttributes<HTMLElement> & { className?: string }
      >
      return React.cloneElement(child, {
        ...props,
        ...child.props,
        className: cn(buttonVariants({ variant, size }), className, child.props.className),
        ref,
      } as React.HTMLAttributes<HTMLElement>)
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
