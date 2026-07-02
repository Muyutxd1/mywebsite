/** API contracts for the problem-bank v2 backend (backend/api/problems.py). */

// ---------------------------------------------------------------------------
// Registry / browse tree
// ---------------------------------------------------------------------------
export interface RoundInfo {
  round_key: string
  zh: string
  count?: number
  order?: number
}

export interface CompetitionSummary {
  comp_key: string
  name_zh: string
  name_en: string
  short: string | null
  tier: 1 | 2 | 3 | 4
  sort_rank: number
  count: number
  editions: number
  year_min: number | null
  year_max: number | null
  years_known: number
  diff: { easy: number; medium: number; hard: number; elite: number }
  rounds: RoundInfo[]
}

export interface RegionGroup {
  key: string
  zh: string
  order: number
  count: number
  competitions: CompetitionSummary[]
}

export interface RegistryResponse {
  total: number
  translated: { problems: number; full: number }
  regions: RegionGroup[]
}

// ---------------------------------------------------------------------------
// Facets (search page filter options)
// ---------------------------------------------------------------------------
export interface FacetOption {
  value: string
  label?: string
  count: number
}

export interface CategoryOption {
  value: string
  l1?: string | null
  l2?: string | null
  count: number
}

export interface FacetsResponse {
  total: number
  regions: FacetOption[]
  competitions: { comp_key: string; name_zh: string; region: string | null; tier: number | null; count: number }[]
  years: number[]
  yearUnknown: number
  level1: CategoryOption[]
  level2: CategoryOption[]
  level3: CategoryOption[]
  level4: CategoryOption[]
  difficulties: FacetOption[]
  problemTypes: FacetOption[]
}

// ---------------------------------------------------------------------------
// Competition matrix (single competition page)
// ---------------------------------------------------------------------------
export interface CompetitionMatrixResponse {
  comp: {
    comp_key: string
    name_zh: string
    name_en: string
    short: string | null
    region: string
    region_zh: string
    tier: number
    rounds: RoundInfo[]
    count: number
  }
  by_year: { year: number; count: number; rounds: RoundInfo[] }[]
  unknown_year_count: number
}

// ---------------------------------------------------------------------------
// Problem rows
// ---------------------------------------------------------------------------
export interface ProblemEntry {
  id: string
  comp_key: string
  comp_zh: string
  comp_short: string | null
  round_key: string | null
  round_zh: string | null
  region: string | null
  tier: number
  country_zh: string
  year: number | null
  year_source: string | null
  problem_number: string | null
  categories: string[]
  difficulty: string | null
  difficulty_zh: string | null
  difficulty_score: number | null
  problem_type: string | null
  problem_type_zh: string | null
  has_solution: 0 | 1
  num_solutions: number
  has_images: 0 | 1
  has_zh: 0 | 1
  translated: 0 | 1
  preview_en: string
  preview_zh: string | null
  snippet?: string | null
  hit_lang?: 'zh' | 'en' | null
}

export interface SolutionPair {
  md: string
  zh: string | null
}

export interface FullProblem extends ProblemEntry {
  problem_md: string
  problem_zh: string | null
  final_answer: string | null
  language: string | null
  num_images: number
  rationale_zh: string | null
  competition_raw: string
  solutions: SolutionPair[]
}

export interface DailyProblem extends FullProblem {
  date: string
}

// ---------------------------------------------------------------------------
// List / ids / random / batch / context / stats
// ---------------------------------------------------------------------------
export interface ProblemListResponse {
  items: ProblemEntry[]
  total: number
  page: number
  pages: number
  pageSize: number
}

export interface IdListResponse {
  ids: string[]
  total: number
}

export interface RandomIdsResponse {
  seed: number
  ids: string[]
  total: number
}

export interface BatchResponse {
  items: ProblemEntry[]
  missing: string[]
}

export interface ContextResponse {
  index: number | null
  total: number | null
  prev: { id: string; headline: string } | null
  next: { id: string; headline: string } | null
}

export interface StatsResponse {
  total: number
  byRegion: { label: string; count: number }[]
  byTier: { label: number; count: number }[]
  byComp: { label: string; count: number }[]
  byTopic: { label: string; count: number }[]
  byDifficulty: { label: string; count: number }[]
  byType: { label: string | null; count: number }[]
  withSolution: number
  withImages: number
  yearKnown: number
  translatedPct: number
}
