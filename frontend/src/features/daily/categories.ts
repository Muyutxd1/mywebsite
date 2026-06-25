/** Per-category visual identity for 每日一句 (drives the page's accent + mood). */
export interface CatMeta {
  color: string
  glyph: string
}

export const CATEGORIES: Record<string, CatMeta> = {
  歌词: { color: '#ff7aa8', glyph: '♪' },
  诗词: { color: '#e7b455', glyph: '❉' },
  电影: { color: '#45d6e6', glyph: '▶' },
  文学: { color: '#8b7bff', glyph: '✦' },
  哲思: { color: '#a78bfa', glyph: '∴' },
  语录: { color: '#5cc9a0', glyph: '❝' },
}

export function catMeta(category?: string): CatMeta {
  return CATEGORIES[category ?? ''] ?? { color: '#8b7bff', glyph: '❝' }
}
