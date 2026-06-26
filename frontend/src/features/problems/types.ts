/** Response + filter contracts for the 奥赛习题集 (MathNet problem bank). */

export interface FacetOption {
  value: string
  label?: string
  count?: number
}

/** Category facet option carrying its parent levels (for cascading selects). */
export interface CategoryOption {
  value: string
  l1?: string
  l2?: string
  count?: number
}

export interface CompetitionOption {
  value: string
  config: string
  count?: number
}

export interface FacetsResponse {
  total: number
  countries: FacetOption[] // value = config key, label = zh
  competitions: CompetitionOption[]
  years: number[]
  yearUnknown: number
  level1: FacetOption[]
  level2: CategoryOption[]
  level3: CategoryOption[]
  level4: CategoryOption[]
  difficulties: FacetOption[]
  problemTypes: FacetOption[]
}

/** A lightweight list row. */
export interface ProblemEntry {
  id: string
  country_zh: string
  config: string
  competition: string
  year: number | null
  year_source: string | null
  problem_number: string | null
  categories: string[]
  difficulty: string | null
  difficulty_zh: string | null
  difficulty_score: number | null
  problem_type: string | null
  problem_type_zh: string | null
  has_solution: number
  has_images: number
  problem_md: string
}

/** Full problem with statement + all solutions. */
export interface FullProblem extends ProblemEntry {
  final_answer: string | null
  language: string | null
  num_images: number
  rationale_zh: string | null
  solutions: string[]
}

export interface ProblemListResponse {
  items: ProblemEntry[]
  total: number
  page: number
  pages: number
  pageSize: number
}

/** One competition within a geo group (browse-by-competition view). */
export interface CompetitionInfo {
  competition: string
  count: number
  year_min: number | null
  year_max: number | null
  years_known: number
  easy: number
  medium: number
  hard: number
  elite: number
}

export interface CompetitionGroup {
  config: string
  country_zh: string
  count: number
  competitions: CompetitionInfo[]
}

export interface CompetitionsResponse {
  groups: CompetitionGroup[]
  total: number
}

export type SortKey =
  | 'relevance'
  | 'year_desc'
  | 'year_asc'
  | 'difficulty_asc'
  | 'difficulty_desc'

/** Active filters — mirrored into the URL query string. */
export interface ProblemFilters {
  config: string
  competition: string
  level1: string
  level2: string
  level3: string
  level4: string
  year: string
  difficulty: string
  problem_type: string
  q: string
  sort: string
}

export const EMPTY_FILTERS: ProblemFilters = {
  config: '',
  competition: '',
  level1: '',
  level2: '',
  level3: '',
  level4: '',
  year: '',
  difficulty: '',
  problem_type: '',
  q: '',
  sort: '',
}
