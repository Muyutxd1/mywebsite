import { FILES } from './engine'

/** Rank labels rendered to the left of the board (8 → 1). */
export function RankLabels() {
  return (
    <div className="flex flex-col justify-around pr-1 text-[10px] font-medium text-faint sm:text-xs">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="flex h-[12.5%] items-center">
          {8 - i}
        </span>
      ))}
    </div>
  )
}

/** File labels rendered below the board (a → h). */
export function FileLabels() {
  return (
    <div className="mt-1 flex w-full justify-around text-[10px] font-medium text-faint sm:text-xs">
      {FILES.split('').map((f) => (
        <span key={f} className="flex w-[12.5%] justify-center">
          {f}
        </span>
      ))}
    </div>
  )
}
