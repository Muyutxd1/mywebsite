import { Tabs } from '@/components/ui'
import type { TabItem } from '@/components/ui'
import type { FortuneSystem } from '../types'

const TABS: TabItem<FortuneSystem>[] = [
  { value: 'meihua', label: '梅花易数' },
  { value: 'bazi', label: '八字' },
  { value: 'ziwei', label: '紫微斗数' },
  { value: 'yijing', label: '易经' },
  { value: 'tarot', label: '塔罗牌' },
  { value: 'astrology', label: '占星' },
]

export function FortuneTabs({
  value,
  onChange,
}: {
  value: FortuneSystem
  onChange: (v: FortuneSystem) => void
}) {
  return <Tabs tabs={TABS} value={value} onChange={onChange} className="flex-wrap" />
}
