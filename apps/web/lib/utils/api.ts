import { createClient } from '../supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: Record<string, unknown> | unknown[]
  params?: Record<string, string | number | boolean | undefined>
}

interface ApiResponse<T> {
  data: T
  status: number
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: {
      error: string
      message?: string
      details?: Record<string, string[]>
    }
  ) {
    super(body.message || body.error)
    this.name = 'ApiError'
  }
}

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  // SSR / build-time fallback
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  return 'http://localhost:3000'
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const { body, params, headers: extraHeaders, ...restInit } = options

  // Build URL with query params
  const url = new URL(path, getBaseUrl())
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  // Build headers
  const headers = new Headers(extraHeaders)

  if (!headers.has('Content-Type') && body) {
    headers.set('Content-Type', 'application/json')
  }

  // Inject auth token from Supabase session
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`)
    }
  } catch {
    // Auth unavailable (SSR context, etc.) — proceed without token
  }

  // Execute fetch
  const response = await fetch(url.toString(), {
    ...restInit,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  // Handle errors
  if (!response.ok) {
    let errorBody: {
      error: string
      message?: string
      details?: Record<string, string[]>
    }

    try {
      errorBody = await response.json()
    } catch {
      errorBody = {
        error: response.statusText,
        message: `Request failed with status ${response.status}`,
      }
    }

    // Normalize: ensure `error` field exists
    if (!errorBody.error) {
      errorBody.error = errorBody.message || response.statusText
    }

    throw new ApiError(response.status, response.statusText, errorBody)
  }

  // Parse successful response
  let data: T

  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.includes('application/json')) {
    data = await response.json()
  } else if (response.status === 204) {
    // No content
    data = undefined as T
  } else {
    // Attempt JSON parse; fall back to text cast
    const text = await response.text()
    try {
      data = JSON.parse(text)
    } catch {
      data = text as T
    }
  }

  return { data, status: response.status }
}

// ---------------------------------------------------------------------------
// Convenience methods
// ---------------------------------------------------------------------------

export const api = {
  get: <T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ) => apiFetch<T>(path, { method: 'GET', params }),

  post: <T>(path: string, body?: Record<string, unknown>) =>
    apiFetch<T>(path, { method: 'POST', body }),

  patch: <T>(path: string, body?: Record<string, unknown>) =>
    apiFetch<T>(path, { method: 'PATCH', body }),

  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
}
