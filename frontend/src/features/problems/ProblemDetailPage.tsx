import { Link, useParams } from 'react-router-dom'
import { Button, Card, CardBody, ErrorState, PageLoader, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useProblem } from './api'
import { ProblemDetail } from './components/ProblemDetail'
import { useProblemsStore, useStatus } from './store'

export default function ProblemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const query = useProblem(id)
  const toast = useToast()

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          to="/problems"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          返回题库
        </Link>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href).then(
              () => toast('链接已复制', 'success'),
              () => toast('复制失败', 'danger'),
            )
          }}
        >
          复制链接
        </Button>
      </div>

      {query.isLoading ? (
        <PageLoader label="加载题目中…" />
      ) : query.isError || !query.data ? (
        <ErrorState title="题目不存在" description="可能链接有误或题目已移除。" />
      ) : (
        <>
          <Card>
            <CardBody>
              <ProblemDetail p={query.data} />
            </CardBody>
          </Card>
          {id && <ProgressBar id={id} />}
        </>
      )}
    </div>
  )
}

function ProgressBar({ id }: { id: string }) {
  const status = useStatus(id)
  const setStatus = useProblemsStore((s) => s.setStatus)
  const clearStatus = useProblemsStore((s) => s.clearStatus)

  const Btn = ({ value, label, tone }: { value: 'solved' | 'attempted'; label: string; tone: string }) => (
    <button
      onClick={() => (status === value ? clearStatus(id) : setStatus(id, value))}
      className={cn(
        'flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
        status === value
          ? tone
          : 'border-border-soft bg-surface-2 text-fg-soft hover:border-accent/40 hover:text-fg',
      )}
    >
      {status === value ? '✓ ' : ''}
      {label}
    </button>
  )

  return (
    <div className="mt-4 flex gap-2">
      <Btn value="solved" label="标记已解决" tone="border-success/40 bg-success/12 text-success" />
      <Btn value="attempted" label="标记尝试过" tone="border-warning/40 bg-warning/12 text-warning" />
    </div>
  )
}
