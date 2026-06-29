import { useState } from 'react'
import { Button, Input, useToast } from '@/components/ui'
import type { XiangqiApi } from './useXiangqiGame'

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function TransferPanel({ api }: { api: XiangqiApi }) {
  const toast = useToast()
  const [fen, setFen] = useState('')

  const onCopy = async () => {
    const ok = await copy(api.getFen())
    toast(ok ? 'FEN 已复制' : '复制失败', ok ? 'success' : 'danger')
  }
  const onLoad = () => {
    const err = api.loadFen(fen)
    if (err) toast(err, 'danger')
    else {
      toast('已载入局面', 'success')
      setFen('')
    }
  }

  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">FEN</span>
        <button onClick={onCopy} className="text-xs text-accent hover:underline">
          复制当前局面
        </button>
      </div>
      <div className="flex gap-2">
        <Input
          value={fen}
          onChange={(e) => setFen(e.target.value)}
          placeholder="粘贴象棋 FEN 载入局面…"
          className="font-mono text-xs"
        />
        <Button variant="secondary" size="sm" onClick={onLoad}>
          载入
        </Button>
      </div>
    </div>
  )
}
