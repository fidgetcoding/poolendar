import type { PoolendarClient } from '@poolendar/api-client'
import type { ToolDefinition, ToolHandler } from '../types.js'

export function getAutoScheduleToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'auto_schedule_run',
      description:
        'Score all unscheduled tasks and place them into frame time blocks based on priority, deadline pressure, tag priority, and staleness. This is the auto-scheduling engine.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          confirm: {
            type: 'boolean',
            description: 'Whether to apply placements immediately. Defaults to true.',
          },
          window_days: {
            type: 'number',
            description: 'Number of days to schedule into. Defaults to 7.',
          },
        },
      },
    },
    {
      name: 'auto_schedule_preview',
      description:
        'Dry run: shows proposed placements without applying. Returns scored task list with frame assignments.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          window_days: {
            type: 'number',
            description: 'Number of days to preview. Defaults to 7.',
          },
        },
      },
    },
    {
      name: 'auto_schedule_unschedule',
      description:
        'Remove all auto-scheduled task placements. Tasks return to unscheduled state.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'auto_schedule_status',
      description:
        'Current auto-scheduling state: enabled/disabled, last run time, scheduled/unscheduled task counts.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'classify_task',
      description:
        'Classify a single task into the most appropriate frame using keyword extraction and optional LLM fallback.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          task_id: {
            type: 'string',
            description: 'The UUID of the task to classify.',
          },
        },
        required: ['task_id'],
      },
    },
  ]
}

export function getAutoScheduleToolHandlers(client: PoolendarClient): Record<string, ToolHandler> {
  return {
    auto_schedule_run: async (args) => {
      const result = await client.autoScheduleRun({
        confirm: (args.confirm as boolean) ?? true,
        window_days: args.window_days as number,
      })
      return JSON.stringify(result, null, 2)
    },

    auto_schedule_preview: async (args) => {
      const result = await client.autoSchedulePreview(args.window_days as number)
      return JSON.stringify(result, null, 2)
    },

    auto_schedule_unschedule: async () => {
      const result = await client.autoScheduleUnschedule()
      return JSON.stringify(result, null, 2)
    },

    auto_schedule_status: async () => {
      const status = await client.autoScheduleStatus()
      return JSON.stringify(status, null, 2)
    },

    classify_task: async (args) => {
      const classification = await client.classifyTask(args.task_id as string)
      return JSON.stringify(classification, null, 2)
    },
  }
}
