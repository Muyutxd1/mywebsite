// Stockfish 18（单线程精简 WASM 版）封装：用 UCI 协议跟引擎 worker 通信。
// 引擎产物放在 /public/stockfish/{stockfish.js,stockfish.wasm}，作为 classic worker 加载，
// 单线程构建无需 SharedArrayBuffer / COOP-COEP 头，可直接由 Flask 静态服务。

export interface SearchOptions {
  /** Stockfish `Skill Level`（0–20），越大越强。 */
  skill: number
  /** 单步思考时长（毫秒）。 */
  movetime: number
}

export interface EngineInfo {
  depth?: number
  scoreCp?: number
  scoreMate?: number
}

/** 引擎初始化看门狗（毫秒）：超时仍未就绪即判定加载失败。 */
const READY_TIMEOUT = 12000
/** 单次搜索的最大等待时长 = movetime + 该余量（毫秒）；超时判定引擎卡死。 */
const SEARCH_MARGIN = 5000

function lineOf(data: unknown): string {
  if (typeof data === 'string') return data
  if (data && typeof data === 'object' && 'data' in data) return String((data as { data: unknown }).data)
  return String(data)
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export class StockfishEngine {
  private worker: Worker | null = null
  private readyPromise: Promise<void>
  private resolveReady!: () => void
  private rejectReady!: (err: Error) => void
  private settled = false
  private bestmoveResolver: ((move: string | null) => void) | null = null
  private searchTimer: ReturnType<typeof setTimeout> | null = null
  private readyTimer: ReturnType<typeof setTimeout> | null = null
  /** 因中止上一搜索而即将到来、需要丢弃的 bestmove 行数（每次 stop 对应 1 行）。 */
  private staleBestmoves = 0
  private disposed = false
  private failed = false
  private notifiedError = false

  /** 引擎在任意时刻发生不可恢复错误时回调（含初始化后崩溃）。 */
  onError?: () => void
  /** 搜索过程中的 info 行回调。 */
  onInfo?: (info: EngineInfo) => void

  constructor() {
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })

    try {
      const url = `${import.meta.env.BASE_URL}stockfish/stockfish.js`
      const worker = new Worker(url)
      worker.onmessage = (e: MessageEvent) => this.handleLine(lineOf(e.data))
      worker.onerror = () => this.fail(new Error('Stockfish worker 运行时错误'))
      this.worker = worker
      this.post('uci')
      this.post('isready')
      this.readyTimer = setTimeout(() => this.fail(new Error('Stockfish 初始化超时')), READY_TIMEOUT)
    } catch (err) {
      this.fail(err instanceof Error ? err : new Error(String(err)))
    }
  }

  ready(): Promise<void> {
    return this.readyPromise
  }

  private post(cmd: string): void {
    this.worker?.postMessage(cmd)
  }

  private clearSearchTimer(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }
  }

  private settleReady(ok: boolean, err?: Error): void {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer)
      this.readyTimer = null
    }
    if (this.settled) return
    this.settled = true
    if (ok) this.resolveReady()
    else this.rejectReady(err ?? new Error('engine failed'))
  }

  /** 标记引擎永久不可用：解掉在途搜索、拒绝就绪 Promise、终止 worker、通知上层一次。 */
  private fail(err: Error): void {
    if (this.failed) return
    this.failed = true
    this.clearSearchTimer()
    const resolve = this.bestmoveResolver
    this.bestmoveResolver = null
    resolve?.(null)
    this.settleReady(false, err)
    // 引擎已判定不可用：终止 worker，避免遗留僵尸线程。
    this.worker?.terminate()
    this.worker = null
    if (!this.notifiedError) {
      this.notifiedError = true
      this.onError?.()
    }
  }

  private handleLine(line: string): void {
    if (line.startsWith('readyok') || line === 'uciok') {
      this.settleReady(true)
      return
    }
    if (line.startsWith('bestmove')) {
      // 丢弃因中止上一搜索而产生的 bestmove，避免它兑现新搜索的 Promise。
      if (this.staleBestmoves > 0) {
        this.staleBestmoves--
        return
      }
      this.clearSearchTimer()
      const token = line.split(/\s+/)[1]
      const move = !token || token === '(none)' ? null : token
      const resolve = this.bestmoveResolver
      this.bestmoveResolver = null
      resolve?.(move)
      return
    }
    if (line.startsWith('info') && this.onInfo) {
      this.onInfo(parseInfo(line))
    }
  }

  newGame(): void {
    this.post('ucinewgame')
    this.post('isready')
  }

  /**
   * 给定 FEN 局面，返回引擎建议的最佳走法（如 'e2e4' / 'e7e8q'），无棋可走 / 失败时返回 null。
   * 同一时刻只应有一次搜索；若已有未完成搜索会先被中止（其 bestmove 会被丢弃）。
   */
  async analyse(fen: string, { skill, movetime }: SearchOptions): Promise<string | null> {
    if (this.disposed || this.failed) return null
    try {
      await this.readyPromise
    } catch {
      return null
    }
    if (this.disposed || this.failed || !this.worker) return null

    if (this.bestmoveResolver) {
      const prev = this.bestmoveResolver
      this.bestmoveResolver = null
      this.clearSearchTimer()
      prev(null)
      this.staleBestmoves++
      this.post('stop')
    }

    const time = Math.max(50, Math.round(movetime))
    this.post(`setoption name Skill Level value ${clamp(Math.round(skill), 0, 20)}`)
    this.post(`position fen ${fen}`)
    return new Promise<string | null>((resolve) => {
      this.bestmoveResolver = resolve
      this.searchTimer = setTimeout(() => this.fail(new Error('Stockfish 搜索超时')), time + SEARCH_MARGIN)
      this.post(`go movetime ${time}`)
    })
  }

  stop(): void {
    this.post('stop')
  }

  dispose(): void {
    this.disposed = true
    this.clearSearchTimer()
    const resolve = this.bestmoveResolver
    this.bestmoveResolver = null
    resolve?.(null)
    // 兑现（拒绝）就绪 Promise，避免仍在 await readyPromise 的 analyse 永久悬挂。
    this.settleReady(false, new Error('engine disposed'))
    this.post('quit')
    this.worker?.terminate()
    this.worker = null
  }
}

function parseInfo(line: string): EngineInfo {
  const t = line.split(/\s+/)
  const info: EngineInfo = {}
  for (let i = 0; i < t.length; i++) {
    if (t[i] === 'depth') info.depth = Number(t[i + 1])
    else if (t[i] === 'score') {
      if (t[i + 1] === 'cp') info.scoreCp = Number(t[i + 2])
      else if (t[i + 1] === 'mate') info.scoreMate = Number(t[i + 2])
    }
  }
  return info
}
