import { Hero } from '@/components/home/Hero'
import { SectionHeader } from '@/components/home/SectionHeader'
import { ToolGrid } from '@/components/home/ToolGrid'

export default function HomePage() {
  return (
    <>
      <Hero />
      <section id="tools" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-12 sm:px-6">
        <SectionHeader
          label="Explore · 探索"
          title="全部工具"
          description="灵占玄学、奥赛题库、数学可视化工具与小游戏 —— 一处确定性的绿洲。"
        />
        <ToolGrid />
      </section>
    </>
  )
}
