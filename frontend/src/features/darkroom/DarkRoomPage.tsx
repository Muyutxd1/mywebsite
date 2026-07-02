import { useState } from 'react'

/**
 * A Dark Room（小黑屋）— 原版开源游戏（MPL-2.0，doublespeakgames/adarkroom），
 * 静态托管在 /adarkroom/ 下，这里用同源 iframe 嵌入。
 * 默认带 ?lang=zh_cn 强制官方中文；进度存 localStorage，与站点同源共享。
 */
const GAME_URL = '/adarkroom/index.html?lang=zh_cn'

export default function DarkRoomPage() {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-2 text-sm">
        <span className="text-faint">
          小黑屋 · A Dark Room —— 原版复刻（
          <a
            href="https://github.com/doublespeakgames/adarkroom"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-fg"
          >
            doublespeakgames
          </a>
          ，MPL-2.0）
        </span>
        <a
          href={GAME_URL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-faint underline decoration-dotted underline-offset-2 hover:text-fg"
        >
          新窗口打开 ↗
        </a>
      </div>
      <div className="relative flex-1">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-faint">
            房间又黑又冷……
          </div>
        )}
        <iframe
          src={GAME_URL}
          title="A Dark Room 小黑屋"
          onLoad={() => setLoaded(true)}
          className="h-full w-full border-0 bg-white"
        />
      </div>
    </div>
  )
}
