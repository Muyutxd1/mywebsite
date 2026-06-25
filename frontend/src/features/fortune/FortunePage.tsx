import { useState } from 'react'
import { FortuneTabs } from './components/FortuneTabs'
import { FortuneFooter } from './components/shared'
import { MeihuaPanel } from './panels/MeihuaPanel'
import { BaziPanel } from './panels/BaziPanel'
import { ZiweiPanel } from './panels/ZiweiPanel'
import { YijingPanel } from './panels/YijingPanel'
import { TarotPanel } from './panels/TarotPanel'
import { AstrologyPanel } from './panels/AstrologyPanel'
import type { FortuneSystem } from './types'

export default function FortunePage() {
  const [system, setSystem] = useState<FortuneSystem>('meihua')

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-gold/80">
          Divination · 灵占
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          <span className="text-gold">灵占</span> · 六大玄学体系
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          梅花易数、八字、紫微斗数、易经、塔罗、占星 —— 不是替你做决定，而是为你照一面镜子。
        </p>
      </header>

      <div className="mb-6">
        <FortuneTabs value={system} onChange={setSystem} />
      </div>

      {system === 'meihua' && <MeihuaPanel />}
      {system === 'bazi' && <BaziPanel />}
      {system === 'ziwei' && <ZiweiPanel />}
      {system === 'yijing' && <YijingPanel />}
      {system === 'tarot' && <TarotPanel />}
      {system === 'astrology' && <AstrologyPanel />}

      <FortuneFooter />
    </div>
  )
}
