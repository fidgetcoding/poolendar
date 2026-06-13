import type { PoolendarClient } from '@poolendar/api-client'
import type { ToolDefinition, ToolHandler } from '../types.js'

export function getFrameToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'list_frames',
      description:
        'List all auto-scheduling frames. Frames are named time blocks where tasks get auto-placed.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'create_frame',
      description:
        'Create a new auto-scheduling frame with named time blocks. Tasks matching this frame get auto-placed into its time slots.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: {
            type: 'string',
            description:
              'Frame name (e.g., "Deep Work", "Admin", "Meetings").',
          },
          description: {
            type: 'string',
            description: 'Optional description of what this frame is for.',
          },
          color: {
            type: 'string',
            description:
              'Hex color code for the frame (e.g., "#4F46E5"). Used in calendar visualization.',
          },
          time_blocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: {
                  type: 'number',
                  description: 'Day of the week (0 = Sunday, 6 = Saturday).',
                },
                start: {
                  type: 'string',
                  description: 'Block start time in HH:MM format (24-hour, e.g., "09:00").',
                },
                end: {
                  type: 'string',
                  description: 'Block end time in HH:MM format (24-hour, e.g., "12:00").',
                },
              },
              required: ['day', 'start', 'end'],
            },
            description:
              'Time blocks defining when this frame is active. Each block specifies a day and time range.',
          },
          recurrence_rule: {
            type: 'string',
            description: 'Optional RRULE string for custom recurrence (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR").',
          },
          priority_rank: {
            type: 'number',
            description: 'Priority rank for scheduling conflicts. Lower numbers = higher priority.',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'update_frame',
      description:
        'Update an existing frame\'s name, description, color, time blocks, recurrence, or priority. Only the provided fields are changed.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The UUID of the frame to update.' },
          name: { type: 'string', description: 'Updated frame name.' },
          description: { type: 'string', description: 'Updated description.' },
          color: { type: 'string', description: 'Updated hex color code.' },
          time_blocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'number' },
                start: { type: 'string' },
                end: { type: 'string' },
              },
              required: ['day', 'start', 'end'],
            },
            description: 'Replace the time blocks.',
          },
          recurrence_rule: { type: 'string', description: 'Updated RRULE string.' },
          priority_rank: { type: 'number', description: 'Updated priority rank.' },
        },
        required: ['id'],
      },
    },
    {
      name: 'delete_frame',
      description:
        'Delete a frame by its UUID. Tasks previously placed in this frame become unscheduled.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string',
            description: 'The UUID of the frame to delete.',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'toggle_frame',
      description:
        'Activate or deactivate a frame. When inactive, the auto-scheduler skips it.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string',
            description: 'The UUID of the frame to toggle.',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'skip_frame_day',
      description:
        'Add a day override to skip a frame on a specific date. Useful for holidays or one-off schedule changes.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string',
            description: 'The UUID of the frame.',
          },
          date: {
            type: 'string',
            description: 'The date to override in YYYY-MM-DD format.',
          },
          active: {
            type: 'boolean',
            description: 'Whether the frame should be active on this date. Defaults to false (skip).',
          },
        },
        required: ['id', 'date'],
      },
    },
  ]
}

export function getFrameToolHandlers(client: PoolendarClient): Record<string, ToolHandler> {
  return {
    list_frames: async () => {
      const frames = await client.listFrames()
      return JSON.stringify(frames, null, 2)
    },

    create_frame: async (args) => {
      const frame = await client.createFrame({
        name: args.name as string,
        description: (args.description as string) ?? null,
        color: args.color as string,
        time_blocks: args.time_blocks as { day: number; start: string; end: string }[],
        recurrence_rule: (args.recurrence_rule as string) ?? null,
        priority_rank: args.priority_rank as number,
      })
      return JSON.stringify(frame, null, 2)
    },

    update_frame: async (args) => {
      const { id, ...data } = args as Record<string, unknown>
      const frame = await client.updateFrame(id as string, data)
      return JSON.stringify(frame, null, 2)
    },

    delete_frame: async (args) => {
      await client.deleteFrame(args.id as string)
      return JSON.stringify({ success: true, message: 'Frame deleted successfully.' })
    },

    toggle_frame: async (args) => {
      const frame = await client.toggleFrame(args.id as string)
      return JSON.stringify(frame, null, 2)
    },

    skip_frame_day: async (args) => {
      const frame = await client.skipFrameDay(
        args.id as string,
        args.date as string,
        (args.active as boolean) ?? false,
      )
      return JSON.stringify(frame, null, 2)
    },
  }
}
