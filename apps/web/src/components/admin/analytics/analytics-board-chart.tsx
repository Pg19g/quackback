import { useMemo } from 'react'

interface BoardChartProps {
  data: Array<{ board: string; count: number }>
}

export function AnalyticsBoardChart({ data }: BoardChartProps) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.count - a.count), [data])
  const total = useMemo(() => sorted.reduce((sum, d) => sum + d.count, 0), [sorted])
  const maxCount = Math.max(...sorted.map((d) => d.count), 1)

  if (sorted.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        No data for this period
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      {sorted.map((item) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
        const barWidth = (item.count / maxCount) * 100
        return (
          <div key={item.board} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm">{item.board}</span>
              <div className="flex shrink-0 items-baseline gap-1.5">
                <span className="text-sm font-semibold tabular-nums">{item.count}</span>
                <span className="text-xs text-muted-foreground">{pct}%</span>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
