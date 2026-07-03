# poolendar-mcp

An [MCP](https://modelcontextprotocol.io) server that gives Claude Code (and any
other MCP client) the same power over your calendar that the Poolendar UI has —
events, tasks, routines, tags, and booking pages, all over one API key. Its
headline trick: `create_task` with `scheduled_start`/`scheduled_end` puts a task
straight onto the calendar grid instead of parking it in an inbox.

## Install

```bash
claude mcp add poolendar -- npx -y poolendar-mcp
```

Then set two environment variables so the server knows which Poolendar to talk
to and how to authenticate:

| Variable            | Required | Default                 | What it is                                              |
| ------------------- | -------- | ----------------------- | ------------------------------------------------------- |
| `POOLENDAR_API_KEY` | yes      | —                       | An API key from **Settings → Profile** (`pk_…`).        |
| `POOLENDAR_API_URL` | no       | `http://localhost:3000` | Base URL of your Poolendar instance.                    |

With Claude Code you can pass them inline:

```bash
claude mcp add poolendar \
  --env POOLENDAR_API_KEY=pk_your_key_here \
  --env POOLENDAR_API_URL=https://your-poolendar.example.com \
  -- npx -y poolendar-mcp
```

Or run the binary directly:

```bash
POOLENDAR_API_KEY=pk_... POOLENDAR_API_URL=http://localhost:3000 npx poolendar-mcp
```

The server speaks stdio and exits immediately if `POOLENDAR_API_KEY` is missing.

## What it can do

The server wraps the Poolendar REST API. A few highlights:

- **`create_task`** — create a task; pass `scheduled_start` + `scheduled_end` to
  drop it directly on the calendar grid (the killer feature).
- **`list_events`** — a date-range calendar read that returns events **and**
  scheduled tasks (and routine instances) in the window, each tagged with a
  `kind`.
- **`list_calendars`** — connected Google accounts and their sub-calendars.
- **`reflow_day`** — repack a day's flexible tasks so they stop overlapping.
- Full CRUD for events, tasks, subtasks, routines, tags, and booking links, plus
  type conversion and full-text search.

## Development

```bash
pnpm dev     # run from source with tsx
pnpm build   # bundle to a single dist/index.js with tsup
pnpm test    # vitest
```

The build inlines the `@poolendar/*` workspace packages so the published tarball
has no unresolvable `workspace:*` dependencies — only `@modelcontextprotocol/sdk`
is installed at runtime.
