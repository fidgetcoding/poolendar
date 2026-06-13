'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SettingsSection } from './SettingsSection'
import { toast } from 'sonner'

interface Tag {
  id: string
  name: string
  color: string
  prefix: string | null
}

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

export function TagsTab() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadTags()
  }, [])

  async function loadTags() {
    try {
      const res = await fetch('/api/tags')
      if (res.ok) {
        const data = await res.json()
        setTags(data)
      }
    } catch {
      toast.error('Failed to load tags')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to create tag')
        return
      }
      const tag = await res.json()
      setTags((t) => [...t, tag])
      setNewName('')
      setNewColor(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)])
      toast.success('Tag created')
    } catch {
      toast.error('Failed to create tag')
    } finally {
      setCreating(false)
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return
    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to update tag')
        return
      }
      const updated = await res.json()
      setTags((t) => t.map((tag) => (tag.id === id ? updated : tag)))
      setEditingId(null)
      toast.success('Tag updated')
    } catch {
      toast.error('Failed to update tag')
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Failed to delete tag')
        return
      }
      setTags((t) => t.filter((tag) => tag.id !== id))
      setDeletingId(null)
      toast.success('Tag deleted')
    } catch {
      toast.error('Failed to delete tag')
    }
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
  }

  if (loading) {
    return (
      <SettingsSection title="Tags">
        <p className="text-sm text-[var(--muted)]">Loading tags...</p>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title="Tags"
      description="Create and manage tags to organize your events and tasks"
    >
      {tags.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No tags yet.</p>
      )}

      <div className="space-y-1">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
          >
            {editingId === tag.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded border border-[var(--border)] bg-transparent"
                />
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--fg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdate(tag.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  autoFocus
                />
                <button
                  onClick={() => handleUpdate(tag.id)}
                  className="rounded p-1 text-[var(--accent)] hover:bg-[var(--surface-hover)]"
                  aria-label="Save"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm text-[var(--fg)]">{tag.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {deletingId === tag.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(tag.id)}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(tag)}
                        className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                        aria-label={`Edit ${tag.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingId(tag.id)}
                        className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--destructive)]"
                        aria-label={`Delete ${tag.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Create new tag */}
      <div className="flex items-end gap-2">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded border border-[var(--border)] bg-transparent"
        />
        <div className="flex-1">
          <Input
            placeholder="Tag name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
          />
        </div>
        <Button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          size="default"
        >
          <Plus className="h-4 w-4" />
          Add Tag
        </Button>
      </div>
    </SettingsSection>
  )
}
