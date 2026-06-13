import { vi } from 'vitest'

// Provide crypto.randomUUID in jsdom (not available by default)
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...globalThis.crypto,
      randomUUID: () =>
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
        }),
    },
  })
}

// Global fetch mock — each test resets via beforeEach
globalThis.fetch = vi.fn()
