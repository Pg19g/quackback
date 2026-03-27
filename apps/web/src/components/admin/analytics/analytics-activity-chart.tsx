import { useState } from 'react'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { cn } from '@/lib/shared/utils'

interface ActivityChartProps {
  dailyStats: Array<{ date: string; posts: number; votes: number; comments: number }>
}

const METRICS = [
  { key: 'posts', label: 'Posts', color: 'hsl(var(--chart-1))' },
  { key: 'votes', label: 'Votes', color: 'hsl(var(--chart-2))' },
  { key: 'comments', label: 'Comments', color: 'hsl(var(--chart-3))' },
] as const

type MetricKey = (typeof METRICS)[number]['key']

const chartConfig = Object.fromEntries(
  METRICS.map(({ key, label, color }) => [key, { label, color }])
) as ChartConfig

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function AnalyticsActivityChart({ dailyStats }: ActivityChartProps) {
  const [active, setActive] = useState<Set<MetricKey>>(new Set(['posts', 'votes', 'comments']))

  function toggle(key: MetricKey) {
    setActive((prev) => {
      if (prev.has(key) && prev.size === 1) return prev // keep at least one
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  if (dailyStats.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No data for this period
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {METRICS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              active.has(key)
                ? 'border-transparent text-white'
                : 'border-border bg-transparent text-muted-foreground hover:text-foreground'
            )}
            style={active.has(key) ? { background: color, borderColor: color } : undefined}
          >
            {label}
          </button>
        ))}
      </div>
      <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
        <AreaChart data={dailyStats} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={formatDate}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(label) => formatDate(String(label))} />}
          />
          {METRICS.filter(({ key }) => active.has(key)).map(({ key }) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={`var(--color-${key})`}
              fill={`var(--color-${key})`}
              fillOpacity={0.12}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
