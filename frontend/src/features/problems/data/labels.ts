import type { BadgeTone } from '@/components/ui'

/** Difficulty key -> zh label + Badge tone on the verdict ramp. */
export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '易',
  medium: '中',
  hard: '难',
  elite: '极难',
}

const DIFFICULTY_TONE: Record<string, BadgeTone> = {
  easy: 'success',
  medium: 'cyan',
  hard: 'warning',
  elite: 'danger',
}

export function difficultyTone(difficulty: string | null | undefined): BadgeTone {
  return DIFFICULTY_TONE[(difficulty || '').toLowerCase()] ?? 'neutral'
}

export function difficultyLabel(
  difficulty: string | null | undefined,
  zh?: string | null,
): string {
  if (zh) return zh
  if (!difficulty) return '未评级'
  return DIFFICULTY_LABEL[difficulty.toLowerCase()] ?? difficulty
}

/** Strip a translated category path to its trailing (most specific) segment. */
export function lastSegment(path: string): string {
  const parts = path.split('>').map((p) => p.trim())
  return parts[parts.length - 1] || path
}

/** A compact "country · year · #no" header line for a problem. */
export function problemHeadline(p: {
  country_zh: string
  competition?: string | null
  year: number | null
  problem_number?: string | null
}): string {
  const bits: string[] = [p.country_zh]
  if (p.year) bits.push(String(p.year))
  if (p.problem_number) bits.push(`第 ${p.problem_number} 题`)
  return bits.join(' · ')
}
