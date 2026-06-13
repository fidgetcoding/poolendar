import { describe, it, expect } from 'vitest'
import {
  tokenize,
  classifyByKeywords,
  seedKeywords,
  type KeywordEntry,
} from '../classifier'

// ---------------------------------------------------------------------------
// tokenize()
// ---------------------------------------------------------------------------
describe('tokenize', () => {
  it('lowercases, strips punctuation, and splits on whitespace', () => {
    expect(tokenize('Fix the BUG, please!')).toEqual([
      'fix',
      'the',
      'bug',
      'please',
    ])
  })

  it('returns an empty array for an empty string', () => {
    expect(tokenize('')).toEqual([])
  })

  it('filters out single-character tokens', () => {
    // "a" and "I" are 1-char, should be dropped
    expect(tokenize('I wrote a test')).toEqual(['wrote', 'test'])
  })

  it('handles special characters and numbers', () => {
    expect(tokenize('v2.0: deploy #42')).toEqual(['v20', 'deploy', '42'])
  })

  it('preserves hyphens inside words', () => {
    // The regex [^\w\s-] keeps hyphens
    expect(tokenize('end-to-end testing')).toEqual(['end-to-end', 'testing'])
  })

  it('collapses multiple spaces into single splits', () => {
    expect(tokenize('  debug   the   thing  ')).toEqual([
      'debug',
      'the',
      'thing',
    ])
  })
})

// ---------------------------------------------------------------------------
// classifyByKeywords()
// ---------------------------------------------------------------------------
describe('classifyByKeywords', () => {
  const frameA = { frame_id: 'frame-a', frame_name: 'Deep Work' }
  const frameB = { frame_id: 'frame-b', frame_name: 'Admin' }

  function kw(
    frame: { frame_id: string; frame_name: string },
    keyword: string,
    weight: number,
  ): KeywordEntry {
    return { ...frame, keyword, weight }
  }

  it('matches a task title containing a keyword', () => {
    const keywords = [kw(frameA, 'debug', 1.0)]
    const result = classifyByKeywords('Debug the parser', null, keywords)

    expect(result).not.toBeNull()
    expect(result!.frame_id).toBe('frame-a')
    expect(result!.frame_name).toBe('Deep Work')
    expect(result!.layer).toBe('keyword')
  })

  it('sums weights when multiple keywords match the same frame', () => {
    const keywords = [
      kw(frameA, 'debug', 0.5),
      kw(frameA, 'parser', 0.5),
    ]
    // Both "debug" and "parser" appear in the title -> total 1.0
    const result = classifyByKeywords(
      'Debug the parser',
      null,
      keywords,
    )

    expect(result).not.toBeNull()
    expect(result!.frame_id).toBe('frame-a')
    expect(result!.confidence).toBe(1) // 1.0 / 1.0
  })

  it('returns a classification when confidence is above threshold', () => {
    // Single frame, single keyword match -> confidence = 1.0 (above 0.6)
    const keywords = [kw(frameA, 'refactor', 0.8)]
    const result = classifyByKeywords('Refactor auth module', null, keywords)

    expect(result).not.toBeNull()
    expect(result!.confidence).toBeGreaterThanOrEqual(0.6)
  })

  it('returns null when confidence is below threshold', () => {
    // Two frames, similar weights -> confidence = maxScore / totalWeight
    // frameA: 0.4, frameB: 0.35 => confidence = 0.4/0.75 = 0.533 (below 0.6)
    const keywords = [
      kw(frameA, 'review', 0.4),
      kw(frameB, 'email', 0.35),
    ]
    const result = classifyByKeywords(
      'Review the email draft',
      null,
      keywords,
    )

    expect(result).toBeNull()
  })

  it('returns null when top score is less than 1.5x the second-highest', () => {
    // frameA: 0.9, frameB: 0.7 => 0.9 < 0.7*1.5 (1.05) => null
    const keywords = [
      kw(frameA, 'build', 0.9),
      kw(frameB, 'build', 0.7),
    ]
    const result = classifyByKeywords('Build the thing', null, keywords)

    expect(result).toBeNull()
  })

  it('returns a result when top score is >= 1.5x the second-highest', () => {
    // frameA: 1.5, frameB: 0.5 => 1.5 >= 0.5*1.5 (0.75) => passes
    // confidence = 1.5/2.0 = 0.75 => above 0.6
    const keywords = [
      kw(frameA, 'code', 0.8),
      kw(frameA, 'deploy', 0.7),
      kw(frameB, 'email', 0.5),
    ]
    const result = classifyByKeywords(
      'Code and deploy the email service',
      null,
      keywords,
    )

    expect(result).not.toBeNull()
    expect(result!.frame_id).toBe('frame-a')
  })

  it('returns null when no keywords match', () => {
    const keywords = [
      kw(frameA, 'debug', 1.0),
      kw(frameB, 'invoice', 1.0),
    ]
    const result = classifyByKeywords(
      'Walk the dog',
      null,
      keywords,
    )

    expect(result).toBeNull()
  })

  it('is case-insensitive: "DEBUG" matches "debug" keyword', () => {
    const keywords = [kw(frameA, 'debug', 1.0)]
    const result = classifyByKeywords('DEBUG this NOW', null, keywords)

    expect(result).not.toBeNull()
    expect(result!.frame_id).toBe('frame-a')
  })

  it('selects the frame with the highest weighted score when multiple frames match', () => {
    const keywords = [
      kw(frameA, 'refactor', 1.0),
      kw(frameA, 'code', 0.8),
      kw(frameB, 'organize', 0.3),
    ]
    const result = classifyByKeywords(
      'Refactor and organize the code',
      null,
      keywords,
    )

    expect(result).not.toBeNull()
    expect(result!.frame_id).toBe('frame-a')
  })

  it('also matches keywords found in task notes', () => {
    const keywords = [kw(frameA, 'deploy', 1.0)]
    const result = classifyByKeywords(
      'Ship the feature',
      'Need to deploy to staging first',
      keywords,
    )

    expect(result).not.toBeNull()
    expect(result!.frame_id).toBe('frame-a')
  })

  it('returns null for an empty title with no notes', () => {
    const keywords = [kw(frameA, 'debug', 1.0)]
    const result = classifyByKeywords('', null, keywords)

    expect(result).toBeNull()
  })

  it('matches multi-word phrase keywords when all tokens are present', () => {
    const keywords = [kw(frameA, 'code review', 1.0)]
    const result = classifyByKeywords(
      'Do the code review for PR 42',
      null,
      keywords,
    )

    expect(result).not.toBeNull()
    expect(result!.frame_id).toBe('frame-a')
  })
})

// ---------------------------------------------------------------------------
// seedKeywords()
// ---------------------------------------------------------------------------
describe('seedKeywords', () => {
  it('creates keyword entries from frame names and descriptions', () => {
    const frames = [
      { id: 'f1', name: 'Deep Work', description: 'Focused coding sessions' },
    ]
    const entries = seedKeywords(frames)

    expect(entries.length).toBeGreaterThan(0)
    // "deep" and "work" from name, "focused", "coding", "sessions" from description
    const keywords = entries.map((e) => e.keyword)
    expect(keywords).toContain('deep')
    expect(keywords).toContain('work')
    expect(keywords).toContain('coding')
  })

  it('adds synonym expansions from the synonym map', () => {
    const frames = [
      { id: 'f1', name: 'Code', description: null },
    ]
    const entries = seedKeywords(frames)

    // "code" is in SYNONYM_MAP, so synonyms like "debug", "implement", etc. should appear
    const keywords = entries.map((e) => e.keyword)
    expect(keywords).toContain('code')
    expect(keywords).toContain('debug')
    expect(keywords).toContain('implement')
    expect(keywords).toContain('refactor')
  })

  it('assigns weight 0.8 to direct tokens and 0.6 to synonyms', () => {
    const frames = [
      { id: 'f1', name: 'Code', description: null },
    ]
    const entries = seedKeywords(frames)

    const direct = entries.find((e) => e.keyword === 'code')
    const synonym = entries.find((e) => e.keyword === 'debug')
    expect(direct?.weight).toBe(0.8)
    expect(synonym?.weight).toBe(0.6)
  })
})
