import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui'
import { ProblemBody } from './ProblemBody'
import { SolutionsSection } from './SolutionsSection'
import { DifficultyBadge } from './DifficultyBadge'
import { LangToggle } from './LangToggle'
import { lastSegment } from '../data/labels'
import { useLang, useSetLang, type ProblemLang } from '../store/prefs'
import type { FullProblem } from '../types'

/**
 * The bilingual statement + meta + solutions block, shared by the detail page
 * and the practice player. Language: global pref with a per-problem override
 * that resets when the problem changes.
 */
export function ProblemView({
  problem,
  onRevealSolution,
  solutionNudge,
}: {
  problem: FullProblem
  onRevealSolution?: () => void
  solutionNudge?: React.ReactNode
}) {
  const globalLang = useLang()
  const setGlobalLang = useSetLang()
  const [override, setOverride] = useState<ProblemLang | null>(null)
  useEffect(() => setOverride(null), [problem.id])

  const lang: ProblemLang = problem.problem_zh ? (override ?? globalLang) : 'en'
  const body = lang === 'zh' && problem.problem_zh ? problem.problem_zh : problem.problem_md

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DifficultyBadge difficulty={problem.difficulty} difficultyZh={problem.difficulty_zh} />
        {problem.problem_type_zh && <Badge tone="neutral">{problem.problem_type_zh}</Badge>}
        {problem.categories.slice(0, 3).map((c) => (
          <Badge key={c} tone="neutral" className="opacity-80">
            {lastSegment(c)}
          </Badge>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {override && override !== globalLang && (
            <button
              type="button"
              className="text-xs text-accent underline-offset-2 hover:underline"
              onClick={() => {
                setGlobalLang(override)
                setOverride(null)
              }}
            >
              设为默认
            </button>
          )}
          <LangToggle value={lang} hasZh={Boolean(problem.problem_zh)} onChange={setOverride} />
        </div>
      </div>

      <ProblemBody source={body} />

      <SolutionsSection
        solutions={problem.solutions}
        finalAnswer={problem.final_answer}
        lang={lang}
        onReveal={onRevealSolution}
        nudge={solutionNudge}
      />

      {problem.rationale_zh && (
        <p className="mt-4 text-xs leading-relaxed text-faint">评级依据：{problem.rationale_zh}</p>
      )}
    </div>
  )
}
