/** MBTI feature types — mirror the shapes returned by backend/api/mbti.py. */

export interface MbtiOption {
  value: number
  label: string
}

export type DimKey = 'EI' | 'SN' | 'TF' | 'JP'

export interface MbtiDimension {
  key: DimKey
  left: string
  right: string
  max: number
  leftLabel: string
  rightLabel: string
}

export interface MbtiQuestion {
  id: number
  dim: DimKey
  reverse: boolean
  text: string
}

export interface QuestionsResponse {
  options: MbtiOption[]
  optionEmoji: string[]
  dimensions: MbtiDimension[]
  questions: MbtiQuestion[]
}

export interface MbtiTypeInfo {
  name: string
  summary: string
  strengths: string[]
  weaknesses: string[]
  careers: string[]
  relationships: string
  famous: string[]
}

export interface TypesResponse {
  types: Record<string, MbtiTypeInfo>
  typeNames: Record<string, string>
  typeEmoji: Record<string, string>
}

/** One dimension's computed result for the result screen. */
export interface DimensionResult {
  dim: MbtiDimension
  letter: string
  /** Raw summed score (0..max) toward the LEFT pole. */
  score: number
  /** Percent toward the left pole (0..100). */
  pct: number
  max: number
}

export interface MbtiResult {
  typeCode: string
  dimResults: DimensionResult[]
}
