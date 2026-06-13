import { describe, it, expect } from 'vitest'
import {
  getEventToolDefinitions,
  getTaskToolDefinitions,
  getSubtaskToolDefinitions,
  getRoutineToolDefinitions,
  getTagToolDefinitions,
  getBookingToolDefinitions,
  getScheduleToolDefinitions,
  getFrameToolDefinitions,
  getAutoScheduleToolDefinitions,
  getConvertToolDefinitions,
  getSearchToolDefinitions,
  getProfileToolDefinitions,
  getBulkToolDefinitions,
} from '../tools/index.js'
import type { ToolDefinition } from '../types.js'

function getAllToolDefinitions(): ToolDefinition[] {
  return [
    ...getEventToolDefinitions(),
    ...getTaskToolDefinitions(),
    ...getSubtaskToolDefinitions(),
    ...getRoutineToolDefinitions(),
    ...getTagToolDefinitions(),
    ...getBookingToolDefinitions(),
    ...getScheduleToolDefinitions(),
    ...getFrameToolDefinitions(),
    ...getAutoScheduleToolDefinitions(),
    ...getConvertToolDefinitions(),
    ...getSearchToolDefinitions(),
    ...getProfileToolDefinitions(),
    ...getBulkToolDefinitions(),
  ]
}

describe('Tool Descriptions', () => {
  const tools = getAllToolDefinitions()

  it('all tool descriptions are at least 15 characters (meaningful, not stubs)', () => {
    for (const tool of tools) {
      expect(
        tool.description.length,
        `${tool.name} description is too short (${tool.description.length} chars): "${tool.description}"`
      ).toBeGreaterThanOrEqual(15)
    }
  })

  it('most tool descriptions are at least 40 characters (detailed)', () => {
    // Simple toggle/close tools can be terse, but the majority should be descriptive
    const shortDescriptions = tools.filter((t) => t.description.length < 40)
    expect(
      shortDescriptions.length,
      `Too many short descriptions: ${shortDescriptions.map((t) => t.name).join(', ')}`
    ).toBeLessThanOrEqual(10) // Allow up to 10 terse descriptions out of 68
  })

  describe('create_task description (PRODUCT.md #82)', () => {
    const tool = tools.find((t) => t.name === 'create_task')!

    it('mentions scheduled_start', () => {
      expect(tool.description.toLowerCase()).toContain('scheduled_start')
    })

    it('mentions scheduled_end', () => {
      expect(tool.description.toLowerCase()).toContain('scheduled_end')
    })

    it('mentions placing task on the calendar', () => {
      expect(tool.description.toLowerCase()).toContain('calendar')
    })

    it('calls out the core differentiator behavior', () => {
      // The description should make it clear that scheduled_start + scheduled_end
      // puts the task DIRECTLY on the calendar grid (not just the kanban board)
      expect(tool.description).toMatch(/directly.*calendar|calendar.*directly/i)
    })
  })

  describe('auto_schedule_run description', () => {
    const tool = tools.find((t) => t.name === 'auto_schedule_run')!

    it('mentions scoring', () => {
      expect(tool.description.toLowerCase()).toMatch(/scor(e|ing)/)
    })

    it('mentions frame placement', () => {
      expect(tool.description.toLowerCase()).toContain('frame')
    })

    it('mentions priority', () => {
      expect(tool.description.toLowerCase()).toContain('priority')
    })
  })

  describe('convert_item description', () => {
    const tool = tools.find((t) => t.name === 'convert_item')!

    it('mentions all three item types', () => {
      const desc = tool.description.toLowerCase()
      expect(desc).toContain('event')
      expect(desc).toContain('task')
      expect(desc).toContain('routine')
    })

    it('mentions conversion directions', () => {
      // Should explain side effects of conversion
      expect(tool.description.toLowerCase()).toContain('convert')
    })
  })

  describe('search description', () => {
    const tool = tools.find((t) => t.name === 'search')!

    it('mentions full-text search', () => {
      expect(tool.description.toLowerCase()).toMatch(/full.text.*search|search.*full.text/)
    })

    it('mentions multiple item types', () => {
      const desc = tool.description.toLowerCase()
      expect(desc).toContain('events')
      expect(desc).toContain('tasks')
      expect(desc).toContain('routines')
    })
  })

  describe('create_event description', () => {
    const tool = tools.find((t) => t.name === 'create_event')!

    it('mentions Google Calendar sync', () => {
      expect(tool.description.toLowerCase()).toContain('google calendar')
    })
  })

  describe('bulk_create_tasks description', () => {
    const tool = tools.find((t) => t.name === 'bulk_create_tasks')!

    it('mentions creating multiple tasks', () => {
      expect(tool.description.toLowerCase()).toContain('multiple')
    })

    it('mentions single operation', () => {
      expect(tool.description.toLowerCase()).toContain('single operation')
    })
  })

  describe('schedule_task description', () => {
    const tool = tools.find((t) => t.name === 'schedule_task')!

    it('mentions calendar time slot', () => {
      expect(tool.description.toLowerCase()).toContain('calendar')
    })

    it('mentions scheduled_start and scheduled_end', () => {
      expect(tool.description.toLowerCase()).toContain('scheduled_start')
      expect(tool.description.toLowerCase()).toContain('scheduled_end')
    })
  })

  describe('booking tool descriptions', () => {
    const bookingTools = getBookingToolDefinitions()

    it('create_booking_link mentions shareable URL', () => {
      const tool = bookingTools.find((t) => t.name === 'create_booking_link')!
      const desc = tool.description.toLowerCase()
      expect(desc).toMatch(/url|link/)
    })

    it('get_availability mentions checking availability', () => {
      const tool = bookingTools.find((t) => t.name === 'get_availability')!
      const desc = tool.description.toLowerCase()
      expect(desc).toContain('available')
    })
  })

  describe('frame tool descriptions', () => {
    it('create_frame mentions auto-scheduling', () => {
      const tool = tools.find((t) => t.name === 'create_frame')!
      expect(tool.description.toLowerCase()).toContain('auto-schedul')
    })

    it('toggle_frame mentions activate/deactivate', () => {
      const tool = tools.find((t) => t.name === 'toggle_frame')!
      expect(tool.description.toLowerCase()).toMatch(/activat|deactivat|active|inactive/)
    })
  })

  describe('profile tool descriptions', () => {
    it('get_profile mentions settings', () => {
      const tool = tools.find((t) => t.name === 'get_profile')!
      expect(tool.description.toLowerCase()).toContain('settings')
    })

    it('create_api_key mentions the key is shown only once', () => {
      const tool = tools.find((t) => t.name === 'create_api_key')!
      expect(tool.description.toLowerCase()).toMatch(/only.*once|cannot.*retrieved/)
    })
  })
})
