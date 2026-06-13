'use client'

import * as React from 'react'
import {
  Calendar,
  CheckSquare,
  RefreshCw,
  Edit,
  Trash2,
  Copy,
  ArrowRightLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/lib/stores/ui-store'

// ---------------------------------------------------------------------------
// Menu item
// ---------------------------------------------------------------------------

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}

function MenuItem({ icon, label, onClick, danger }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1.5 text-sm',
        'hover:bg-[var(--surface-hover)] rounded transition-colors duration-100',
        danger
          ? 'text-red-400 hover:text-red-300'
          : 'text-[var(--fg)]'
      )}
    >
      <span className="shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function MenuDivider() {
  return <div className="my-1 h-px bg-[var(--border)]" />
}

// ---------------------------------------------------------------------------
// ContextMenu
// ---------------------------------------------------------------------------

export function ContextMenu() {
  const { contextMenu, closeContextMenu, openEditForm } = useUIStore()
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Close on click outside
  React.useEffect(() => {
    if (!contextMenu.isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeContextMenu()
      }
    }

    // Delay listener attachment so the opening right-click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu.isOpen, closeContextMenu])

  if (!contextMenu.isOpen || !contextMenu.position) return null

  const { x, y } = contextMenu.position
  const hasItem = !!contextMenu.itemId

  // Keep menu within viewport
  const menuWidth = 192
  const menuHeight = hasItem ? 200 : 140
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 8)
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 8)

  function handleAction(action: string) {
    const { itemId, itemType } = contextMenu

    switch (action) {
      case 'create-event':
        openEditForm(null, 'event')
        break
      case 'create-task':
        openEditForm(null, 'task')
        break
      case 'create-routine':
        openEditForm(null, 'routine')
        break
      case 'edit':
        if (itemId && itemType) {
          openEditForm(itemId, itemType)
        }
        break
      case 'duplicate':
        // Integration point for duplicate logic
        break
      case 'delete':
        // Integration point for delete logic
        break
      case 'convert-event':
        if (itemId) openEditForm(itemId, 'event')
        break
      case 'convert-task':
        if (itemId) openEditForm(itemId, 'task')
        break
      default:
        break
    }

    closeContextMenu()
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 min-w-[192px] rounded-lg py-1 shadow-xl',
        'border border-[var(--border)] bg-[var(--surface)]',
        'animate-in fade-in zoom-in-95 duration-100'
      )}
      style={{ left: adjustedX, top: adjustedY }}
      role="menu"
    >
      {hasItem ? (
        <>
          <MenuItem
            icon={<Edit size={14} />}
            label="Edit"
            onClick={() => handleAction('edit')}
          />
          <MenuItem
            icon={<Copy size={14} />}
            label="Duplicate"
            onClick={() => handleAction('duplicate')}
          />
          <MenuDivider />
          {contextMenu.itemType !== 'event' && (
            <MenuItem
              icon={<ArrowRightLeft size={14} />}
              label="Convert to Event"
              onClick={() => handleAction('convert-event')}
            />
          )}
          {contextMenu.itemType !== 'task' && (
            <MenuItem
              icon={<ArrowRightLeft size={14} />}
              label="Convert to Task"
              onClick={() => handleAction('convert-task')}
            />
          )}
          <MenuDivider />
          <MenuItem
            icon={<Trash2 size={14} />}
            label="Delete"
            onClick={() => handleAction('delete')}
            danger
          />
        </>
      ) : (
        <>
          <MenuItem
            icon={<Calendar size={14} />}
            label="Create Event"
            onClick={() => handleAction('create-event')}
          />
          <MenuItem
            icon={<CheckSquare size={14} />}
            label="Create Task"
            onClick={() => handleAction('create-task')}
          />
          <MenuItem
            icon={<RefreshCw size={14} />}
            label="Create Routine"
            onClick={() => handleAction('create-routine')}
          />
        </>
      )}
    </div>
  )
}
