import { useEffect, useRef } from 'react'
import { drawThumbnail } from '../lib/drawBoard'
import type { Coord } from '../types'

export function PieceThumbnail({
  shape,
  color,
  size = 40,
}: {
  shape: Coord[]
  color: string
  size?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawThumbnail(ref.current, shape, color, size)
  }, [shape, color, size])
  return <canvas ref={ref} className="shrink-0" />
}
