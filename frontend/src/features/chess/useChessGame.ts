import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { StockfishEngine } from './stockfish'
import { LEVELS } from './types'
import type {
  BoardPiece,
  Color,
  GameMode,
  GameOutcome,
  LegalTarget,
  Level,
  MoveRecord,
  PromotionPiece,
  Square,
} from './types'

export interface Snapshot {
  fen: string
  board: (BoardPiece | null)[][]
  turn: Color
  history: MoveRecord[]
  inCheck: boolean
  isGameOver: boolean
  outcome: GameOutcome
  /** 被将军一方的王所在格（无将军时为 null）。 */
  checkSquare: Square | null
  lastMove: { from: Square; to: Square } | null
}

export interface ChessGameApi extends Snapshot {
  // 交互状态
  selected: Square | null
  legalTargets: LegalTarget[]
  hint: { from: Square; to: Square } | null
  pendingPromotion: { from: Square; to: Square } | null

  // 设置 / AI
  mode: GameMode
  humanColor: Color
  aiColor: Color
  level: Level
  levelId: string
  orientation: Color
  aiThinking: boolean
  engineFailed: boolean
  /** 当前人类是否可以操作棋盘。 */
  interactive: boolean

  // 操作
  onSquareClick: (sq: Square) => void
  onDrop: (from: Square, to: Square) => void
  resolvePromotion: (piece: PromotionPiece) => void
  cancelPromotion: () => void
  newGame: () => void
  undo: () => void
  requestHint: () => void
  flipBoard: () => void
  setMode: (m: GameMode) => void
  setHumanColor: (c: Color) => void
  setLevel: (id: string) => void
  loadFen: (fen: string) => string | null
  loadPgn: (pgn: string) => string | null
  getFen: () => string
  getPgn: () => string
}

function findKing(board: (BoardPiece | null)[][], color: Color): Square | null {
  for (const row of board) {
    for (const sq of row) {
      if (sq && sq.type === 'k' && sq.color === color) return sq.square
    }
  }
  return null
}

function readOutcome(chess: Chess): GameOutcome {
  if (chess.isCheckmate()) return 'checkmate'
  if (chess.isStalemate()) return 'stalemate'
  if (chess.isInsufficientMaterial()) return 'draw-insufficient'
  if (chess.isThreefoldRepetition()) return 'draw-repetition'
  if (chess.isDraw()) return 'draw-fifty' // 其余和棋只剩五十回合规则
  return 'playing'
}

function readSnapshot(chess: Chess): Snapshot {
  const board = chess.board()
  const verbose = chess.history({ verbose: true })
  const history: MoveRecord[] = verbose.map((m) => ({
    san: m.san,
    from: m.from,
    to: m.to,
    color: m.color,
    piece: m.piece,
    captured: m.captured,
    promotion: m.promotion,
  }))
  const last = history.length ? history[history.length - 1] : null
  const inCheck = chess.isCheck()
  return {
    fen: chess.fen(),
    board,
    turn: chess.turn(),
    history,
    inCheck,
    isGameOver: chess.isGameOver(),
    outcome: readOutcome(chess),
    checkSquare: inCheck ? findKing(board, chess.turn()) : null,
    lastMove: last ? { from: last.from, to: last.to } : null,
  }
}

export function useChessGame(): ChessGameApi {
  const chessRef = useRef<Chess>(new Chess())
  const [snap, setSnap] = useState<Snapshot>(() => readSnapshot(chessRef.current))

  const [mode, setModeState] = useState<GameMode>('pvp')
  const [humanColor, setHumanColorState] = useState<Color>('w')
  const [levelId, setLevelId] = useState<string>('medium')
  const [orientation, setOrientation] = useState<Color>('w')

  const [selected, setSelected] = useState<Square | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [hint, setHint] = useState<{ from: Square; to: Square } | null>(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [engineFailed, setEngineFailed] = useState(false)

  const level = LEVELS.find((l) => l.id === levelId) ?? LEVELS[2]
  const aiColor: Color = humanColor === 'w' ? 'b' : 'w'

  // 失效令牌：开新局 / 悔棋 / 载入局面时自增，作废在途的 AI / 提示搜索结果。
  const genRef = useRef(0)
  // 防止 AI 搜索重入。
  const aiBusyRef = useRef(false)

  const engineRef = useRef<StockfishEngine | null>(null)

  const sync = useCallback(() => {
    setSnap(readSnapshot(chessRef.current))
  }, [])

  const legalTargets = useMemo<LegalTarget[]>(() => {
    if (!selected) return []
    const moves = chessRef.current.moves({ square: selected, verbose: true })
    const seen = new Set<string>()
    const out: LegalTarget[] = []
    for (const m of moves) {
      if (seen.has(m.to)) continue
      seen.add(m.to)
      out.push({ square: m.to, capture: m.captured != null })
    }
    return out
    // snap.fen 变化即局面变化，需重算。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, snap.fen])

  const doMove = useCallback(
    (from: Square, to: Square, promotion?: PromotionPiece) => {
      try {
        chessRef.current.move({ from, to, promotion })
      } catch {
        return
      }
      setSelected(null)
      setHint(null)
      setPendingPromotion(null)
      sync()
    },
    [sync],
  )

  const applyUci = useCallback(
    (uci: string) => {
      const from = uci.slice(0, 2) as Square
      const to = uci.slice(2, 4) as Square
      const promotion = (uci.length > 4 ? uci[4] : undefined) as PromotionPiece | undefined
      try {
        chessRef.current.move({ from, to, promotion })
      } catch {
        return
      }
      setSelected(null)
      setHint(null)
      sync()
    },
    [sync],
  )

  const tryMove = useCallback(
    (from: Square, to: Square): boolean => {
      const chess = chessRef.current
      if (mode === 'pvai' && !engineFailed && chess.turn() !== humanColor) return false
      const candidates = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to)
      if (candidates.length === 0) return false
      if (candidates.some((m) => m.promotion)) {
        setPendingPromotion({ from, to })
        return true
      }
      doMove(from, to)
      return true
    },
    [mode, humanColor, engineFailed, doMove],
  )

  const onSquareClick = useCallback(
    (sq: Square) => {
      if (pendingPromotion || aiThinking) return
      const chess = chessRef.current
      if (chess.isGameOver()) return
      if (mode === 'pvai' && !engineFailed && chess.turn() !== humanColor) return

      const piece = chess.get(sq)
      if (selected) {
        if (sq === selected) {
          setSelected(null)
          return
        }
        if (tryMove(selected, sq)) return
        // 非合法目标：点到己方子则改选，否则取消。
        if (piece && piece.color === chess.turn()) {
          setSelected(sq)
          setHint(null)
        } else {
          setSelected(null)
        }
        return
      }
      if (piece && piece.color === chess.turn()) {
        setSelected(sq)
        setHint(null)
      }
    },
    [selected, pendingPromotion, aiThinking, mode, humanColor, engineFailed, tryMove],
  )

  const onDrop = useCallback(
    (from: Square, to: Square) => {
      if (pendingPromotion || aiThinking) return
      const chess = chessRef.current
      if (chess.isGameOver()) return
      if (mode === 'pvai' && !engineFailed && chess.turn() !== humanColor) return
      if (from !== to) tryMove(from, to)
      setSelected(null)
    },
    [pendingPromotion, aiThinking, mode, humanColor, engineFailed, tryMove],
  )

  const resolvePromotion = useCallback(
    (piece: PromotionPiece) => {
      if (!pendingPromotion) return
      doMove(pendingPromotion.from, pendingPromotion.to, piece)
    },
    [pendingPromotion, doMove],
  )

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null)
    setSelected(null)
  }, [])

  const resetTransient = useCallback(() => {
    setSelected(null)
    setHint(null)
    setPendingPromotion(null)
    setAiThinking(false)
    aiBusyRef.current = false
  }, [])

  const newGame = useCallback(() => {
    genRef.current++
    engineRef.current?.stop()
    engineRef.current?.newGame()
    chessRef.current = new Chess()
    resetTransient()
    setOrientation(humanColor)
    sync()
  }, [sync, humanColor, resetTransient])

  const undo = useCallback(() => {
    if (aiThinking) return
    const chess = chessRef.current
    if (chess.history().length === 0) return
    genRef.current++
    engineRef.current?.stop()
    chess.undo()
    // 人机模式下退回到人类该走的局面（再撤一步对方的棋）；引擎失效降级为双方手动时按单步撤。
    if (mode === 'pvai' && !engineFailed && chess.turn() !== humanColor && chess.history().length > 0) {
      chess.undo()
    }
    resetTransient()
    sync()
  }, [aiThinking, mode, humanColor, engineFailed, resetTransient, sync])

  const requestHint = useCallback(async () => {
    if (aiThinking || pendingPromotion) return
    const chess = chessRef.current
    if (chess.isGameOver()) return
    if (mode === 'pvai' && chess.turn() !== humanColor) return
    const engine = engineRef.current
    if (!engine) return
    const fen = chess.fen()
    const gen = genRef.current
    setAiThinking(true)
    const uci = await engine.analyse(fen, { skill: 20, movetime: 500 })
    setAiThinking(false)
    if (gen !== genRef.current || chessRef.current.fen() !== fen) return
    if (uci) {
      const from = uci.slice(0, 2) as Square
      const to = uci.slice(2, 4) as Square
      setHint({ from, to })
      setSelected(from)
    }
  }, [aiThinking, pendingPromotion, mode, humanColor])

  const flipBoard = useCallback(() => setOrientation((o) => (o === 'w' ? 'b' : 'w')), [])

  const setMode = useCallback(
    (m: GameMode) => {
      genRef.current++
      engineRef.current?.stop()
      resetTransient()
      setModeState(m)
    },
    [resetTransient],
  )

  const setHumanColor = useCallback(
    (c: Color) => {
      genRef.current++
      engineRef.current?.stop()
      resetTransient()
      setHumanColorState(c)
      setOrientation(c)
    },
    [resetTransient],
  )

  const setLevel = useCallback((id: string) => setLevelId(id), [])

  const loadGame = useCallback(
    (build: (chess: Chess) => void): string | null => {
      const next = new Chess()
      try {
        build(next)
      } catch {
        return 'parse-error'
      }
      genRef.current++
      engineRef.current?.stop()
      engineRef.current?.newGame()
      chessRef.current = next
      resetTransient()
      sync()
      return null
    },
    [resetTransient, sync],
  )

  const loadFen = useCallback(
    (fen: string): string | null => {
      const trimmed = fen.trim()
      if (!trimmed) return '请输入 FEN'
      return loadGame((c) => c.load(trimmed)) === null ? null : 'FEN 格式不合法'
    },
    [loadGame],
  )

  const loadPgn = useCallback(
    (pgn: string): string | null => {
      const trimmed = pgn.trim()
      if (!trimmed) return '请输入 PGN'
      return loadGame((c) => c.loadPgn(trimmed)) === null ? null : 'PGN 解析失败'
    },
    [loadGame],
  )

  const getFen = useCallback(() => chessRef.current.fen(), [])
  const getPgn = useCallback(() => chessRef.current.pgn(), [])

  // 引擎生命周期。alive 守卫避免 StrictMode 下被销毁的引擎实例污染当前状态。
  useEffect(() => {
    const engine = new StockfishEngine()
    engineRef.current = engine
    let alive = true
    engine.onError = () => {
      if (alive) setEngineFailed(true)
    }
    engine.ready().then(
      () => {
        if (alive) setEngineFailed(false)
      },
      () => {
        if (alive) setEngineFailed(true)
      },
    )
    return () => {
      alive = false
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  // 引擎判定失败时，务必解除“思考中”锁（失败可能发生在 await 期间，
  // 而 AI 效果的 cancelled 分支会跳过 setAiThinking(false)），否则棋盘会卡死。
  useEffect(() => {
    if (engineFailed) {
      setAiThinking(false)
      aiBusyRef.current = false
    }
  }, [engineFailed])

  // AI 走子：当轮到 AI 且对局进行中时，向引擎请求最佳走法并落子。
  // 引擎不可用（engineFailed）时不接管：交由 interactive 放行人类操作（可一人对弈双方）。
  useEffect(() => {
    if (mode !== 'pvai' || engineFailed || snap.isGameOver || snap.turn !== aiColor) return
    const engine = engineRef.current
    if (!engine || aiBusyRef.current) return

    aiBusyRef.current = true
    setAiThinking(true)
    const gen = genRef.current
    let cancelled = false
    void (async () => {
      const uci = await engine.analyse(snap.fen, { skill: level.skill, movetime: level.movetime })
      aiBusyRef.current = false
      if (cancelled || gen !== genRef.current) return
      if (uci) {
        applyUci(uci)
      } else {
        // 进行中的局面却拿不到走法 ⇒ 引擎异常，降级为可手动续弈。
        setEngineFailed(true)
      }
      setAiThinking(false)
    })()

    return () => {
      cancelled = true
      aiBusyRef.current = false
      engine.stop()
    }
  }, [mode, engineFailed, aiColor, snap.turn, snap.fen, snap.isGameOver, level, applyUci])

  const interactive =
    !aiThinking &&
    !snap.isGameOver &&
    !pendingPromotion &&
    (mode === 'pvp' || engineFailed || snap.turn === humanColor)

  return useMemo<ChessGameApi>(
    () => ({
      ...snap,
      selected,
      legalTargets,
      hint,
      pendingPromotion,
      mode,
      humanColor,
      aiColor,
      level,
      levelId,
      orientation,
      aiThinking,
      engineFailed,
      interactive,
      onSquareClick,
      onDrop,
      resolvePromotion,
      cancelPromotion,
      newGame,
      undo,
      requestHint,
      flipBoard,
      setMode,
      setHumanColor,
      setLevel,
      loadFen,
      loadPgn,
      getFen,
      getPgn,
    }),
    [
      snap, selected, legalTargets, hint, pendingPromotion, mode, humanColor, aiColor, level, levelId,
      orientation, aiThinking, engineFailed, interactive, onSquareClick, onDrop, resolvePromotion,
      cancelPromotion, newGame, undo, requestHint, flipBoard, setMode, setHumanColor, setLevel,
      loadFen, loadPgn, getFen, getPgn,
    ],
  )
}
