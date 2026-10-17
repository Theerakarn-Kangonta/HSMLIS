import { useMemo } from 'react'
import { code128Widths } from '../lib/code128'

/** A Code 128 barcode as crisp SVG bars, sized by its container. */
export function Barcode({ value, height = 40, className = '' }: { value: string; height?: number; className?: string }) {
  const bars = useMemo(() => {
    const widths = code128Widths(value)
    const rects: { x: number; w: number }[] = []
    let x = 10 // quiet zone, in modules
    widths.forEach((w, i) => {
      if (i % 2 === 0) rects.push({ x, w })
      x += w
    })
    return { rects, total: x + 10 }
  }, [value])

  return (
    <svg
      viewBox={`0 0 ${bars.total} ${height}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={`block w-full ${className}`}
      style={{ height }}
      role="img"
      aria-label={value}
    >
      <rect width={bars.total} height={height} fill="#fff" />
      {bars.rects.map((r) => (
        <rect key={r.x} x={r.x} width={r.w} height={height} fill="#000" />
      ))}
    </svg>
  )
}
