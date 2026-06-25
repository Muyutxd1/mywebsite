import { SectionHeader } from '@/components/home/SectionHeader'
import { ProjectCard } from '@/components/home/ProjectCard'
import { tools, projectExtras } from '@/data/tools'

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <SectionHeader label="Projects · 项目" title="项目展示" description="在线工具与桌面小项目。" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <ProjectCard key={t.slug} tool={t} />
        ))}
        {projectExtras.map((p) => (
          <ProjectCard key={p.title} extra={p} />
        ))}
      </div>
    </div>
  )
}
