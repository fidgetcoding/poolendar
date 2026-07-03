import { describe, it, expect } from 'vitest'
import { convertRequirements, buildConvertBody } from '../convert'

describe('convertRequirements', () => {
  it('warns about Google deletion + attendee notice for event -> task with attendees', () => {
    const r = convertRequirements('event', 'task', { attendeeCount: 3 })
    expect(r.needsConfirm).toBe(true)
    expect(r.message).toContain('Google Calendar')
    expect(r.message).toContain('Attendees will be notified')
    expect(r.needsCalendar).toBe(false)
    expect(r.needsRepeatPattern).toBe(false)
  })

  it('does not warn for event -> task without attendees', () => {
    const r = convertRequirements('event', 'task', { attendeeCount: 0 })
    expect(r.needsConfirm).toBe(false)
    expect(r.message).toBeNull()
  })

  it('warns about subtask removal for task-with-subtasks -> event', () => {
    const r = convertRequirements('task', 'event', { subtaskCount: 5 })
    expect(r.needsConfirm).toBe(true)
    expect(r.message).toBe('This task has 5 subtasks that will be removed. Continue?')
    expect(r.needsCalendar).toBe(true)
  })

  it('singularizes the subtask warning', () => {
    const r = convertRequirements('task', 'routine', { subtaskCount: 1 })
    expect(r.message).toBe('This task has 1 subtask that will be removed. Continue?')
    expect(r.needsRepeatPattern).toBe(true)
  })

  it('task -> routine requires a repeat pattern, no confirm without subtasks', () => {
    const r = convertRequirements('task', 'routine', { subtaskCount: 0 })
    expect(r.needsConfirm).toBe(false)
    expect(r.needsRepeatPattern).toBe(true)
    expect(r.needsCalendar).toBe(false)
  })

  it('any -> event requires a calendar', () => {
    expect(convertRequirements('routine', 'event').needsCalendar).toBe(true)
    expect(convertRequirements('task', 'event').needsCalendar).toBe(true)
  })
})

describe('buildConvertBody', () => {
  it('includes only present optional fields', () => {
    expect(
      buildConvertBody({ sourceType: 'task', sourceId: 't1', targetType: 'routine' })
    ).toEqual({ source_type: 'task', source_id: 't1', target_type: 'routine' })

    expect(
      buildConvertBody({
        sourceType: 'task',
        sourceId: 't1',
        targetType: 'event',
        calendarId: 'cal-1',
      })
    ).toEqual({
      source_type: 'task',
      source_id: 't1',
      target_type: 'event',
      calendar_id: 'cal-1',
    })

    expect(
      buildConvertBody({
        sourceType: 'event',
        sourceId: 'e1',
        targetType: 'routine',
        repeatPattern: 'FREQ=WEEKLY',
      })
    ).toEqual({
      source_type: 'event',
      source_id: 'e1',
      target_type: 'routine',
      repeat_pattern: 'FREQ=WEEKLY',
    })
  })

  it('drops empty-string optionals', () => {
    const body = buildConvertBody({
      sourceType: 'task',
      sourceId: 't1',
      targetType: 'event',
      calendarId: '',
      repeatPattern: '',
    })
    expect(body).not.toHaveProperty('calendar_id')
    expect(body).not.toHaveProperty('repeat_pattern')
  })
})
