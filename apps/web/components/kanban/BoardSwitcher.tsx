'use client'

import type { TaskBoard } from '@poolendar/types'

interface BoardSwitcherProps {
  activeBoard: TaskBoard
  onBoardChange: (board: TaskBoard) => void
  currentCount: number
  futureCount: number
}

export function BoardSwitcher({
  activeBoard,
  onBoardChange,
  currentCount,
  futureCount,
}: BoardSwitcherProps) {
  return (
    <div
      className="inline-flex rounded-lg p-0.5"
      style={{ backgroundColor: 'var(--surface)' }}
    >
      <button
        type="button"
        onClick={() => onBoardChange('current')}
        className="px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2"
        style={{
          backgroundColor:
            activeBoard === 'current' ? 'var(--bg)' : 'transparent',
          color:
            activeBoard === 'current' ? 'var(--fg)' : 'var(--muted)',
          boxShadow:
            activeBoard === 'current'
              ? '0 1px 3px rgba(0, 0, 0, 0.3)'
              : 'none',
        }}
      >
        Current
        <span
          className="text-xs px-1.5 py-0.5 rounded-full font-normal"
          style={{
            backgroundColor:
              activeBoard === 'current'
                ? 'var(--accent)'
                : 'var(--border)',
            color:
              activeBoard === 'current' ? '#000' : 'var(--muted)',
          }}
        >
          {currentCount}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onBoardChange('future')}
        className="px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2"
        style={{
          backgroundColor:
            activeBoard === 'future' ? 'var(--bg)' : 'transparent',
          color:
            activeBoard === 'future' ? 'var(--fg)' : 'var(--muted)',
          boxShadow:
            activeBoard === 'future'
              ? '0 1px 3px rgba(0, 0, 0, 0.3)'
              : 'none',
        }}
      >
        Future
        <span
          className="text-xs px-1.5 py-0.5 rounded-full font-normal"
          style={{
            backgroundColor:
              activeBoard === 'future'
                ? 'var(--accent)'
                : 'var(--border)',
            color:
              activeBoard === 'future' ? '#000' : 'var(--muted)',
          }}
        >
          {futureCount}
        </span>
      </button>
    </div>
  )
}
