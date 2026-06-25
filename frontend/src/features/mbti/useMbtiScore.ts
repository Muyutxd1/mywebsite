import { useMemo } from 'react'
import type { DimKey, DimensionResult, MbtiDimension, MbtiQuestion, MbtiResult } from './types'

/**
 * Fisher-Yates shuffle (returns a NEW array), porting `shuffleArray` from
 * `_legacy/static/js/ui-mbti.js`. Used to randomise question order each run.
 */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Port of the legacy `submitMbti` scoring. For each answered question score
 * 0-4; reversed questions use (4 - score). Sum per dimension (max 48). The
 * letter is `dimension.left` when the summed score is >= max/2 (the >=24 tie
 * boundary keeps the LEFT letter), otherwise `dimension.right`. typeCode is the
 * letters concatenated in EI, SN, TF, JP order.
 */
export function scoreMbti(
  questions: MbtiQuestion[],
  answers: Record<number, number>,
  dimensions: MbtiDimension[],
): MbtiResult {
  const rawScores: Record<DimKey, number> = { EI: 0, SN: 0, TF: 0, JP: 0 }
  for (const q of questions) {
    let score = answers[q.id] ?? 0
    if (q.reverse) score = 4 - score
    rawScores[q.dim] += score
  }

  const dimResults: DimensionResult[] = []
  const letters: string[] = []
  for (const d of dimensions) {
    const score = rawScores[d.key]
    const pct = Math.round((score / d.max) * 100)
    const letter = score >= d.max / 2 ? d.left : d.right
    letters.push(letter)
    dimResults.push({ dim: d, letter, score, pct, max: d.max })
  }

  return { typeCode: letters.join(''), dimResults }
}

/** Memoised wrapper so the result is only recomputed when inputs change. */
export function useMbtiScore(
  questions: MbtiQuestion[],
  answers: Record<number, number>,
  dimensions: MbtiDimension[],
): MbtiResult {
  return useMemo(
    () => scoreMbti(questions, answers, dimensions),
    [questions, answers, dimensions],
  )
}
