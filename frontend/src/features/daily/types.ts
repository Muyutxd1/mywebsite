export interface Quote {
  id: number
  text: string
  source?: string
  author?: string
  tag?: string
}

export interface TodayResponse {
  date: string
  index: number
  quote: Quote
  total: number
}

export interface QuotesResponse {
  quotes: Quote[]
  total: number
}
