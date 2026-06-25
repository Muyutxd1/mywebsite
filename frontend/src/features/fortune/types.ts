// ── 灵占 · API response types ──────────────────────────────
// Shapes mirror backend/api/fortune.py + the per-system calculators.
// Every response carries a long `interpretation` string using 【标题】 markers.

export type FortuneSystem =
  | 'meihua'
  | 'bazi'
  | 'ziwei'
  | 'yijing'
  | 'tarot'
  | 'astrology'

/** A hexagram dict from core.yixue.hexagram_from_lines. */
export interface Hexagram {
  name: string
  lines: number[] // bottom→top, 1=阳 0=阴
  upper_gua: string
  lower_gua: string
  upper_symbol: string
  lower_symbol: string
  gua_ci?: string
  yao_ci?: string[]
  interpretation?: string
}

// ── 梅花易数 ──────────────────────────────────
export interface MeihuaResult {
  numbers: [number, number, number]
  upper_gua: string
  lower_gua: string
  upper_symbol: string
  lower_symbol: string
  changing_line: number
  ti_gua: string
  yong_gua: string
  ti_wuxing: string
  yong_wuxing: string
  ti_yong_relation: string
  ti_yong_fortune: string
  ti_yong_msg: string
  ben_gua: Hexagram
  hu_gua: Hexagram
  bian_gua: Hexagram
  moving_yao_ci: string
  interpretation: string
  error?: string
}

// ── 八字 ──────────────────────────────────
export interface BaziPillar {
  gan: string
  zhi: string
  full: string
  gan_wuxing: string
  zhi_wuxing: string
  zhi_canggan: string[]
  shishen: string
  nayin: string
}

export interface BaziResult {
  pillars: {
    year: BaziPillar
    month: BaziPillar
    day: BaziPillar
    hour: BaziPillar
  }
  day_master: string
  day_master_wuxing: string
  wuxing_count: Record<string, number>
  interpretation: string
  error?: string
}

// ── 紫微斗数 ──────────────────────────────────
export interface ZiweiPalace {
  name: string
  is_ming: boolean
  is_shen: boolean
  stars: string[]
}

export interface ZiweiResult {
  birth_info: {
    year_gan: string
    year_zhi: string
    month_zhi: string
    day_gan: string
    day_zhi: string
    hour_zhi: string
    lunar_month: number
  }
  palaces: ZiweiPalace[]
  ming_palace: string
  shen_palace: string
  sihua: Record<string, string>
  interpretation: string
  error?: string
}

// ── 易经 ──────────────────────────────────
export interface YijingResult {
  tosses: { position: number; heads: number; type: string; value: number; symbol: string }[]
  has_changes: boolean
  ben_gua: Hexagram
  bian_gua: Hexagram | null
  moving_positions: number[]
  interpretation: string
  error?: string
}

// ── 塔罗 ──────────────────────────────────
export type TarotSpread = 'single' | 'three' | 'celtic_cross'

export interface TarotCard {
  position: string
  position_index: number
  name_cn: string
  name_en: string
  type: string
  is_upright: boolean
  orientation: string
  interpretation: string
  keywords: string[]
}

export interface TarotResult {
  spread_name: string
  cards: TarotCard[]
  interpretation: string
  error?: string
}

// ── 占星 ──────────────────────────────────
export interface AstroPlanet {
  name: string
  longitude: number
  sign: string
  house: number
}

export interface AstroAspect {
  p1: string
  p2: string
  aspect: string
  symbol: string
  orb: number
}

export interface AstrologyResult {
  birth_info: { year: number; month: number; day: number; hour: number; minute: number; lat: number; lng: number }
  planets: AstroPlanet[]
  ascendant: { longitude: number; sign: string }
  mc: { longitude: number; sign: string }
  aspects: AstroAspect[]
  element_count: Record<string, number>
  dominant_sign: string
  interpretation: string
  error?: string
}

// ── 解读分段 ──────────────────────────────────
export interface ReadingBlock {
  title: string
  lines: string[]
}
