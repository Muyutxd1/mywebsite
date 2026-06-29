import { useState } from 'react'
import { Button, Input, Textarea, useToast } from '@/components/ui'
import type { ChessGameApi } from './useChessGame'

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function TransferPanel({ api }: { api: ChessGameApi }) {
  const toast = useToast()
  const [fen, setFen] = useState('')
  const [pgn, setPgn] = useState('')

  const onCopyFen = async () => {
    toast((await copy(api.getFen())) ? 'FEN 已复制' : '复制失败', 'success')
  }
  const onLoadFen = () => {
    const err = api.loadFen(fen)
    if (err) toast(err, 'danger')
    else {
      toast('已载入局面', 'success')
      setFen('')
    }
  }
  const onCopyPgn = async () => {
    toast((await copy(api.getPgn())) ? 'PGN 已复制' : '复制失败', 'success')
  }
  const onLoadPgn = () => {
    const err = api.loadPgn(pgn)
    if (err) toast(err, 'danger')
    else {
      toast('已载入棋谱', 'success')
      setPgn('')
    }
  }
  const onDownloadPgn = () => {
    const blob = new Blob([api.getPgn()], { type: 'application/x-chess-pgn' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'game.pgn'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">FEN</span>
          <button onClick={onCopyFen} className="text-xs text-accent hover:underline">
            复制当前局面
          </button>
        </div>
        <div className="flex gap-2">
          <Input
            value={fen}
            onChange={(e) => setFen(e.target.value)}
            placeholder="粘贴 FEN 载入局面…"
            className="font-mono text-xs"
          />
          <Button variant="secondary" size="sm" onClick={onLoadFen}>
            载入
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">PGN</span>
          <div className="flex gap-3">
            <button onClick={onCopyPgn} className="text-xs text-accent hover:underline">
              复制
            </button>
            <button onClick={onDownloadPgn} className="text-xs text-accent hover:underline">
              下载
            </button>
          </div>
        </div>
        <Textarea
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          placeholder="粘贴 PGN 棋谱载入…"
          rows={3}
          className="font-mono text-xs"
        />
        <Button variant="secondary" size="sm" onClick={onLoadPgn} className="self-end">
          载入棋谱
        </Button>
      </div>
    </div>
  )
}
