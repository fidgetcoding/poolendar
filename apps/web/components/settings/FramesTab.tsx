'use client'

import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X, ChevronUp, ChevronDown, Zap, Brain, Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SettingsSection, SettingsRow, SettingsToggle } from './SettingsSection'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useFrames, useCreateFrame, useUpdateFrame, useDeleteFrame, useToggleFrame, useReorderFrames } from '@/lib/hooks/use-frames'
import type { Frame } from '@poolendar/types'
import { useAutoScheduleStatus, useAutoSchedulePreview, useAutoScheduleRun, useAutoScheduleUnschedule, useAutoScheduleSettings } from '@/lib/hooks/use-auto-schedule'

interface TimeBlock { day: number; start: string; end: string }
interface ScoringWeights { urgency: number; deadline: number; tag_priority: number; staleness: number }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#eab308', '#ec4899']
const inputCls = 'rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'
const iconBtnCls = 'rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)]'

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function summarizeBlocks(blocks: TimeBlock[]): string {
  if (!blocks.length) return 'No time blocks'
  const grouped = new Map<string, number[]>()
  for (const b of blocks) {
    const k = `${b.start}-${b.end}`
    grouped.set(k, [...(grouped.get(k) || []), b.day])
  }
  return [...grouped].map(([time, days]) => {
    const s = days.sort()
    const first = s[0]!
    const last = s[s.length - 1]!
    const dayStr = s.length > 1 && last - first === s.length - 1
      ? `${DAYS[first]}-${DAYS[last]}` : s.map((d) => DAYS[d]).join(', ')
    return `${dayStr} ${time}`
  }).join(' / ')
}

export function FramesTab() {
  // React Query hooks — frames
  const { data: frames = [], isLoading: framesLoading } = useFrames()
  const createFrame = useCreateFrame()
  const updateFrame = useUpdateFrame()
  const deleteFrameMutation = useDeleteFrame()
  const toggleFrameMutation = useToggleFrame()
  const reorderFrames = useReorderFrames()

  // React Query hooks — auto-schedule
  const { data: autoStatus } = useAutoScheduleStatus()
  const { data: autoSettings, refetch: refetchSettings } = useAutoScheduleSettings()
  const previewMutation = useAutoSchedulePreview()
  const runMutation = useAutoScheduleRun()
  const unscheduleMutation = useAutoScheduleUnschedule()

  // Local UI state
  const [editingFrame, setEditingFrame] = useState<Partial<Frame> | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showWeights, setShowWeights] = useState(false)
  const [unschedDialog, setUnschedDialog] = useState(false)
  const [preview, setPreview] = useState<Array<{
    task_id: string; task_title: string; frame_name: string
    scheduled_start: string; scheduled_end: string
  }> | null>(null)
  const [localWeights, setLocalWeights] = useState<ScoringWeights | null>(null)

  // Derived values
  const enabled = autoSettings?.enabled ?? false
  const aiClassification = autoSettings?.ai_classification ?? false
  const wt = localWeights ?? autoSettings?.scoring_weights ?? { urgency: 0.35, deadline: 0.30, tag_priority: 0.20, staleness: 0.15 }
  const weightsTotal = wt.urgency + wt.deadline + wt.tag_priority + wt.staleness

  // Initialize local weights when settings load
  if (!localWeights && autoSettings?.scoring_weights) {
    setLocalWeights(autoSettings.scoring_weights)
  }

  async function saveFrame() {
    if (!editingFrame?.name?.trim()) return
    const timeBlocks = editingFrame.time_blocks || []
    if (timeBlocks.length === 0) {
      toast.error('At least one time block is required')
      return
    }
    // Validate time blocks: end must be after start
    for (const block of timeBlocks) {
      if (block.start >= block.end) {
        toast.error(`Invalid time block: ${DAYS[block.day]} ${block.start} must be before ${block.end}`)
        return
      }
    }

    const isNew = !editingId
    const payload = {
      name: editingFrame.name.trim(),
      description: editingFrame.description?.trim() || null,
      color: editingFrame.color || COLORS[0]!,
      time_blocks: timeBlocks,
      is_active: editingFrame.is_active ?? true,
      priority_rank: editingFrame.priority_rank ?? frames.length,
      recurrence_rule: editingFrame.recurrence_rule ?? null,
      day_overrides: (editingFrame as Frame).day_overrides ?? {},
    }

    try {
      if (isNew) {
        await createFrame.mutateAsync(payload)
      } else {
        await updateFrame.mutateAsync({ id: editingId, data: payload })
      }
      setEditingFrame(null)
      setEditingId(null)
      toast.success(`Frame ${isNew ? 'created' : 'updated'}`)
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${isNew ? 'create' : 'update'} frame`)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteFrameMutation.mutateAsync(id)
      setDeletingId(null)
      toast.success('Frame deleted')
    } catch {
      toast.error('Failed to delete frame')
    }
  }

  async function handleToggle(id: string) {
    try {
      await toggleFrameMutation.mutateAsync(id)
    } catch {
      toast.error('Failed to toggle frame')
    }
  }

  async function reorder(id: string, dir: 'up' | 'down') {
    const idx = frames.findIndex((f) => f.id === id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= frames.length) return
    const r = [...frames]
    ;[r[idx], r[swapIdx]] = [r[swapIdx]!, r[idx]!]
    const order = r.map((f) => f.id)
    try {
      await reorderFrames.mutateAsync(order)
    } catch {
      toast.error('Failed to reorder')
    }
  }

  async function patchSettings(patch: Record<string, unknown>) {
    try {
      await fetch('/api/auto-schedule/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      refetchSettings()
      toast.success('Auto-schedule updated')
    } catch {
      toast.error('Failed to update auto-schedule')
    }
  }

  async function handleAutoToggle(newEnabled: boolean) {
    if (!newEnabled && enabled) {
      setUnschedDialog(true)
      return
    }
    await patchSettings({ enabled: newEnabled })
  }

  async function handleUnschedChoice(choice: 'keep' | 'unschedule' | 'today') {
    setUnschedDialog(false)
    if (choice === 'unschedule') {
      try {
        await unscheduleMutation.mutateAsync()
        toast.success('All auto-scheduled tasks unscheduled')
      } catch {
        toast.error('Failed to unschedule tasks')
      }
      await patchSettings({ enabled: false })
    } else if (choice === 'today') {
      // Pause until end of today — auto-schedule stays "enabled" but skipped for today
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      await patchSettings({ paused_until: tomorrow.toISOString().split('T')[0] })
    } else {
      // 'keep' — disable but leave existing placements alone
      await patchSettings({ enabled: false })
    }
  }

  async function runPreview() {
    try {
      const result = await previewMutation.mutateAsync(undefined)
      setPreview(result.placements)
    } catch {
      toast.error('Failed to generate preview')
    }
  }

  async function confirmRun() {
    try {
      await runMutation.mutateAsync({ confirm: true })
      toast.success('Auto-schedule applied')
      setPreview(null)
    } catch {
      toast.error('Failed to run auto-schedule')
    }
  }

  function cancelEdit() {
    setEditingFrame(null)
    setEditingId(null)
  }

  function updateBlock(i: number, field: keyof TimeBlock, value: string | number) {
    if (!editingFrame) return
    const blocks = [...(editingFrame.time_blocks || [])]
    blocks[i] = { ...blocks[i]!, [field]: value }
    setEditingFrame({ ...editingFrame, time_blocks: blocks })
  }

  if (framesLoading) {
    return <SettingsSection title="Frames"><p className="text-sm text-[var(--muted)]">Loading frames...</p></SettingsSection>
  }

  return (
    <div className="space-y-8">
      <SettingsSection title="Frames" description="Define time blocks for auto-scheduling. Higher priority frames fill first.">
        {frames.length === 0 && !editingFrame && (
          <p className="text-sm text-[var(--muted)]">No frames yet. Create one to get started.</p>
        )}

        <div className="space-y-1">
          {frames.map((frame, idx) => (
            <div key={frame.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: frame.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--fg)] font-medium truncate">{frame.name}</span>
                    {!frame.is_active && <span className="text-[10px] text-[var(--muted)] bg-[var(--surface)] px-1.5 py-0.5 rounded">inactive</span>}
                  </div>
                  <span className="text-xs text-[var(--muted)] truncate block">{summarizeBlocks(frame.time_blocks)}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                {deletingId === frame.id ? (
                  <>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(frame.id)}>Confirm</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <button onClick={() => reorder(frame.id, 'up')} disabled={idx === 0} className={cn(iconBtnCls, 'hover:text-[var(--fg)] disabled:opacity-30')} aria-label="Move up"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => reorder(frame.id, 'down')} disabled={idx === frames.length - 1} className={cn(iconBtnCls, 'hover:text-[var(--fg)] disabled:opacity-30')} aria-label="Move down"><ChevronDown className="h-3.5 w-3.5" /></button>
                    <SettingsToggle checked={frame.is_active} onChange={() => handleToggle(frame.id)} label={`Toggle ${frame.name}`} />
                    <button onClick={() => { setEditingId(frame.id); setEditingFrame({ ...frame }) }} className={cn(iconBtnCls, 'hover:text-[var(--fg)]')} aria-label={`Edit ${frame.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDeletingId(frame.id)} className={cn(iconBtnCls, 'hover:text-[var(--destructive)]')} aria-label={`Delete ${frame.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {editingFrame ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 space-y-4">
            <div className="flex items-center gap-3">
              <input type="color" value={editingFrame.color || COLORS[0]} onChange={(e) => setEditingFrame({ ...editingFrame, color: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-[var(--border)] bg-transparent" />
              <div className="flex-1">
                <Input placeholder="Frame name" value={editingFrame.name || ''} onChange={(e) => setEditingFrame({ ...editingFrame, name: e.target.value })} />
              </div>
            </div>
            <textarea
              placeholder="Description (helps AI classify tasks into this frame)"
              value={editingFrame.description || ''}
              onChange={(e) => setEditingFrame({ ...editingFrame, description: e.target.value })}
              rows={2}
              className={cn(inputCls, 'w-full px-3 py-2')}
            />
            <div className="space-y-2">
              <div className="text-sm font-medium text-[var(--fg)]">Time Blocks</div>
              {(editingFrame.time_blocks || []).map((block, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={block.day} onChange={(e) => updateBlock(i, 'day', parseInt(e.target.value))} className={inputCls}>
                    {DAYS.map((d, di) => <option key={di} value={di}>{d}</option>)}
                  </select>
                  <input type="time" value={block.start} onChange={(e) => updateBlock(i, 'start', e.target.value)} className={inputCls} />
                  <span className="text-xs text-[var(--muted)]">to</span>
                  <input type="time" value={block.end} onChange={(e) => updateBlock(i, 'end', e.target.value)} className={inputCls} />
                  <button onClick={() => setEditingFrame({ ...editingFrame, time_blocks: (editingFrame.time_blocks || []).filter((_, j) => j !== i) })} className={cn(iconBtnCls, 'hover:text-[var(--destructive)]')} aria-label="Remove"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <button onClick={() => setEditingFrame({ ...editingFrame, time_blocks: [...(editingFrame.time_blocks || []), { day: 1, start: '09:00', end: '11:00' }] })} className="flex items-center gap-1.5 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]">
                <Plus className="h-3.5 w-3.5" /> Add time block
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
              <Button size="sm" onClick={saveFrame} disabled={!editingFrame.name?.trim() || createFrame.isPending || updateFrame.isPending}>
                <Check className="h-4 w-4" /> {editingId ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => { setEditingId(null); setEditingFrame({ name: '', description: null, color: COLORS[frames.length % COLORS.length], time_blocks: [{ day: 1, start: '09:00', end: '11:00' }], is_active: true }) }} variant="outline">
            <Plus className="h-4 w-4" /> Add Frame
          </Button>
        )}
      </SettingsSection>

      <SettingsSection title="Auto-Scheduling" description="Automatically place unscheduled tasks into frames based on priority">
        <SettingsRow label="Enable Auto-Scheduling" description="Automatically fill frames with prioritized tasks">
          <SettingsToggle checked={enabled} onChange={handleAutoToggle} label="Enable auto-scheduling" />
        </SettingsRow>

        {enabled && (
          <>
            <SettingsRow label="AI Classification" description="Use AI to classify tasks into the best matching frame">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-[var(--muted)]" />
                <SettingsToggle checked={aiClassification} onChange={(v) => patchSettings({ ai_classification: v })} label="Enable AI classification" />
              </div>
            </SettingsRow>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)]">
              <button onClick={() => setShowWeights(!showWeights)} className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--surface-hover)] rounded-lg">
                <span>Scoring Weights</span>
                {showWeights ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showWeights && (
                <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">
                  {(['urgency', 'deadline', 'tag_priority', 'staleness'] as const).map((key) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--fg)] capitalize">{key.replace('_', ' ')}</span>
                        <span className="text-xs text-[var(--muted)] tabular-nums w-10 text-right">{wt[key].toFixed(2)}</span>
                      </div>
                      <input type="range" min={0} max={1} step={0.05} value={wt[key]} onChange={(e) => setLocalWeights((prev) => ({ ...(prev ?? wt), [key]: parseFloat(e.target.value) }))} className="w-full accent-[var(--accent)] h-1.5" />
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                    <span className="text-xs text-[var(--muted)]">Total</span>
                    <span className={cn('text-xs tabular-nums', Math.abs(weightsTotal - 1) < 0.05 ? 'text-green-400' : 'text-[var(--destructive)]')}>
                      {weightsTotal.toFixed(2)}{Math.abs(weightsTotal - 1) >= 0.05 && ' (should be ~1.0)'}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => patchSettings({ scoring_weights: wt })}>Save Weights</Button>
                </div>
              )}
            </div>

            <Button onClick={runPreview} disabled={previewMutation.isPending} variant="outline">
              <Play className="h-4 w-4" /> {previewMutation.isPending ? 'Generating...' : 'Run Auto-Schedule'}
            </Button>

            {autoStatus?.last_run_at && (
              <p className="text-xs text-[var(--muted)]">
                Last run: {timeAgo(autoStatus.last_run_at)} · {autoStatus.scheduled_count} scheduled · {autoStatus.unscheduled_count} unscheduled
              </p>
            )}
          </>
        )}
      </SettingsSection>

      {unschedDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setUnschedDialog(false)} />
          <div className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl max-w-sm w-full mx-4 space-y-3">
            <h4 className="text-sm font-semibold text-[var(--fg)]">Disable Auto-Scheduling</h4>
            <p className="text-xs text-[var(--muted)]">What should happen to currently auto-scheduled tasks?</p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={() => handleUnschedChoice('keep')}>Keep tasks where they are</Button>
              <Button variant="outline" size="sm" onClick={() => handleUnschedChoice('unschedule')}>Unschedule all auto-scheduled tasks</Button>
              <Button variant="outline" size="sm" onClick={() => handleUnschedChoice('today')}>Turn off for today only</Button>
              <Button variant="ghost" size="sm" onClick={() => setUnschedDialog(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreview(null)} />
          <div className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl max-w-md w-full mx-4 space-y-4 max-h-[70vh] flex flex-col">
            <h4 className="text-sm font-semibold text-[var(--fg)]">Auto-Schedule Preview ({preview.length} tasks)</h4>
            <div className="flex-1 overflow-y-auto space-y-1">
              {preview.length === 0
                ? <p className="text-sm text-[var(--muted)]">No tasks to schedule.</p>
                : preview.map((p) => (
                  <div key={p.task_id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[var(--fg)] truncate">{p.task_title}</div>
                      <div className="text-xs text-[var(--muted)]">{p.frame_name}</div>
                    </div>
                    <div className="text-xs text-[var(--muted)] flex-shrink-0 ml-2">
                      {new Date(p.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {new Date(p.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>Cancel</Button>
              <Button size="sm" onClick={confirmRun} disabled={preview.length === 0 || runMutation.isPending}>
                <Zap className="h-4 w-4" /> {runMutation.isPending ? 'Applying...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
