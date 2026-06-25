import { Input } from '@/components/ui'

/**
 * Sticky search input + result count. The debounce lives in the parent page
 * (it owns both the raw and debounced query); this is the presentational shell.
 */
export function SearchBar({
  value,
  onChange,
  resultText,
}: {
  value: string
  onChange: (v: string) => void
  resultText?: string
}) {
  return (
    <div className="glass sticky top-14 z-20 -mx-4 mb-3 px-4 py-3 sm:-mx-6 sm:px-6">
      <div className="relative">
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="9" cy="9" r="6" />
          <path d="m14 14 3 3" strokeLinecap="round" />
        </svg>
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="搜索知识点…（支持标题、公式、描述、标签）"
          className="h-11 pl-10"
          aria-label="搜索知识点"
        />
      </div>
      {resultText && <p className="pt-1.5 pr-1 text-right text-xs text-muted">{resultText}</p>}
    </div>
  )
}
