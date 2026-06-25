/** Response shapes for the 奥赛习题集 (MathNet Olympiad problem browser) API. */

/** A facet option: raw value sent to the API + human label shown in the dropdown. */
export interface FacetOption {
  value: string
  label: string
}

/** GET /api/problems/facets */
export interface FacetsResponse {
  total: number
  competitions: FacetOption[]
  topics: string[]
  years: number[]
}

/** Lightweight index entry returned by the listing endpoint. */
export interface ProblemEntry {
  id: string
  title: string
  competition: string
  competition_zh: string
  year: number
  difficulty: string
  difficulty_zh: string
  topics: string[]
  language: string
}

/** GET /api/problems?... */
export interface ProblemListResponse {
  items: ProblemEntry[]
  total: number
  page: number
  pages: number
  pageSize: number
}

/** Full problem incl. markdown body + solution (GET /:id and /random). */
export interface FullProblem extends ProblemEntry {
  problem_md: string
  solution_md: string
}

/** Active filter state, synced to the URL query string. */
export interface ProblemFilters {
  competition: string
  topic: string
  year: string
  q: string
}
