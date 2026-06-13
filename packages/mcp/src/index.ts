#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { PoolendarClient } from '@poolendar/api-client'

const server = new Server(
  { name: 'poolendar-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

const client = new PoolendarClient({
  baseUrl: process.env.POOLENDAR_URL ?? 'http://localhost:3000',
  apiKey: process.env.POOLENDAR_API_KEY,
})

// Tool registrations will be added by the MCP agent

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)

export { server, client }
