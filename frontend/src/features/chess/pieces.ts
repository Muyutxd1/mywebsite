// 棋子图标：cburnett 矢量棋子（lichess 同款），随仓库放在 /public/chess/pieces。
import type { Color, PieceSymbol } from './types'

const LETTER: Record<PieceSymbol, string> = {
  p: 'P',
  n: 'N',
  b: 'B',
  r: 'R',
  q: 'Q',
  k: 'K',
}

/** 返回某颜色某类型棋子的 SVG 资源地址，例如 ('w','k') -> /chess/pieces/wK.svg。 */
export function pieceSrc(color: Color, type: PieceSymbol): string {
  return `${import.meta.env.BASE_URL}chess/pieces/${color}${LETTER[type]}.svg`
}
