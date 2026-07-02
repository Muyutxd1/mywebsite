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

/** tier -> short descriptor chip text. */
export const TIER_LABEL: Record<number, string> = {
  1: '国际奥赛',
  2: '国家级',
  3: '联赛/邀请',
  4: '训练/其他',
}

/** Strip a translated category path to its trailing (most specific) segment. */
export function lastSegment(path: string): string {
  const parts = path.split('>').map((p) => p.trim())
  return parts[parts.length - 1] || path
}

/** "竞赛 · 年份 · 卷 · 第N题" header line for a problem row. */
export function problemHeadline(p: {
  comp_short?: string | null
  comp_zh: string
  year: number | null
  round_zh?: string | null
  problem_number?: string | null
}): string {
  const bits: string[] = [p.comp_short || p.comp_zh]
  if (p.year) bits.push(String(p.year))
  if (p.round_zh) bits.push(p.round_zh)
  if (p.problem_number) bits.push(`第 ${p.problem_number} 题`)
  return bits.join(' · ')
}
