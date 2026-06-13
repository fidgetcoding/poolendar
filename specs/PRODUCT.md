# PRODUCT.md — Poolendar

## Summary

Poolendar is a personal calendar web app that unifies events, tasks, routines, and booking pages into a single dark-themed interface with full keyboard control. It connects to unlimited Google Calendar accounts with bidirectional sync and exposes every operation through a REST API and MCP server — so a CLI agent (Claude Code) can create, schedule, and manage calendar items with the same power as the UI.

## Problem

Existing calendar apps have crippled APIs. Tasks created via Morgen's MCP land in the inbox, not on the calendar, forcing manual drag-and-drop. Routines and booking pages have no API surface at all. Motion's auto-scheduling is useful but its API is even more locked down. Poolendar exists because the API should be able to do everything the UI can — and that API is the product's reason for being.

## Goals / Non-goals

**Goals (v1):**
- Full Morgen UI parity: calendar grid, tasks, routines, events, booking pages
- Motion-style kanban board for project-based task management
- REST API + MCP server covering every user operation
- Tasks scheduled via API go directly on the calendar (not inbox)
- Dark theme with user-customizable colors
- Browser push, email, in-app, and Telegram bot notifications
- Google Calendar + Google Meet as the sole integrations

**Non-goals (v1):**
- Scale beyond ~10 users (works for friends; no growth investment)
- iCal, Outlook, Fastmail, CalDAV integration
- AI meeting notes, AI assistant beyond frame classification
- Morgen-style multi-app launcher
- Learning hub, referrals, gift box, open invites, help bubble

## Behavior

### Calendar Grid

1. The default view is a 7-day week showing Sunday through Saturday, with the current day highlighted (accent-colored circular date badge).

2. The top bar displays: month and year text ("June 2026"), a "Today" text button (not a circle), left/right chevron arrows for period navigation, and a view-mode selector dropdown.

3. Clicking "Today" navigates to the period containing the current date. Left chevron moves back one period; right moves forward one period. Period length matches the current view mode.

4. The view-mode selector dropdown offers:
   - Day (hotkey: `D`)
   - Week (hotkey: `W`)
   - Month (hotkey: `M`)
   - 2 weeks (hotkey: `X`)
   - Custom 1–9 days (hotkeys: `⌥1` through `⌥9`)

5. Below the view options, the dropdown includes toggleable display settings:
   - Show weekends (default: on)
   - Widen current day (default: on)
   - Dim past events (default: on)
   - Show completed tasks (default: on)
   - Show declined events (default: off)
   - Merge duplicate events (default: on)

6. The time grid runs vertically from the configured start time (default: 12:00 AM) to end time (default: 12:00 AM next day). Time labels appear on the left edge.

7. An all-day row sits above the time grid for events marked as all-day.

8. Time grid resolution is adjustable: `]` zooms in (taller hours), `[` zooms out (shorter hours). Default increment: 15 minutes.

9. Week number displays at the start of each week row (e.g., "W 24").

9a. In month view, each day cell shows a limited number of items (based on cell height, typically 2–4). When a day has more items than fit, a "+N more" link appears. Clicking it opens a popup overlay showing all items for that day — matching Google Calendar's behavior.

10. The calendar grid fills all available width. When the task panel sidebar is open, the grid shrinks to accommodate it; when closed, the grid expands.

### Events

11. Events render as solid colored blocks spanning start-to-end time. Block color matches the calendar the event belongs to.

12. Creating items on the calendar grid works three ways (matching Google Calendar):
    - **Click-and-drag** on an empty slot to set start time and duration in one gesture (drag down to extend, release to confirm)
    - **Double-click** on an empty slot to create with default 15-minute duration
    - **Right-click** on an empty slot to choose: + Create event, + Create task, + Create routine

13. The event creation/edit form has three tabs: **Task | Routine | Event**. Switching tabs converts the item's type, preserving title/notes/time. Type conversion has side effects because events sync to Google Calendar while tasks/routines do not:
    - **Event → Task/Routine**: The Google Calendar event is **deleted**. If the event had attendees, a confirmation dialog warns: "This will remove the event from Google Calendar. Attendees will be notified of cancellation." The item becomes a Poolendar-only task or routine.
    - **Task/Routine → Event**: A new Google Calendar event is **created** on the calendar selected in the form's calendar selector (defaults to the user's default calendar). The Supabase task/routine is deleted. The item now syncs bidirectionally.
    - **Task ↔ Routine**: No Google Calendar impact (both are Supabase-only). Task→Routine prompts for a repeat pattern. Routine→Task strips recurrence and creates a single task.
    - **Task with subtasks → Event or Routine**: Subtasks are discarded (events and routines do not support subtasks). A confirmation dialog warns: "This task has N subtasks that will be removed. Continue?" If the task was a split parent with independent child tasks, only the parent is converted — child tasks remain as standalone tasks.

    The Event tab shows:
    - Title (text field)
    - Notes (multi-line)
    - Calendar selector (which Google Calendar account/sub-calendar — determines invite sender email)
    - Add attendee (email, with autocomplete for previously-used addresses)
    - All-day toggle
    - Start date/time
    - End date/time
    - Timezone (default: America/New_York)
    - Repeat (None, Daily, Weekly, Biweekly, Monthly, Custom)
    - Location (free text)
    - Conferencing (Google Meet link generation)
    - Reminders (1, 5, 10 min before; customizable)
    - Visibility: Busy / Free
    - Privacy: Public / Private
    - Cancel / Save buttons

    The Task tab additionally shows:
    - Time estimate (text field, e.g., "60m", "2h")
    - Subtasks section: an inline checklist below the notes field. Each subtask row has a checkbox, title text field, optional time estimate field, drag handle for reordering, and a delete (×) button. A "+ Add subtask" link appends a new row. When subtasks exist, a progress indicator (e.g., "3/7") and a "Split into separate tasks" button appear at the bottom of the subtask section.

14. Dragging an event vertically changes its time. Dragging horizontally changes its date. Dragging the bottom edge resizes duration. All drag increments match the time-dragging resolution setting (default: 15 minutes).

15. Single-clicking an existing calendar item (event, task, or routine) opens a compact preview popover showing: title, time, calendar name (colored dot), tags, and quick-action buttons (Edit, Delete, Join meeting if applicable, Complete/Skip for tasks/routines). Double-clicking opens the full edit form with all fields pre-populated. The popover's "Edit" button also opens the full edit form.

15a. Right-clicking an existing event shows a context menu:
    - Color picker (row of color dots — overrides the calendar's default color for this individual event; syncs to Google Calendar)
    - Join meeting (if Google Meet link exists)
    - Copy meeting link
    - Email all attendees
    - Copy event
    - Delete event (red text)

15b. Right-clicking a task or routine on the calendar shows: Edit, Color override (same dot picker), Complete/Skip, Copy, Convert to Event/Task/Routine, Split (tasks only), Delete.

15c. When two or more events/tasks overlap the same time slot, they render side by side within the slot (each takes proportional width), matching Google Calendar behavior.

15d. Multi-day events (spanning across midnight into subsequent days) render as a spanning bar in the all-day row, matching Google Calendar behavior.

16. Events sync bidirectionally with Google Calendar: creates, edits, and deletions propagate in both directions.

17. When an event has attendees, the invite is sent from the email address of the Google Calendar account selected in the calendar selector.

### Tasks

18. Tasks render on the calendar as blocks with a checkbox icon on the left edge and a dashed/outlined border — visually distinct from solid-fill events. The outline color matches the color of the calendar they're assigned to (set via "Default calendar for tasks" in Settings), NOT tag colors. Tag colors are purely for tag badge navigation in the sidebar/kanban. The visual pattern: a solid green block is an event from nate@lorecraft.io; an outlined green block beside it is a task assigned to the same calendar — same color family, different fill style.

19. A task has:
    - Title (required)
    - Notes (optional)
    - Tags (zero or more)
    - Project assignment
    - Importance: Lowest / Low / Normal / High / Highest
    - Time estimate (e.g., "60m", "2h") — determines calendar block length when scheduled. If no estimate is set, the default task duration from Settings is used.
    - Subtasks (zero or more — see #23a–23g)
    - Earliest start date (default: Anytime)
    - Due date (default: Someday)
    - Due date repeat (None or recurrence)
    - Planned start / Planned end (the scheduled calendar slot — optional)
    - Location (optional)
    - Visibility: Busy / Free (default: Busy)
    - Privacy: Public / Private (default: Private)
    - Flexibility: Flexible / Not flexible
    - Reminders

20. A task with planned start and planned end appears on the calendar grid at that slot. A task without planned times exists only in the task panel and kanban. Dragging a task from the sidebar to the calendar sets its planned start/end but does NOT change its due date — due date and scheduled time are independent fields.

21. Checking a task's checkbox marks it completed. It dims on the calendar (if "Dim past events" is on), moves to "Done" in kanban, and records a completion timestamp.

22. Tasks created via the API/MCP with `scheduled_start` and `scheduled_end` parameters appear directly on the calendar grid. They do NOT land in the inbox requiring manual drag. This is the core differentiator from Morgen.

23. Tasks support subtasks — checklist items within a task, each with an optional time estimate.

23a. A subtask has: title, optional time estimate, and completion status (checked/unchecked). Subtasks are ordered and reorderable via drag.

23b. When a task has subtasks with time estimates, the parent task's calendar block duration equals the sum of subtask estimates. If the parent task also has its own time estimate set manually, the manual estimate takes precedence. Subtasks without custom time estimates are assumed to each take equal time: `parent_duration / number_of_subtasks`.

23c. The task detail view and edit form show subtasks as an inline checklist with a progress indicator (e.g., "3/7 complete"). Checking a subtask updates the progress but does not complete the parent task — all subtasks must be checked for the parent to auto-complete.

23d. **Splitting** promotes subtasks to independent tasks. When a user splits a parent task (via context menu, `⇧S`, or API), each subtask becomes its own standalone task that:
    - Appears on the kanban board as its own card
    - Can be independently scheduled on the calendar
    - Inherits the parent's tags, project, and importance
    - Gets its own time estimate (from the subtask's custom estimate, or `parent_duration / n` if no custom estimate was set)
    - Retains a `parent_id` link back to the original task

23e. A parent task that has been split shows: an aggregate progress bar (X of N subtasks complete), total time remaining, and an expand/collapse chevron to see all child tasks inline. The parent itself does NOT appear on the calendar — only its children do. The parent lives in the task panel and kanban as a grouping container.

23f. In the kanban board, split subtasks appear as individual cards. Each card shows a small breadcrumb badge linking back to the parent task (e.g., "▸ Prepare presentation"). Clicking the badge opens the parent task's detail view.

23g. A task without subtasks can still be split via the split action — this prompts for the number of chunks (N) and creates N equal-duration subtasks from the parent's time estimate. If the parent has no time estimate, the user must set one before splitting.

### Routines

24. A routine is a recurring task that regenerates on schedule. Routines render on the calendar with a checkbox and a small repeat icon, using the same dashed/outlined style as tasks.

25. The Routine tab in the creation form shows:
    - Title
    - Notes
    - Start time / End time
    - Timezone
    - Repeat pattern (every day, every weekday, custom days, etc.)
    - Location
    - Reminders
    - Visibility / Privacy

26. Checking a routine instance marks that day's occurrence as complete. The routine reappears on its next scheduled day as a fresh, independent instance.

27. Skipping a routine instance (context menu or API) marks it as skipped for that day without affecting future occurrences. Each day's instance is independent — skipping Monday does not make Tuesday show as overdue.

28a. When editing a recurring event, task, or routine, a dialog offers:
    - **Only this occurrence** — change applies to this instance only
    - **This & all future occurrences** — change applies forward from this date
    - **All occurrences** — change applies to every instance
    - **Custom** — opens a list of all instances with checkboxes, allowing selective application of the change (e.g., delete specific dates while keeping others)

### Task & Routine Panel — Sidebar Mode

28. The panel is a left-side drawer toggled via the checkbox icon in the sidebar ribbon or `⌥A`. It slides in/out, pushing the calendar grid.

29. The panel has a top-level toggle between **Tasks** and **Routines** views.

30. In **Tasks** view, items are grouped into collapsible sections:
    - **Overdue** (red indicator + count badge) — past due date
    - **Due today** — due on current date
    - **Due tomorrow** — due on next calendar day
    - **Due soon** (warning indicator + count badge) — due within 7 days after tomorrow
    - **Inbox** (count badge) — no due date or due date beyond the "due soon" window

31. In **Routines** view, routines are listed with their repeat pattern, next occurrence, and completion status for today's instance (if applicable).

32. Each sidebar item shows: title (truncated if long), due date or next occurrence, tag badges (colored), project assignment, and subtask progress (e.g., "3/7" mini indicator) if the task has subtasks.

33. Tasks and routines are draggable from the sidebar onto a calendar time slot. For tasks, this sets planned start/end. For routines, this moves today's instance (or creates an exception for that day).

34. A search field at the top filters items by title (case-insensitive substring match).

35. A "+" button opens the new task or routine creation form (matching the current view toggle).

36. A "View" filter allows filtering by tag, project, or importance.

37. A mode toggle switches between sidebar mode (list icon) and full board mode (grid icon). Full board mode expands to the kanban view.

### Kanban Board — Full Board Mode

36. Full board mode replaces the sidebar with a full-width kanban view. The calendar is off-screen (or side-by-side on wide displays — configurable in settings).

37. The kanban has four columns:
    - Backlog
    - In Progress
    - Check
    - Done

38. Two board modes toggled at the top: **Current** (active work) and **Future** (planned/experimental). Each has its own four columns. A task belongs to one board at a time.

39. A project filter dropdown (default: "All projects") filters the kanban to tasks with a specific tag/project. Multiple projects can be created and managed.

40. Tiles display: title, description (truncated to 2 lines), project label (colored), tags, due date (red if overdue), importance indicator, time estimate, and subtask progress (e.g., "3/7" with a mini progress bar) if the task has subtasks. Split subtasks show a parent breadcrumb badge (e.g., "▸ Parent Task Name") — clicking it opens the parent's detail view.

41. Tiles are draggable between columns AND reorderable within a column via @dnd-kit (fractional positioning). Dropping in a new column updates status. Moving to "In Progress" auto-sets start date to now. Moving to "Done" auto-sets completion date.

42. A "+" button on each column header creates a task pre-assigned to that column.

43. Moving a task to "Done" on kanban also checks it off on the calendar and sidebar. All three views reflect the same task state.

### Google Calendar Integration

44. Users connect Google Calendar accounts via OAuth 2.0. No limit on connected accounts.

45. Each connected account exposes its sub-calendars (e.g., primary, transferred, Partiful, etc.). Each sub-calendar can be toggled active/inactive.

46. The calendar account panel (top bar icon) lists all accounts grouped by email, each sub-calendar shown with a colored dot and active/inactive toggle.

46a. A quick-filter bar (below the top navigation or in the calendar account panel) allows toggling specific calendars on/off directly from the calendar view — without opening Settings. Clicking a calendar's color dot solos it (shows only that calendar); clicking again restores all active calendars.

47. "Connect calendars" opens the OAuth flow. No limit on accounts.

48. Events sync bidirectionally:
    - Poolendar → Google Calendar (push on create/edit/delete)
    - Google Calendar → Poolendar (via Google push notifications with periodic polling fallback)

49. Tasks and routines do NOT sync to Google Calendar. They live exclusively in Poolendar's Supabase database and render on the calendar grid client-side.

49a. When a user changes a sub-calendar's color in Poolendar, the color change syncs to Google Calendar (via the Google Calendar API's `calendarList.update` endpoint). If the API call fails (permissions, rate limit), the color is stored locally only and the failure is silently swallowed.

50. Event invites originate from the email associated with the Google Calendar account selected in the event's calendar selector.

### Booking Pages

51. Booking pages are accessed from the sidebar ribbon (calendar-with-clock icon).

52. The booking panel shows:
    - Link to the user's booking page (e.g., `nate.poolendar.com/lorecraft-30min`)
    - Public links (listed by name, duration, booking count)
    - Private links (same format, unlisted on public page)

    URL structure: `{username}.poolendar.com/{link-slug}` (e.g., `nate.poolendar.com/lorecraft-30min`). The username subdomain is the user's booking namespace; each booking link is a path under it.

53. Each booking link defines:
    - Name (e.g., "LORECRAFT - 30min")
    - Duration (30m, 60m, etc.)
    - Weekly availability grid (drag to paint available blocks)
    - Timezone (default: America/New_York)
    - Connected email (availability + invite source)
    - Conferencing (Google Meet auto-generation)
    - Location (optional)
    - Notes (optional)
    - Public or Private visibility
    - Approval mode: **Auto-approve** (default — booking is confirmed immediately) or **Requires approval** (booking is pending until the host confirms via notification)
    - Buffer time (optional): minutes before and/or after each booking to prevent back-to-back meetings (e.g., 15 min buffer → a 2:00 PM booking blocks 1:45–2:45 for a 30-min link)
    - Minimum notice (e.g., "at least 4 hours before" — prevents last-minute bookings)

54. The availability grid is a week-view where the user drags to paint available time blocks. Slots list as text above (e.g., "Every Mon, 1:00 PM - 5:00 PM"). A "Copy as text" button copies the list.

55. Right-clicking a booking link shows: Edit, Duplicate, Remove from page, Embed code, Delete.

56. All booking links for a user share the same availability pool. If "30min" and "60min" links both cover 1-5pm on Monday, and someone books the 30min at 2pm, the 60min link automatically blocks 1:30-3pm (the buffer needed for a 60min slot overlapping the booking).

57a. When a booking is confirmed (auto or after approval), the booker receives a confirmation email with a calendar invite attached plus cancel and reschedule links. The host receives a notification (browser push + email + Telegram if configured) with the booking details. If the booker cancels or reschedules via those links, the host receives a notification.

57b. The external booking page (`{username}.poolendar.com/{link-slug}`) shows:
    - User's logo + booking link name
    - Month calendar with available dates highlighted in accent color
    - Time format toggle (12h/24h)
    - Timezone selector (defaults to booker's detected timezone)
    - After selecting a date: available time slots as clickable buttons
    - After selecting a time: confirmation form (name, email, optional notes)

57. Booking page settings (in Settings) allow:
    - Public link slug customization
    - Title + welcome paragraph
    - White-labeling: toggle Poolendar branding, custom brand color (hex), logo upload (JPEG/PNG/SVG, max 500 KB)

### Tags

58. Tags are colored, numbered labels (e.g., "01 URGENT", "07 FIDGETCODING") used to categorize tasks. Tags are global across all views.

59. Tags are managed in Settings > Tags. Each has a name, color, and number prefix. Tags can be created, edited (name + color), and deleted.

60. When creating/editing a task, tags are selected from a searchable dropdown. Multiple tags per task.

61. Tags double as project identifiers for kanban filtering. Selecting a tag in the kanban filter shows only tasks with that tag.

### Frames

94. Frames are named time blocks that define when specific types of work happen. Each frame has a name (e.g., "Deep Work", "Admin", "Creative"), a color, and one or more weekly time blocks (e.g., Mon–Fri 9:00–11:00 AM). Frames are the containers the auto-scheduler fills with tasks.

95. Frames are separate from booking schedules. Schedules define when *others* can book time with you (booking links). Frames define when *your tasks* get auto-placed on the calendar. They may overlap, conflict, or have no relationship to each other.

96. Creating a frame:
    - **Quick-create on the calendar**: drag to paint a time block on an empty area, right-click → "Create Frame", name it. The painted block becomes the frame's first time block.
    - **Settings > Preferences > Frames**: full management with weekly grid painter (same drag-to-paint interaction as booking availability).
    - **API / MCP**: `POST /api/frames` with name + time_blocks.

97. Frames can be recurring (default: repeats every week on the same days/times) or one-off (a specific date range only). Recurring frames use RRULE for custom patterns (e.g., "every weekday", "every other Monday"). One-off frames are useful for temporary schedules like "Sprint Week" or "Conference Prep".

98. Toggle behavior:
    - **Master toggle** per frame: on/off in Settings or via right-click on the calendar. When off, the auto-scheduler ignores this frame entirely.
    - **Day override**: right-click a frame instance on the calendar → "Skip today" or "Skip this week". Override is stored per-date without affecting the frame definition.
    - **Global auto-scheduling toggle**: master on/off for the entire auto-scheduling engine (see #100). When global is off, all frames still render on the calendar as visual guides but no tasks are auto-placed.

99. Frames are managed in Settings > Preferences > Frames. The tab shows:
    - All frames listed, sortable by drag to set priority rank (which frame fills first when tasks are ambiguous)
    - Each frame: name, color, weekly time blocks summary, active/inactive toggle
    - Create / Edit / Delete actions
    - "AI Classification" toggle (see #107)
    - "Scoring Weights" section for tuning the priority formula (see #103)
    - Global auto-scheduling on/off toggle

### Auto-Scheduling

100. Auto-scheduling places unscheduled tasks onto the calendar automatically, filling frame time blocks based on a priority score. It is opt-in — off by default, toggled on in Settings > Preferences > Frames.

101. When auto-scheduling is toggled **on**, existing unscheduled tasks (no `scheduled_start`/`scheduled_end`) are scored, ranked, and placed into upcoming frame instances. A preview modal shows what the scheduler proposes (task → frame instance mapping) before confirming. The user can exclude individual tasks or accept all.

102. When auto-scheduling is toggled **off**, a dialog asks:
    - **"Keep all auto-scheduled tasks where they are"** — tasks stay on the calendar as if manually placed
    - **"Unschedule all auto-scheduled tasks"** — tasks return to unscheduled state (inbox/backlog)
    - **"Turn off for today only"** — auto-scheduling pauses until midnight, then resumes
    - **"Cancel"** — don't turn off

103. The priority score determines scheduling order. It is a weighted sum of four factors:

    - **Urgency** (task importance field): Highest = 5, High = 4, Normal = 3, Low = 2, Lowest = 1. Normalized to 0–1.
    - **Deadline pressure**: `max(0, 1 - (days_until_due / 14))`. A task due tomorrow scores ~0.93; due in a week scores ~0.5; due in 2+ weeks or "Someday" scores 0.
    - **Tag priority**: each tag has an optional priority rank (1–10, default 5). The highest-priority tag on the task is used. Normalized to 0–1. Tasks with no tags use default 5.
    - **Staleness**: `min(1, days_since_creation / 30)`. Older unscheduled tasks get a small boost to prevent perpetual backlog rot.

    Default weights: urgency **0.35**, deadline **0.30**, tag priority **0.20**, staleness **0.15**. Weights are adjustable in Settings > Preferences > Frames > Scoring Weights. The final score is `Σ(weight × factor)`, range 0–1.

104. The scheduler assigns tasks to frame instances based on frame type matching (see AI Classification, #107–109). When a task matches multiple frames, it goes into the highest-priority-rank frame that has available time. When no frame matches (or AI is off), the task goes into any frame with capacity, highest-priority frame first.

105. The scheduler respects:
    - Task time estimate (a 2h task won't fit in a 30min frame gap)
    - Existing calendar events (frame time minus events = available capacity)
    - `earliest_start` date (won't schedule before this date)
    - Due date (won't schedule after due date)
    - Frame priority rank (fills higher-rank frames first)
    - Buffer between auto-scheduled blocks (minimum 0min, configurable)

106. **Subtask distribution**: when a split parent task's children are unscheduled, the scheduler treats each child as an independent scheduling unit. Children may land in different frame instances across different days. Example: "Prepare Presentation" split into 3 children — "Research" lands in Monday's Deep Work, "Outline" in Tuesday's Deep Work, "Design Slides" in Wednesday's Creative. The scheduler distributes based on each child's individual score and frame affinity.

### AI Frame Classification

107. AI frame classification (optional, toggled in Settings > Preferences > Frames) automatically classifies unscheduled tasks into the most appropriate frame based on the task's title and notes content.

108. Classification uses a two-layer approach:
    - **Layer 1 — Keyword extraction** (instant, no API cost): a local ruleset maps common keywords to frame names. Examples: "write code", "debug", "implement", "refactor" → "Deep Work"; "email", "invoice", "filing", "expenses" → "Admin"; "brainstorm", "design", "sketch", "write copy" → "Creative". The ruleset is seeded from the user's frame names and descriptions, then evolves as the user makes corrections.
    - **Layer 2 — LLM fallback** (Haiku-tier, <$0.001/call): when Layer 1 confidence is below threshold (configurable, default 0.6), the task title + notes are sent to a lightweight LLM with the user's frame list as context. The LLM returns a frame name. This fires only for ambiguous cases — most tasks resolve at Layer 1.

109. **Learning from corrections**: when a user manually moves an auto-scheduled task from one frame to another (e.g., drags "Write blog post" from Admin to Creative), the system records the correction. After 3 corrections (configurable) for a keyword or pattern, the keyword ruleset updates automatically. The learning is per-user and persists across sessions.

### Notifications

62. Four notification channels:
    - **Browser push** (default: on) — reminders, due dates, bookings
    - **Email** (default: off, toggleable) — same triggers
    - **In-app visual** — toast/badge for active session
    - **Telegram bot** (optional) — configured via bot token + chat ID in Settings > Integrations

63. Each channel can be independently enabled/disabled per notification type (reminders, due dates, bookings, schedule changes).

64. Telegram bot sends messages for configured types once a bot token and chat ID are entered in Settings > Integrations.

65. Reminder timing is configurable per event/task: 1, 5, 10, 15, 30 minutes, 1 hour, 1 day before. Multiple reminders per item.

### Settings

66. Settings are accessed from the sidebar ribbon (bottom icon, gear/avatar). Modal overlay with left navigation + right content area.

67. Settings navigation:
    - **Explore:** Shortcuts
    - **Integrations:** Calendars, Video conferencing, Telegram
    - **Preferences:** General, Active calendars, Tags, Frames, Availability, Booking page
    - **Account:** Profile

68. **General** settings:
    - Default calendar for events (Automatic or specific)
    - Default calendar for tasks/routines (Automatic or specific)
    - Privacy default for tasks/routines (Private / Public)
    - Busy/Free default for tasks/routines (Busy / Free)
    - Move task due date behavior (Ask / Always / Never)
    - Automatically assign due dates (Yes / No)
    - Timezone (default: America/New_York)
    - Language + time format (English 12H / English 24H)
    - First day of week (Sunday / Monday)
    - Initial calendar view (Day / Week / Month)
    - Theme (Dark — customizable accent colors)
    - Time grid start/end
    - Time display resolution (default: 15 min)
    - Time dragging resolution (default: 15 min)
    - Limit events per day (default: 4)
    - Default task duration (default: 30 min) — used when a task has no time estimate
    - Undo grace period (default: 30 seconds)

69. **Active calendars** shows connected Google accounts with sub-calendar toggles, notification bell toggles, "Resync account" and "Manage account" buttons.

70. **Profile** shows: avatar (uploadable), email, name, company, plan info, account ID. Sign out button.

### Keyboard Shortcuts

71. Full shortcut set (matching Morgen, adapted for Poolendar):

    **General:**
    - `⌘F` — Search
    - `P` — General preferences
    - `⌘Z` — Undo
    - `.` — List shortcuts
    - `?` or `/` — Help
    - `]` — Increase time resolution
    - `[` — Reduce time resolution

    **Quick access:**
    - `⌘K` — Command bar
    - `⌥A` — Toggle task panel
    - `⌥S` — Toggle booking page panel
    - `Space` — Toggle left drawer

    **Calendar views:**
    - `R` — Refresh calendars
    - `T` — Jump to today
    - `→` — Next period
    - `←` — Previous period
    - `D` — Day view
    - `W` — Week view
    - `M` — Month view
    - `X` — 2 weeks view
    - `⌥1`–`⌥9` — Custom day views

    **Events and tasks:**
    - `C` — Create event
    - `E` — Edit selected
    - `Delete` / `Backspace` — Delete selected
    - `Esc` — Discard creation
    - `⌘Enter` — Save
    - `⌘C` / `⌘V` — Copy / Paste
    - `N` then `T` — New task
    - `⇧R` — Reschedule
    - `⇧F` — Schedule follow-up
    - `⇧S` — Split and reschedule

### Command Bar

72a. `⌘K` opens a full-screen command bar overlay ("What do you need?"). It is the master search for everything in the app.

72b. The command bar shows three sections:
    - **Actions** — create event (`C`), create task (`N T`), refresh calendars (`R`), toggle tasks (`⌥A`), toggle booking (`⌥S`), and all other keyboard-shortcut-mapped actions with their hotkeys displayed
    - **Shortcuts** — quick links to settings panels and feature toggles
    - **Search results** — as you type, results appear grouped by type (events, tasks, routines, booking links, settings). Clicking a result navigates to it (events/tasks jump to that date on the calendar and open the edit form; settings open that settings panel).

72c. Search queries match against titles, notes content, tag names, and attendee emails across ALL time (past and future). Completed/done tasks are included in results. Results are ranked by recency and relevance.

### Undo / Redo

72d. A persistent Undo/Redo button pair sits in the top ribbon of the calendar (not just a disappearing toast). Undo is also triggered via `⌘Z`, redo via `⌘⇧Z`.

72e. Undo grace period is 30 seconds for destructive operations (delete, complete, move). During this window the operation can be reversed with one click or `⌘Z`.

72f. Undo history persists for the current session (until page refresh/close). Depth: last 50 operations.

### Mobile Responsive

72g. The webapp is fully responsive with full feature parity on mobile browsers (Safari, Chrome). All features — calendar grid, task panel, kanban, booking pages, settings, notifications — work on mobile. A native mobile app is a future goal.

72h. On mobile viewports (<768px): the sidebar ribbon collapses to a bottom tab bar; the task panel opens as a full-screen overlay instead of a side drawer; the kanban board scrolls horizontally; calendar drag interactions use touch-and-hold instead of click-and-drag.

### Offline Behavior

72i. Local edits queue in IndexedDB when the browser loses connection. A subtle offline indicator appears. All create/edit/delete operations continue to work against the local store.

72j. When the connection is restored, queued edits sync to the server automatically (last-write-wins for conflicting fields). If a conflict cannot be auto-resolved (e.g., an event was deleted by another client), the user sees a resolution prompt.

### Left Sidebar Ribbon

72. Narrow vertical ribbon with icons (top to bottom):
    - Task panel toggle (checkbox icon)
    - Calendar view (returns to calendar from other views)
    - Booking page toggle (calendar-with-clock icon)
    - Frames (layers/stack icon — opens Frames management panel or navigates to Settings > Frames)
    - --- separator ---
    - Settings / Profile (gear or avatar, bottom-anchored)

73. Excluded from Morgen: team icon, help icon, gift box, open invites.

### API

74. Poolendar exposes a REST API at `/api/*` routes. Authentication via API key (generated in Settings > Profile) or OAuth session token.

75. Operations:

    **Google Calendar:**
    - `GET /api/google/connect` — initiate Google OAuth flow (redirects to consent screen)
    - `GET /api/google/callback` — OAuth callback handler
    - `DELETE /api/google/disconnect/:id` — disconnect account
    - `POST /api/google/sync` — trigger manual sync for an account
    - `POST /api/google/webhook` — Google push notification receiver

    **Events:**
    - `GET /api/events` — list (filterable by date range, calendar)
    - `POST /api/events` — create (attendees, conferencing, recurrence)
    - `PATCH /api/events/:id` — update
    - `DELETE /api/events/:id` — delete
    - `POST /api/events/:id/rsvp` — accept / decline / tentative

    **Tasks:**
    - `GET /api/tasks` — list (filterable by tag, project, status, due date range)
    - `POST /api/tasks` — create. Accepts optional `scheduled_start` and `scheduled_end` to place directly on calendar. Without these, task goes to inbox.
    - `PATCH /api/tasks/:id` — update
    - `DELETE /api/tasks/:id` — delete
    - `POST /api/tasks/:id/complete` — mark done
    - `POST /api/tasks/:id/reopen` — reopen
    - `POST /api/tasks/:id/move` — change kanban column/board
    - `POST /api/tasks/:id/split` — promote subtasks to independent tasks (or split into N equal chunks if no subtasks exist)
    - `GET /api/tasks/:id/subtasks` — list subtasks of a parent task
    - `POST /api/tasks/:id/subtasks` — add a subtask (title, optional time_estimate)
    - `PATCH /api/tasks/:id/subtasks/:subtask_id` — update subtask (title, time_estimate, completed)
    - `DELETE /api/tasks/:id/subtasks/:subtask_id` — remove a subtask
    - `POST /api/tasks/:id/subtasks/reorder` — reorder subtasks (accepts ordered list of subtask IDs)
    - `POST /api/tasks/:id/schedule` — place unscheduled task onto a time slot

    **Routines:**
    - `GET /api/routines` — list all
    - `POST /api/routines` — create (with repeat pattern)
    - `GET /api/routines/:id` — get single routine
    - `PATCH /api/routines/:id` — update
    - `DELETE /api/routines/:id` — delete
    - `GET /api/routines/:id/instances` — list instances for a routine
    - `PATCH /api/routines/:id/instances/:date` — update instance (set status to completed/skipped/pending, override times/title)

    **Booking:**
    - `GET /api/booking-links` — list
    - `POST /api/booking-links` — create
    - `GET /api/booking-links/:id` — get single booking link
    - `PATCH /api/booking-links/:id` — update
    - `DELETE /api/booking-links/:id` — delete
    - `GET /api/booking-links/:id/bookings` — list bookings
    - `GET /api/booking-links/:id/availability` — available slots (external)
    - `POST /api/booking-links/:id/book` — book a slot (external)

    **Tags:**
    - `GET /api/tags` — list
    - `POST /api/tags` — create (name, color, prefix)
    - `PATCH /api/tags/:id` — update
    - `DELETE /api/tags/:id` — delete

    **Frames:**
    - `GET /api/frames` — list all frames
    - `POST /api/frames` — create (name, color, time_blocks, recurrence_rule, description)
    - `PATCH /api/frames/:id` — update
    - `DELETE /api/frames/:id` — delete
    - `POST /api/frames/:id/toggle` — toggle active/inactive
    - `POST /api/frames/:id/override` — add a day override (skip a specific date)
    - `POST /api/frames/reorder` — reorder frame priority ranks

    **Auto-Scheduling:**
    - `POST /api/auto-schedule/run` — trigger a scheduling pass (scores + places unscheduled tasks). Returns proposed placements for confirmation or applies directly if `confirm: true`.
    - `POST /api/auto-schedule/preview` — dry run: returns scored task list with proposed frame assignments without applying
    - `POST /api/auto-schedule/unschedule` — remove all auto-scheduled placements (tasks return to unscheduled)
    - `GET /api/auto-schedule/status` — current auto-scheduling state (enabled/disabled, last run, task count)
    - `POST /api/auto-schedule/classify` — classify a single task into a frame (returns frame_id + confidence)
    - `GET /api/auto-schedule/settings` — get auto-scheduling configuration (weights, thresholds)
    - `PATCH /api/auto-schedule/settings` — update auto-scheduling configuration

    **Schedules (booking availability):**
    - `GET /api/schedules` — list named schedules
    - `POST /api/schedules` — create (name + time blocks)
    - `PATCH /api/schedules/:id` — update
    - `DELETE /api/schedules/:id` — delete

    **Type Conversion:**
    - `POST /api/convert` — convert between types. Body: `{source_type, source_id, target_type, calendar_id?, repeat_pattern?}`. Handles all 6 directions (event↔task↔routine). Returns the newly created item. Side effects (Google Cal event creation/deletion) are applied automatically.

    **Profile:**
    - `GET /api/profile` — authenticated user's profile and settings
    - `PATCH /api/profile` — update profile information or settings

    **API Keys:**
    - `GET /api/api-keys` — list all API keys for the user
    - `POST /api/api-keys` — generate a new named API key
    - `DELETE /api/api-keys/:id` — revoke an API key

    **Search:**
    - `GET /api/search?q=...` — full-text across events, tasks, routines

    **Undo:**
    - `POST /api/undo` — undo last operation

76. Every write returns the full updated object. Every list supports cursor-based pagination, filtering, and sorting.

77. Standard HTTP status codes: 200, 201, 204 (deletes), 400, 401, 404, 422 (validation), 429 (rate limit), 500.

78. Rate limits per API key: 1000 reads/min, 100 writes/min.

### MCP Server

79. Poolendar ships an MCP server as a separate npm package (`poolendar-mcp`) installable via `claude mcp add poolendar -- npx poolendar-mcp`. The MCP wraps the REST API.

80. MCP tools have rich descriptions optimized for LLM interpretation. The LLM client handles natural language — tools accept structured parameters.

81. MCP tools:

    **Morgen-parity (12 tools):**
    - `list_events` — events with date range filter
    - `create_event` — with attendees, conferencing, recurrence
    - `get_event` — single event by ID
    - `update_event` — modify event
    - `delete_event` — remove event
    - `rsvp_event` — respond to invitation
    - `list_tasks` — with filters (tag, status, due date)
    - `create_task` — with optional `scheduled_start`/`scheduled_end` for direct calendar placement
    - `update_task` — modify task
    - `delete_task` — remove task
    - `close_task` — mark completed
    - `reopen_task` — reopen completed task

    **Poolendar-exclusive (56 tools):**
    - `move_task` — change kanban column/board
    - `schedule_task` — place unscheduled task onto a calendar time slot
    - `get_task` — single task by ID
    - `split_task` — promote subtasks to independent tasks (or split into N equal chunks)
    - `list_subtasks` — subtasks of a parent task
    - `create_subtask` — add subtask with optional time estimate
    - `update_subtask` — modify subtask title/estimate/completion
    - `delete_subtask` — remove subtask
    - `reorder_subtasks` — reorder subtasks (accepts ordered list of subtask IDs)
    - `complete_subtask` — check off a subtask
    - `list_routines` — all routines
    - `create_routine` — with repeat pattern
    - `get_routine` — single routine by ID
    - `update_routine` — modify
    - `delete_routine` — remove
    - `complete_routine_instance` — check off a date's occurrence
    - `skip_routine_instance` — skip a date's occurrence
    - `list_booking_links` — booking page links
    - `create_booking_link` — with availability
    - `get_booking_link` — single booking link by ID
    - `update_booking_link` — modify
    - `delete_booking_link` — remove
    - `book_slot` — book a slot on a booking link (external)
    - `list_bookings` — bookings through a link
    - `get_availability` — available slots for a booking link (external)
    - `list_tags` — all tags
    - `create_tag` — new tag
    - `get_tag` — single tag by ID
    - `update_tag` — modify
    - `delete_tag` — remove
    - `convert_item` — convert between types (event/task/routine, all 6 directions). Body: `{source_type, source_id, target_type, calendar_id?, repeat_pattern?}`. Side effects (Google Cal event creation/deletion) applied automatically.
    - `search` — full-text across all entities
    - `list_frames` — all frames with time blocks and status
    - `create_frame` — new frame (name, color, time_blocks, description, recurrence)
    - `update_frame` — modify frame
    - `delete_frame` — remove frame
    - `toggle_frame` — activate/deactivate a frame
    - `skip_frame_day` — add a day override to skip a frame on a specific date
    - `auto_schedule_run` — trigger auto-scheduling (scores + places tasks into frames)
    - `auto_schedule_preview` — dry run showing proposed placements without applying
    - `auto_schedule_unschedule` — remove all auto-scheduled placements
    - `auto_schedule_status` — current engine state (enabled, last run, counts)
    - `classify_task` — classify a single task into a frame (returns frame + confidence)
    - `list_schedules` — booking availability schedules
    - `get_schedule` — single schedule by ID
    - `create_schedule` — new booking schedule
    - `update_schedule` — modify booking schedule
    - `delete_schedule` — remove booking schedule
    - `get_profile` — authenticated user's profile and settings
    - `update_profile` — modify profile information or settings
    - `list_api_keys` — all API keys for the user
    - `create_api_key` — generate a new named API key
    - `delete_api_key` — revoke an API key
    - `bulk_create_tasks` — create multiple tasks in one call
    - `bulk_update_tasks` — update multiple tasks in one call
    - `bulk_delete_tasks` — delete multiple tasks in one call

82. The `create_task` tool description explicitly states that `scheduled_start` and `scheduled_end` place the task directly on the calendar grid — not the inbox. This is the killer feature.

82a. The `auto_schedule_run` tool description explicitly states that it scores all unscheduled tasks and places them into frame time blocks based on priority, deadline pressure, tag priority, and staleness — the second killer feature.

83. MCP authenticates via API key stored in MCP configuration (not re-entered per call).

83a. Tool count: 12 Morgen-parity + 56 Poolendar-exclusive = 68 total (including 11 frame/auto-schedule tools, 3 bulk operations, 5 profile/API-key management, and 8 get-by-ID tools).

### Theme & Customization

84. Dark theme is the default: dark charcoal background, subtle grid lines, white/light-gray text, colored event blocks matching each calendar's assigned color.

85. Current day's date number has an accent-colored circular badge.

86. Past events dim (reduced opacity) when "Dim past events" is on.

87. Tasks have dashed/outlined borders + checkbox icon, visually distinct from solid-fill events.

88. Routines look like tasks but display a small repeat icon.

89. In Settings > General > Theme, users customize:
    - Accent color (hex picker — buttons, highlights, active states)
    - Calendar-specific colors (per sub-calendar)
    - Background density (compact / comfortable / spacious — row height)

90. The external booking page inherits the brand color and logo from Settings > Booking page.

### Authentication

91. Auth uses Supabase Auth with Google OAuth (same flow as calendar connection) + optional email/password. Single-user focus for v1 — the system works for up to ~10 users but no growth infrastructure is built.

92. API keys are generated in Settings > Profile. Multiple named keys are supported (e.g., "Claude Code", "n8n", "Telegram Bot"). Each key can be individually revoked. Keys are displayed once on creation and never shown again.

93. The MCP server authenticates via one of these named API keys, stored in the MCP configuration file.

## References

- **cal.diy** — MIT fork of Cal.com (43k stars), community-driven open-source scheduling platform. Reference for booking page implementation patterns, availability pooling, and embed code generation.

## Open Questions

- **AI classification model hosting:** Use Anthropic Haiku API directly, or proxy through a Supabase Edge Function for cost tracking? Edge Function adds latency but centralizes billing.
- **Frame conflict with events:** When a Google Calendar event lands inside a frame's time block, should the scheduler treat that time as unavailable (subtract event duration from frame capacity), or ignore events? Current spec: subtract (#105).
- **Routine hot zones:** Should skipped routines auto-reslot into a preferred window later that day? Deferred — routines and frames are independent for v1.
- **Conflict resolution:** When an API-scheduled task overlaps an existing event — reject, warn, or allow? Current spec: allow overlap.
- **PWA:** Service worker for offline + push? Likely yes given mobile-first responsive requirement, but adds complexity.
