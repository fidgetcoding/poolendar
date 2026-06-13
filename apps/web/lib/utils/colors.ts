// ---------------------------------------------------------------------------
// Calendar color palette (matches Google Calendar)
// ---------------------------------------------------------------------------

export const CALENDAR_COLORS: { name: string; hex: string }[] = [
  { name: 'Tomato', hex: '#D50000' },
  { name: 'Flamingo', hex: '#E67C73' },
  { name: 'Tangerine', hex: '#F4511E' },
  { name: 'Banana', hex: '#F6BF26' },
  { name: 'Sage', hex: '#33B679' },
  { name: 'Basil', hex: '#0B8043' },
  { name: 'Peacock', hex: '#039BE5' },
  { name: 'Blueberry', hex: '#3F51B5' },
  { name: 'Lavender', hex: '#7986CB' },
  { name: 'Grape', hex: '#8E24AA' },
  { name: 'Graphite', hex: '#616161' },
  { name: 'Calendar', hex: '#4285F4' },
]

// ---------------------------------------------------------------------------
// Hex <-> RGB conversion
// ---------------------------------------------------------------------------

/** Convert a hex string (e.g. "#D50000" or "D50000") to an RGB object. */
export function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  const sanitized = hex.replace(/^#/, '')

  let fullHex = sanitized
  if (fullHex.length === 3) {
    fullHex = fullHex
      .split('')
      .map((c) => c + c)
      .join('')
  }

  if (fullHex.length !== 6) return null

  const num = parseInt(fullHex, 16)
  if (isNaN(num)) return null

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

/**
 * Calculate a contrasting text color (black or white) for the given
 * background hex using the relative luminance formula.
 */
export function getContrastColor(hex: string): '#000000' | '#FFFFFF' {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#000000'

  // Relative luminance per WCAG
  const luminance =
    (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255

  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

/**
 * Lighten a hex color by a percentage (0-1).
 * amount=0.2 means 20% lighter toward white.
 */
export function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const clamped = Math.max(0, Math.min(1, amount))
  return rgbToHex(
    rgb.r + (255 - rgb.r) * clamped,
    rgb.g + (255 - rgb.g) * clamped,
    rgb.b + (255 - rgb.b) * clamped
  )
}

/**
 * Darken a hex color by a percentage (0-1).
 * amount=0.2 means 20% darker toward black.
 */
export function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const clamped = Math.max(0, Math.min(1, amount))
  return rgbToHex(
    rgb.r * (1 - clamped),
    rgb.g * (1 - clamped),
    rgb.b * (1 - clamped)
  )
}

/**
 * Get a color with reduced opacity (returns an rgba string).
 * e.g., withOpacity("#D50000", 0.3) -> "rgba(213, 0, 0, 0.3)"
 */
export function withOpacity(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const clamped = Math.max(0, Math.min(1, opacity))
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamped})`
}
