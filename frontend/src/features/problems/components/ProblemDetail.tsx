import { FavoriteButton } from './FavoriteButton'
import { ProblemBody } from './ProblemBody'
import { ProblemMeta } from './ProblemMeta'
import { SolutionsSection } from './SolutionsSection'
import { problemHeadline } from '../data/labels'
import type { FullProblem } from '../types'

/** The shared full-problem view used by the detail route, random + daily cards. */
export function ProblemDetail({ p }: { p: FullProblem }) {
  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent/80">
            {p.competition_series || p.competition || p.country_zh}
          </p>
          <h2 className="mt-1 text-lg font-bold sm:text-xl">{problemHeadline(p)}</h2>
          {p.competition && p.competition !== p.competition_series && (
            <p className="mt-0.5 text-xs text-muted">{p.competition}</p>
          )}
        </div>
        <FavoriteButton id={p.id} />
      </div>

      <ProblemMeta p={p} fullCategories className="mb-4" />

      <ProblemBody source={p.problem_md} />

      <SolutionsSection solutions={p.solutions} finalAnswer={p.final_answer} />
    </div>
  )
}
