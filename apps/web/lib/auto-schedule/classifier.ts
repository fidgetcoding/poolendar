export interface ClassificationResult {
  frame_id: string
  frame_name: string
  confidence: number
  layer: 'keyword' | 'llm'
}

export interface KeywordEntry {
  frame_id: string
  frame_name: string
  keyword: string
  weight: number
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 1)
}

const SYNONYM_MAP: Record<string, string[]> = {
  code: ['debug', 'implement', 'refactor', 'programming', 'develop', 'deploy'],
  admin: ['email', 'invoice', 'filing', 'paperwork', 'organize'],
  design: ['mockup', 'wireframe', 'prototype', 'figma', 'sketch'],
  meeting: ['call', 'standup', 'sync', 'review', 'huddle'],
  writing: ['blog', 'article', 'documentation', 'draft', 'copywriting'],
  exercise: ['workout', 'gym', 'run', 'training', 'fitness'],
  research: ['investigate', 'explore', 'study', 'analyze', 'survey'],
}

export function classifyByKeywords(
  taskTitle: string,
  taskNotes: string | null,
  keywords: KeywordEntry[],
  threshold: number = 0.6,
): ClassificationResult | null {
  const tokens = new Set([
    ...tokenize(taskTitle),
    ...(taskNotes ? tokenize(taskNotes) : []),
  ])

  if (tokens.size === 0) return null

  const frameScores = new Map<string, { total: number; name: string }>()

  for (const entry of keywords) {
    const kw = entry.keyword.toLowerCase()
    let matched = false

    if (tokens.has(kw)) {
      matched = true
    } else {
      // Check if the keyword is a multi-word phrase where all tokens are present
      const kwTokens = tokenize(kw)
      if (kwTokens.length > 1 && kwTokens.every((t) => tokens.has(t))) {
        matched = true
      }
    }

    if (matched) {
      const existing = frameScores.get(entry.frame_id) ?? {
        total: 0,
        name: entry.frame_name,
      }
      existing.total += entry.weight
      frameScores.set(entry.frame_id, existing)
    }
  }

  if (frameScores.size === 0) return null

  const sorted = [...frameScores.entries()].sort(
    (a, b) => b[1].total - a[1].total,
  )

  const best = sorted[0]
  if (!best) return null

  const maxScore = best[1].total
  const totalWeight = sorted.reduce((sum, [, v]) => sum + v.total, 0)
  const confidence = totalWeight > 0 ? maxScore / totalWeight : 0

  if (confidence < threshold) return null

  // Require 1.5x margin over second-best
  const second = sorted[1]
  if (second) {
    const secondScore = second[1].total
    if (secondScore > 0 && maxScore < secondScore * 1.5) return null
  }

  return {
    frame_id: best[0],
    frame_name: best[1].name,
    confidence,
    layer: 'keyword',
  }
}

export function seedKeywords(
  frames: { id: string; name: string; description: string | null }[],
): KeywordEntry[] {
  const entries: KeywordEntry[] = []

  for (const frame of frames) {
    const nameTokens = tokenize(frame.name)
    const descTokens = frame.description ? tokenize(frame.description) : []
    const allTokens = new Set([...nameTokens, ...descTokens])

    for (const token of allTokens) {
      entries.push({
        frame_id: frame.id,
        frame_name: frame.name,
        keyword: token,
        weight: 0.8,
      })

      // Add synonyms
      const synonyms = SYNONYM_MAP[token]
      if (synonyms) {
        for (const syn of synonyms) {
          entries.push({
            frame_id: frame.id,
            frame_name: frame.name,
            keyword: syn,
            weight: 0.6,
          })
        }
      }
    }
  }

  return entries
}
