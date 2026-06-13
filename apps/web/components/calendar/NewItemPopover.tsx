'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NewItemPopoverProps {
  date: Date
  startTime: Date
  endTime?: Date
  anchorRect: DOMRect | null
  onClose: () => void
  onQuickCreate: (title: string, type: 'event' | 'task') => void
  onOpenFullForm: (title: string, type: 'event' | 'task') => void
}

const POPOVER_WIDTH = 280
const POPOVER_HEIGHT_ESTIMATE = 200
const VIEWPORT_PADDING = 12
const GAP = 8

function computePopoverPosition(anchor: DOMRect): { top: number; left: number } {
  let left = anchor.right + GAP
  let top = anchor.top

  if (left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_PADDING) {
    left = anchor.left - POPOVER_WIDTH - GAP
  }
  if (left < VIEWPORT_PADDING) {
    left = VIEWPORT_PADDING
  }

  if (top + POPOVER_HEIGHT_ESTIMATE > window.innerHeight - VIEWPORT_PADDING) {
    top = window.innerHeight - POPOVER_HEIGHT_ESTIMATE - VIEWPORT_PADDING
  }
  if (top < VIEWPORT_PADDING) {
    top = VIEWPORT_PADDING
  }

  return { top, left }
}

export function NewItemPopover({
  startTime,
  endTime: endTimeProp,
  anchorRect,
  onClose,
  onQuickCreate,
  onOpenFullForm,
}: NewItemPopoverProps) {
  const [title, setTitle] = React.useState('')
  const [itemType, setItemType] = React.useState<'event' | 'task'>('event')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  React.useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onQuickCreate(trimmed, itemType)
  }

  function handleMoreOptions() {
    onOpenFullForm(title.trim(), itemType)
  }

  if (!isMounted || !anchorRect) return null

  const endTime = endTimeProp ?? new Date(startTime.getTime() + 15 * 60 * 1000)
  const timeLabel = `${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')}`
  const position = computePopoverPosition(anchorRect)

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      className={cn(
        'fixed z-50',
        'rounded-lg border border-[var(--border)]',
        'bg-[var(--surface)] shadow-xl shadow-black/40',
        'animate-in fade-in-0 zoom-in-95 duration-150'
      )}
      style={{
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
      }}
    >
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-xs text-[var(--muted)]">{timeLabel}</span>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'flex items-center justify-center w-6 h-6 rounded',
              'text-[var(--muted)] hover:text-[var(--fg)]',
              'hover:bg-[var(--surface-hover)]',
              'transition-colors duration-150'
            )}
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-3 pb-3">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title"
            className={cn(
              'w-full h-9 px-2 text-sm rounded-md',
              'bg-[var(--bg)] text-[var(--fg)]',
              'border border-[var(--border)]',
              'placeholder:text-[var(--muted)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 focus:ring-offset-[var(--surface)]'
            )}
          />
        </div>

        <div className="px-3 pb-3">
          <div
            className={cn(
              'flex rounded-md overflow-hidden',
              'border border-[var(--border)]'
            )}
          >
            <button
              type="button"
              onClick={() => setItemType('event')}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium',
                'transition-colors duration-150',
                itemType === 'event'
                  ? 'bg-[var(--accent)] text-[var(--bg)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]'
              )}
            >
              Event
            </button>
            <button
              type="button"
              onClick={() => setItemType('task')}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium',
                'border-l border-[var(--border)]',
                'transition-colors duration-150',
                itemType === 'task'
                  ? 'bg-[var(--accent)] text-[var(--bg)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]'
              )}
            >
              Task
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 pb-3 gap-2">
          <button
            type="button"
            onClick={handleMoreOptions}
            className={cn(
              'text-xs text-[var(--muted)] hover:text-[var(--fg)]',
              'hover:underline underline-offset-2',
              'transition-colors duration-150'
            )}
          >
            More options
          </button>

          <button
            type="submit"
            disabled={!title.trim()}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-medium',
              'bg-[var(--accent)] text-[var(--bg)]',
              'hover:bg-[var(--accent-hover)]',
              'disabled:opacity-50 disabled:pointer-events-none',
              'transition-colors duration-150'
            )}
          >
            Save
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
