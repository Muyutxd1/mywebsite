/** Response shape of POST /api/factorize (snake_case, mirrored from backend). */
export interface FactorizeResponse {
  input?: string
  factored?: string
  factored_unicode?: string
  steps?: string[]
  is_constant?: boolean
  error?: string
}

export interface ExampleChip {
  label: string
  expr: string
}
