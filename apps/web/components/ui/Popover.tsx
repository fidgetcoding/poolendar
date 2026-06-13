'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type PopoverPosition = 'top' | 'bottom' | 'left' | 'right'

export interface PopoverProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  position?: PopoverPosition
  className?: string
  children: React.ReactNode
}

interface Coords {
  top: number
  left: number
  actualPosition: PopoverPosition
}

const GAP = 8
const VIEWPORT_PADDING = 12

function computePosition(
  anchor: DOMRect,
  popover: DOMRect,
  preferred: PopoverPosition
): Coords {
  const positions: PopoverPosition[] = [preferred, 'bottom', 'top', 'right', 'left']

  for (const pos of positions) {
    let top = 0
    let left = 0

    switch (pos) {
      case 'bottom':
        top = anchor.bottom + GAP
        left = anchor.left + anchor.width / 2 - popover.width / 2
        break
      case 'top':
        top = anchor.top - popover.height - GAP
        left = anchor.left + anchor.width / 2 - popover.width / 2
        break
      case 'right':
        top = anchor.top + anchor.height / 2 - popover.height / 2
        left = anchor.right + GAP
        break
      case 'left':
        top = anchor.top + anchor.height / 2 - popover.height / 2
        left = anchor.left - popover.width - GAP
        break
    }

    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, window.innerWidth - popover.width - VIEWPORT_PADDING)
    )
    top = Math.max(
      VIEWPORT_PADDING,
      Math.min(top, window.innerHeight - popover.height - VIEWPORT_PADDING)
    )

    const fitsH = left >= VIEWPORT_PADDING && left + popover.width <= window.innerWidth - VIEWPORT_PADDING
    const fitsV = top >= VIEWPORT_PADDING && top + popover.height <= window.innerHeight - VIEWPORT_PADDING

    if (fitsH && fitsV) {
      return { top, left, actualPosition: pos }
    }
  }

  return {
    top: Math.max(VIEWPORT_PADDING, anchor.bottom + GAP),
    left: Math.max(
      VIEWPORT_PADDING,
      anchor.left + anchor.width / 2 - popover.width / 2
    ),
    actualPosition: 'bottom',
  }
}

function Popover({
  open,
  onClose,
  anchorRef,
  position = 'bottom',
  className,
  children,
}: PopoverProps) {
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const [coords, setCoords] = React.useState<Coords | null>(null)
  const [isVisible, setIsVisible] = React.useState(false)
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setIsMounted(true)
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
    } else {
      setIsVisible(false)
      const timer = setTimeout(() => {
        setIsMounted(false)
        setCoords(null)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [open])

  React.useEffect(() => {
    if (!isMounted || !anchorRef.current || !popoverRef.current) return

    function updatePosition() {
      if (!anchorRef.current || !popoverRef.current) return
      const anchorRect = anchorRef.current.getBoundingClientRect()
      const popoverRect = popoverRef.current.getBoundingClientRect()
      setCoords(computePosition(anchorRect, popoverRect, position))
    }

    updatePosition()

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isMounted, anchorRef, position])

  React.useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose()
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose, anchorRef])

  if (!isMounted) return null

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      className={cn(
        'fixed z-50',
        'rounded-lg border border-[var(--border)]',
        'bg-[var(--surface)] shadow-xl shadow-black/40',
        'transition-opacity duration-150',
        isVisible && coords ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        top: coords ? coords.top : -9999,
        left: coords ? coords.left : -9999,
        visibility: coords ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body
  )
}

export { Popover }
