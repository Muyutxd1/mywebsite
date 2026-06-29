import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { XiangqiGame, computeChinese } from './engine'
import { getBestMove } from './ai'
import { LEVELS } from './types'
import type { AiRequest, AiResponse, Color, Coord, GameMode, GameOutcome, Level, Move, Piece } from './types'

const OPP: Record<Color, Color> = { r: 'b', b: 'r' }

function eqCoord(a: Coord | null, r: number, c: number): boolean {
  return !!a && a[0] === r && a[1] === c
}

export interface MoveEntry {
  chinese: string
  color: Color
}

export interface Snapshot {
  board: (Piece | null)[][]
  turn: Color
  outcome: GameOutcome
  inCheck: boolean
  checkGeneral: Coord | null
  lastMove: { from: Coord; to: Coord } | null
  fen: string
}

export interface LegalTarget {
  to: Coord
  capture: boolean
}

export interface XiangqiApi extends Snapshot {
  moveList: MoveEntry[]
  selected: Coord | null
  legalTargets: LegalTarget[]
  hint: { from: Coord; to: Coord } | null

  mode: GameMode
  humanColor: Color
  aiColor: Color
  level: Level
  levelId: string
  orientation: Color
  aiThinking: boolean
  interactive: boolean

  onPointClick: (r: number, c: number) => void
  onDrop: (from: Coord, to: Coord) => void
  newGame: () => void
  undo: () => void
  requestHint: () => void
  flipBoard: () => void
  setMode: (m: GameMode) => void
  setHumanColor: (c: Color) => void
  setLevel: (id: string) => void
  loadFen: (fen: string) => string | null
  getFen: () => string
}

function readSnapshot(game: XiangqiGame, repCount: number): Snapshot {
  const hist = game.history
  const last = hist.length ? hist[hist.length - 1] : null
  const inCheck = game.isInCheck(game.turn)
  let outcome: GameOutcome = game.getOutcome()
  if (outcome === 'playing' && repCount >= 3) outcome = 'draw-repetition'
  return {
    board: game.board.map((row) => row.slice()),
    turn: game.turn,
    outcome,
    inCheck,
    checkGeneral: inCheck ? game.findGeneral(game.turn) : null,
    lastMove: last ? { from: [...last.from], to: [...last.to] } : null,
    fen: game.toFEN(),
  }
}

export function useXiangqiGame(): XiangqiApi {
  const gameRef = useRef<XiangqiGame>(new XiangqiGame())
  const repRef = useRef<Map<string, number>>(new Map())

  // 记录初始局面一次。
  if (repRef.current.size === 0) repRef.current.set(gameRef.current.positionKey(), 1)

  const [snap, setSnap] = useState<Snapshot>(() =>
    readSnapshot(gameRef.current, repRef.current.get(gameRef.current.positionKey()) ?? 1),
  )
  const [moveList, setMoveList] = useState<MoveEntry[]>([])

  const [mode, setModeState] = useState<GameMode>('pvp')
  const [humanColor, setHumanColorState] = useState<Color>('r')
  const [levelId, setLevelId] = useState('medium')
  const [orientation, setOrientation] = useState<Color>('r')

  const [selected, setSelected] = useState<Coord | null>(null)
  const [hint, setHint] = useState<{ from: Coord; to: Coord } | null>(null)
  const [aiThinking, setAiThinking] = useState(false)

  const level = LEVELS.find((l) => l.id === levelId) ?? LEVELS[2]
  const aiColor: Color = OPP[humanColor]

  const genRef = useRef(0)
  const aiBusyRef = useRef(false)

  const sync = useCallback(() => {
    const game = gameRef.current
    setSnap(readSnapshot(game, repRef.current.get(game.positionKey()) ?? 1))
  }, [])

  // ---- AI worker ----
  const workerRef = useRef<Worker | null>(null)
  const reqIdRef = useRef(0)
  const pendingRef = useRef<Map<number, (m: Move | null) => void>>(new Map())

  useEffect(() => {
    let worker: Worker | null = null
    try {
      worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<AiResponse>) => {
        const cb = pendingRef.current.get(e.data.id)
        if (cb) {
          pendingRef.current.delete(e.data.id)
          cb(e.data.move)
        }
      }
      worker.onerror = () => {
        // 解掉所有在途请求，避免 await 永久悬挂导致 aiThinking 卡死。
        pendingRef.current.forEach((cb) => cb(null))
        pendingRef.current.clear()
        workerRef.current = null
      }
    } catch {
      worker = null
    }
    workerRef.current = worker
    return () => {
      worker?.terminate()
      workerRef.current = null
      pendingRef.current.clear()
    }
  }, [])

  const requestAi = useCallback((fen: string, maxDepth: number, timeMs: number): Promise<Move | null> => {
    const worker = workerRef.current
    if (!worker) {
      // 回退：worker 不可用时在主线程计算；限制深度/时间并让出一拍，尽量减少 UI 卡顿。
      return new Promise((resolve) => {
        setTimeout(
          () => resolve(getBestMove(new XiangqiGame(fen), { maxDepth: Math.min(maxDepth, 4), timeMs: Math.min(timeMs, 500) })),
          0,
        )
      })
    }
    return new Promise((resolve) => {
      const id = ++reqIdRef.current
      pendingRef.current.set(id, resolve)
      const req: AiRequest = { id, fen, maxDepth, timeMs }
      worker.postMessage(req)
    })
  }, [])

  const applyMove = useCallback(
    (move: Move) => {
      const game = gameRef.current
      const chinese = computeChinese(game, move)
      const color = game.turn
      game.makeMove(move)
      const key = game.positionKey()
      repRef.current.set(key, (repRef.current.get(key) ?? 0) + 1)
      setMoveList((prev) => [...prev, { chinese, color }])
      setSelected(null)
      setHint(null)
      sync()
    },
    [sync],
  )

  const legalTargets = useMemo<LegalTarget[]>(() => {
    if (!selected) return []
    const game = gameRef.current
    return game
      .generateLegalMoves(game.turn)
      .filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1])
      .map((m) => ({ to: m.to, capture: !!m.captured }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, snap.fen])

  const tryMove = useCallback(
    (from: Coord, to: Coord): boolean => {
      const game = gameRef.current
      if (mode === 'pvai' && game.turn !== humanColor) return false
      const move = game
        .generateLegalMoves(game.turn)
        .find((m) => m.from[0] === from[0] && m.from[1] === from[1] && m.to[0] === to[0] && m.to[1] === to[1])
      if (!move) return false
      applyMove(move)
      return true
    },
    [mode, humanColor, applyMove],
  )

  const onPointClick = useCallback(
    (r: number, c: number) => {
      if (aiThinking) return
      const game = gameRef.current
      if (game.getOutcome() !== 'playing') return
      if (mode === 'pvai' && game.turn !== humanColor) return

      const piece = game.board[r][c]
      if (selected) {
        if (eqCoord(selected, r, c)) {
          setSelected(null)
          return
        }
        if (tryMove(selected, [r, c])) return
        if (piece && piece.color === game.turn) {
          setSelected([r, c])
          setHint(null)
        } else {
          setSelected(null)
        }
        return
      }
      if (piece && piece.color === game.turn) {
        setSelected([r, c])
        setHint(null)
      }
    },
    [selected, aiThinking, mode, humanColor, tryMove],
  )

  const onDrop = useCallback(
    (from: Coord, to: Coord) => {
      if (aiThinking) return
      const game = gameRef.current
      if (game.getOutcome() !== 'playing') return
      if (mode === 'pvai' && game.turn !== humanColor) return
      if (from[0] !== to[0] || from[1] !== to[1]) tryMove(from, to)
      setSelected(null)
    },
    [aiThinking, mode, humanColor, tryMove],
  )

  const resetTransient = useCallback(() => {
    setSelected(null)
    setHint(null)
    setAiThinking(false)
    aiBusyRef.current = false
  }, [])

  const newGame = useCallback(() => {
    genRef.current++
    gameRef.current = new XiangqiGame()
    repRef.current = new Map([[gameRef.current.positionKey(), 1]])
    setMoveList([])
    resetTransient()
    setOrientation(humanColor)
    sync()
  }, [sync, humanColor, resetTransient])

  const undo = useCallback(() => {
    if (aiThinking) return
    const game = gameRef.current
    if (game.history.length === 0) return
    genRef.current++

    const undoOne = () => {
      const key = game.positionKey()
      const c = repRef.current.get(key) ?? 0
      if (c <= 1) repRef.current.delete(key)
      else repRef.current.set(key, c - 1)
      game.undoMove()
      setMoveList((prev) => prev.slice(0, -1))
    }

    undoOne()
    // 人机模式：再撤一步对方着法，回到人类该走的局面。
    if (mode === 'pvai' && game.turn !== humanColor && game.history.length > 0) {
      undoOne()
    }
    resetTransient()
    sync()
  }, [aiThinking, mode, humanColor, resetTransient, sync])

  const requestHint = useCallback(async () => {
    if (aiThinking) return
    const game = gameRef.current
    if (game.getOutcome() !== 'playing') return
    if (mode === 'pvai' && game.turn !== humanColor) return
    const fen = game.toFEN()
    const gen = genRef.current
    setAiThinking(true)
    const move = await requestAi(fen, Math.min(level.depth, 8), 700)
    setAiThinking(false)
    if (gen !== genRef.current || gameRef.current.toFEN() !== fen) return
    if (move) {
      setHint({ from: [...move.from], to: [...move.to] })
      setSelected([...move.from])
    }
  }, [aiThinking, mode, humanColor, level, requestAi])

  const flipBoard = useCallback(() => setOrientation((o) => OPP[o]), [])

  const setMode = useCallback(
    (m: GameMode) => {
      genRef.current++
      resetTransient()
      setModeState(m)
    },
    [resetTransient],
  )

  const setHumanColor = useCallback(
    (c: Color) => {
      genRef.current++
      resetTransient()
      setHumanColorState(c)
      setOrientation(c)
    },
    [resetTransient],
  )

  const setLevel = useCallback((id: string) => setLevelId(id), [])

  const loadFen = useCallback(
    (fen: string): string | null => {
      const trimmed = fen.trim()
      if (!trimmed) return '请输入 FEN'
      let next: XiangqiGame
      try {
        next = new XiangqiGame(trimmed)
      } catch {
        return 'FEN 格式不合法'
      }
      genRef.current++
      gameRef.current = next
      repRef.current = new Map([[next.positionKey(), 1]])
      setMoveList([])
      resetTransient()
      sync()
      return null
    },
    [resetTransient, sync],
  )

  const getFen = useCallback(() => gameRef.current.toFEN(), [])

  // AI 走子。
  useEffect(() => {
    if (mode !== 'pvai' || snap.outcome !== 'playing' || snap.turn !== aiColor) return
    if (aiBusyRef.current) return
    aiBusyRef.current = true
    setAiThinking(true)
    const gen = genRef.current
    const fen = snap.fen
    let cancelled = false
    void (async () => {
      // 让“思考中”先渲染。
      await new Promise((res) => setTimeout(res, 120))
      const move = cancelled ? null : await requestAi(fen, level.depth, level.timeMs)
      aiBusyRef.current = false
      if (cancelled || gen !== genRef.current) return
      if (move) applyMove(move)
      setAiThinking(false)
    })()
    return () => {
      cancelled = true
      aiBusyRef.current = false
    }
  }, [mode, aiColor, snap.turn, snap.fen, snap.outcome, level, requestAi, applyMove])

  const interactive =
    !aiThinking && snap.outcome === 'playing' && (mode === 'pvp' || snap.turn === humanColor)

  return useMemo<XiangqiApi>(
    () => ({
      ...snap,
      moveList,
      selected,
      legalTargets,
      hint,
      mode,
      humanColor,
      aiColor,
      level,
      levelId,
      orientation,
      aiThinking,
      interactive,
      onPointClick,
      onDrop,
      newGame,
      undo,
      requestHint,
      flipBoard,
      setMode,
      setHumanColor,
      setLevel,
      loadFen,
      getFen,
    }),
    [
      snap, moveList, selected, legalTargets, hint, mode, humanColor, aiColor, level, levelId, orientation,
      aiThinking, interactive, onPointClick, onDrop, newGame, undo, requestHint, flipBoard, setMode,
      setHumanColor, setLevel, loadFen, getFen,
    ],
  )
}
