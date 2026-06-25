import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-28 text-center">
      <p className="text-7xl font-bold text-cosmic">404</p>
      <p className="mt-4 text-muted">这里什么都没有，像一片尚未点亮的星空。</p>
      <Link
        to="/"
        className="mt-8 inline-flex h-10 items-center rounded-xl bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-accent-strong"
      >
        返回首页
      </Link>
    </div>
  )
}
