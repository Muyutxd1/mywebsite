import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChessGame, computeSAN } from './engine'
import type { AiRequest, AiResponse, Color, Coord, GameMode, GameState, Move } from './types'

/** Difficulty → search depth. */
export const DIFFICULTY_DEPTH: Record<string, number> = { '1': 1, '2': 2, '3': 3 }

interface PromotionPending {
  move: Move
}

export interface ChessGameApi {
  // Board / state
  board: (ReturnType<ChessGame['getPiece']>)[][]
  turn: Color
  state: GameState
  inCheck: boolean
  moveList: Move[]
  fullMoveNumber: number

  // Interaction
  selected: Coord | null
  legalTargets: Move[]
  hint: { from: Coord; to: Coord } | null
  lastMove: { from: Coord; to: Coord } | null

  // Mode / AI
  mode: GameMode
  difficulty: string
  aiThinking: boolean
  canUndo: boolean

  // Promotion modal
  promotion: PromotionPending | null

  onSquareClick: (r: number, c: number) => void
  resolvePromotion: (pieceType: 'Q' | 'R' | 'B' | 'N') => void
  cancelPromotion: () => void
  newGame: () => void
  undo: () => void
  toggleMode: () => void
  setDifficulty: (value: string) => void
  showHint: () => void
}

export function useChessGame(): ChessGameApi {
  const gameRef = useRef<ChessGame>(new ChessGame())
  // A monotonically increasing tick to force re-render after mutating gameRef.
  const [, force] = useState(0)
  const rerender = useCallback(() => force((n) => n + 1), [])

  const [mode, setMode] = useState<GameMode>('pvp')
  const [difficulty, setDifficultyState] = useState('2')
  const [selected, setSelected] = useState<Coord | null>(null)
  const [legalTargets, setLegalTargets] = useState<Move[]>([])
  const [hint, setHint] = useState<{ from: Coord; to: Coord } | null>(null)
  const [lastMove, setLastMove] = useState<{ from: Coord; to: Coord } | null>(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [promotion, setPromotion] = useState<PromotionPending | null>(null)

  // ---- Worker setup ----
  const workerRef = useRef<Worker | null>(null)
  const reqIdRef = useRef(0)
  // Callbacks keyed by request id.
  const pendingRef = useRef<Map<number, (move: Move | null) => void>>(new Map())

  useEffect(() => {
    const worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<AiResponse>) => {
      const cb = pendingRef.current.get(e.data.id)
      if (cb) {
        pendingRef.current.delete(e.data.id)
        cb(e.data.move)
      }
    }
    workerRef.current = worker
    return () => {
      worker.terminate()
      workerRef.current = null
      pendingRef.current.clear()
    }
  }, [])

  const requestAi = useCallback((kind: 'move' | 'hint', depth: number): Promise<Move | null> => {
    return new Promise((resolve) => {
      const worker = workerRef.current
      if (!worker) {
        resolve(null)
        return
      }
      const id = ++reqIdRef.current
      pendingRef.current.set(id, resolve)
      const game = gameRef.current
      const req: AiRequest = {
        id,
        kind,
        depth,
        snapshot: { fen: game.toFEN(), positionCount: { ...game.positionCount } },
      }
      worker.postMessage(req)
    })
  }, [])

  const aiDepth = DIFFICULTY_DEPTH[difficulty] ?? 2

  // Run the AI for the current side (black in PvAI) and apply the move.
  const runAiMove = useCallback(async () => {
    setAiThinking(true)
    setSelected(null)
    setLegalTargets([])
    setHint(null)
    rerender()
    // Small delay so the "thinking" indicator paints before the search posts.
    await new Promise((r) => setTimeout(r, 150))
    const move = await requestAi('move', aiDepth)
    const game = gameRef.current
    if (move) {
      move.san = computeSAN(game, move)
      setLastMove({ from: [...move.from] as Coord, to: [...move.to] as Coord })
      game.makeMove(move)
    }
    setAiThinking(false)
    rerender()
  }, [aiDepth, requestAi, rerender])

  const executeMove = useCallback(
    (move: Move) => {
      const game = gameRef.current
      move.san = computeSAN(game, move)
      setLastMove({ from: [...move.from] as Coord, to: [...move.to] as Coord })
      game.makeMove(move)
      setSelected(null)
      setLegalTargets([])
      setHint(null)
      rerender()

      if (game.getGameState() !== 'playing') return
      if (mode === 'pvai' && game.turn === 'b') {
        void runAiMove()
      }
    },
    [mode, rerender, runAiMove],
  )

  const selectPiece = useCallback(
    (r: number, c: number) => {
      const game = gameRef.current
      setSelected([r, c])
      setLegalTargets(game.generateLegalMoves(game.turn).filter((m) => m.from[0] === r && m.from[1] === c))
      setHint(null)
      rerender()
    },
    [rerender],
  )

  const onSquareClick = useCallback(
    (r: number, c: number) => {
      if (aiThinking || promotion) return
      const game = gameRef.current
      if (game.getGameState() !== 'playing') return
      if (mode === 'pvai' && game.turn === 'b') return

      const clickedPiece = game.board[r][c]

      if (selected) {
        const move = legalTargets.find((m) => m.to[0] === r && m.to[1] === c)
        if (move) {
          if (move.promotion) {
            setPromotion({ move })
            return
          }
          executeMove(move)
          return
        }
        if (clickedPiece && game._pieceColor(clickedPiece) === game.turn) {
          selectPiece(r, c)
          return
        }
        setSelected(null)
        setLegalTargets([])
        rerender()
        return
      }

      if (clickedPiece && game._pieceColor(clickedPiece) === game.turn) {
        selectPiece(r, c)
      }
    },
    [aiThinking, promotion, mode, selected, legalTargets, executeMove, selectPiece, rerender],
  )

  const resolvePromotion = useCallback(
    (pieceType: 'Q' | 'R' | 'B' | 'N') => {
      if (!promotion) return
      const game = gameRef.current
      const color = game.turn
      const promo = (color === 'w' ? pieceType : pieceType.toLowerCase()) as Move['promotion']
      const move: Move = { ...promotion.move, promotion: promo }
      setPromotion(null)
      executeMove(move)
    },
    [promotion, executeMove],
  )

  const cancelPromotion = useCallback(() => {
    setPromotion(null)
    setSelected(null)
    setLegalTargets([])
    rerender()
  }, [rerender])

  const newGame = useCallback(() => {
    gameRef.current = new ChessGame()
    setSelected(null)
    setLegalTargets([])
    setHint(null)
    setLastMove(null)
    setAiThinking(false)
    setPromotion(null)
    rerender()
  }, [rerender])

  const undo = useCallback(() => {
    if (aiThinking) return
    const game = gameRef.current
    if (mode === 'pvai') {
      game.undoMove()
      if (game.moveHistory.length > 0) game.undoMove()
    } else {
      game.undoMove()
    }
    setSelected(null)
    setLegalTargets([])
    setHint(null)
    setPromotion(null)
    if (game.moveList.length > 0) {
      const last = game.moveList[game.moveList.length - 1]
      setLastMove({ from: [...last.from] as Coord, to: [...last.to] as Coord })
    } else {
      setLastMove(null)
    }
    rerender()
  }, [aiThinking, mode, rerender])

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'pvp' ? 'pvai' : 'pvp'
      // Switching into AI mode while it's black's turn → let AI move.
      if (next === 'pvai' && gameRef.current.turn === 'b' && gameRef.current.getGameState() === 'playing') {
        void runAiMove()
      }
      return next
    })
  }, [runAiMove])

  const setDifficulty = useCallback((value: string) => setDifficultyState(value), [])

  const showHint = useCallback(async () => {
    if (aiThinking) return
    const game = gameRef.current
    if (game.getGameState() !== 'playing') return
    setAiThinking(true)
    rerender()
    const move = await requestAi('hint', Math.min(aiDepth, 2))
    setAiThinking(false)
    if (move) {
      setHint({ from: [...move.from] as Coord, to: [...move.to] as Coord })
      setSelected([...move.from] as Coord)
      setLegalTargets(
        game.generateLegalMoves(game.turn).filter((m) => m.from[0] === move.from[0] && m.from[1] === move.from[1]),
      )
    }
    rerender()
  }, [aiThinking, aiDepth, requestAi, rerender])

  const game = gameRef.current
  const state = game.getGameState()
  const inCheck = game.isInCheck(game.turn)

  return useMemo<ChessGameApi>(
    () => ({
      board: game.board,
      turn: game.turn,
      state,
      inCheck,
      moveList: game.moveList,
      fullMoveNumber: game.fullMoveNumber,
      selected,
      legalTargets,
      hint,
      lastMove,
      mode,
      difficulty,
      aiThinking,
      canUndo: game.moveHistory.length > 0,
      promotion,
      onSquareClick,
      resolvePromotion,
      cancelPromotion,
      newGame,
      undo,
      toggleMode,
      setDifficulty,
      showHint,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      game.board, game.turn, state, inCheck, game.moveList, game.fullMoveNumber,
      selected, legalTargets, hint, lastMove, mode, difficulty, aiThinking, promotion,
      onSquareClick, resolvePromotion, cancelPromotion, newGame, undo, toggleMode, setDifficulty, showHint,
    ],
  )
}
