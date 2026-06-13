#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { PoolendarClient } from '@poolendar/api-client'
import type { ToolDefinition, ToolHandler } from './types.js'
import {
  getEventToolDefinitions,
  getEventToolHandlers,
  getTaskToolDefinitions,
  getTaskToolHandlers,
  getSubtaskToolDefinitions,
  getSubtaskToolHandlers,
  getRoutineToolDefinitions,
  getRoutineToolHandlers,
  getTagToolDefinitions,
  getTagToolHandlers,
  getBookingToolDefinitions,
  getBookingToolHandlers,
  getScheduleToolDefinitions,
  getScheduleToolHandlers,
  getFrameToolDefinitions,
  getFrameToolHandlers,
  getAutoScheduleToolDefinitions,
  getAutoScheduleToolHandlers,
  getConvertToolDefinitions,
  getConvertToolHandlers,
  getSearchToolDefinitions,
  getSearchToolHandlers,
  getProfileToolDefinitions,
  getProfileToolHandlers,
  getBulkToolDefinitions,
  getBulkToolHandlers,
} from './tools/index.js'

// --- Configuration ---

const POOLENDAR_URL = process.env.POOLENDAR_URL ?? 'http://localhost:3000'
const POOLENDAR_API_KEY = process.env.POOLENDAR_API_KEY

if (!POOLENDAR_API_KEY) {
  console.error(
    'poolendar-mcp: POOLENDAR_API_KEY environment variable is required.\n' +
      'Generate an API key in Poolendar Settings > Profile, then set it:\n' +
      '  export POOLENDAR_API_KEY=pk_...'
  )
  process.exit(1)
}

// --- Server + Client ---

const server = new Server(
  { name: 'poolendar-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

const client = new PoolendarClient({
  baseUrl: POOLENDAR_URL,
  apiKey: POOLENDAR_API_KEY,
})

// --- Aggregate Tool Definitions ---

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

// --- Aggregate Tool Handlers ---

function getAllToolHandlers(): Record<string, ToolHandler> {
  return {
    ...getEventToolHandlers(client),
    ...getTaskToolHandlers(client),
    ...getSubtaskToolHandlers(client),
    ...getRoutineToolHandlers(client),
    ...getTagToolHandlers(client),
    ...getBookingToolHandlers(client),
    ...getScheduleToolHandlers(client),
    ...getFrameToolHandlers(client),
    ...getAutoScheduleToolHandlers(client),
    ...getConvertToolHandlers(client),
    ...getSearchToolHandlers(client),
    ...getProfileToolHandlers(client),
    ...getBulkToolHandlers(client),
  }
}

// --- Register MCP Handlers ---

const toolDefinitions = getAllToolDefinitions()
const toolHandlers = getAllToolHandlers()

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions,
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const handler = toolHandlers[name]

  if (!handler) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'unknown_tool',
            message: `Tool "${name}" is not recognized. Use list_tools to see available tools.`,
          }),
        },
      ],
      isError: true,
    }
  }

  try {
    const result = await handler(args ?? {})
    return {
      content: [{ type: 'text' as const, text: result }],
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unknown error occurred'
    const status =
      err && typeof err === 'object' && 'status' in err
        ? (err as { status: number }).status
        : 500

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'api_error',
              message,
              status,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    }
  }
})

// --- Start ---

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('poolendar-mcp: Fatal error:', err)
  process.exit(1)
})

export { server, client }
