/// <reference lib="webworker" />
// 中国象棋 AI 工作线程：收到 FEN 局面 → 返回最佳着法。
import { XiangqiGame } from './engine'
import { getBestMove } from './ai'
import type { AiRequest, AiResponse } from './types'

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { id, fen, depth } = e.data
  let move = null
  try {
    const game = new XiangqiGame(fen)
    move = getBestMove(game, depth)
  } catch {
    move = null
  }
  const res: AiResponse = { id, move }
  ;(self as unknown as Worker).postMessage(res)
}
