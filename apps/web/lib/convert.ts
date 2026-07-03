// Pure helpers for the type-conversion flow (#13). The confirm-dialog copy and
// the /api/convert request body are derived here so they can be unit-tested
// without a browser.

export type ItemType = 'event' | 'task' | 'routine'

export interface ConvertItemInfo {
  /** Number of attendees on the source event (event -> task/routine). */
  attendeeCount?: number
  /** Number of subtasks on the source task (task -> event/routine). */
  subtaskCount?: number
}

export interface ConvertRequirements {
  /** A blocking confirmation is required before converting. */
  needsConfirm: boolean
  /** The warning to show, or null when no confirmation is needed. */
  message: string | null
  /** target is a routine → the user must supply a repeat pattern. */
  needsRepeatPattern: boolean
  /** target is an event → a destination calendar is required. */
  needsCalendar: boolean
}

/**
 * The side effects and prerequisites of converting `sourceType` -> `targetType`
 * for an item with the given attendee/subtask counts.
 */
export function convertRequirements(
  sourceType: ItemType,
  targetType: ItemType,
  info: ConvertItemInfo = {}
): ConvertRequirements {
  const attendeeCount = info.attendeeCount ?? 0
  const subtaskCount = info.subtaskCount ?? 0

  let message: string | null = null

  if (
    sourceType === 'event' &&
    (targetType === 'task' || targetType === 'routine') &&
    attendeeCount > 0
  ) {
    // Google event is deleted; attendees get a cancellation.
    message =
      'This will remove the event from Google Calendar. Attendees will be notified of cancellation.'
  } else if (
    sourceType === 'task' &&
    (targetType === 'event' || targetType === 'routine') &&
    subtaskCount > 0
  ) {
    message = `This task has ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'} that will be removed. Continue?`
  }

  return {
    needsConfirm: message !== null,
    message,
    needsRepeatPattern: targetType === 'routine',
    needsCalendar: targetType === 'event',
  }
}

export interface ConvertBodyInput {
  sourceType: ItemType
  sourceId: string
  targetType: ItemType
  calendarId?: string | null
  repeatPattern?: string | null
}

export interface ConvertBody {
  source_type: ItemType
  source_id: string
  target_type: ItemType
  calendar_id?: string
  repeat_pattern?: string
}

/** Build the POST /api/convert body, omitting empty optional fields. */
export function buildConvertBody(input: ConvertBodyInput): ConvertBody {
  const body: ConvertBody = {
    source_type: input.sourceType,
    source_id: input.sourceId,
    target_type: input.targetType,
  }
  if (input.calendarId) body.calendar_id = input.calendarId
  if (input.repeatPattern) body.repeat_pattern = input.repeatPattern
  return body
}
