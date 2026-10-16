import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import type { SceneChart } from './model'

const fallbackColors = ['#5a7db8', '#b87d5a', '#5ab87d']

export default function SceneChartView({ chart, ink, animate }: { chart: SceneChart; ink: string; animate: boolean }) {
  // seriesKey 由 normalizeChart 分配（series-0、series-1 …），避免同名或叫 name 的系列互相覆盖。
  const data = chart.categories.map((category, index) => Object.fromEntries([['name', category], ...chart.series.map((s, i) => [s.id || `series-${i}`, s.values[index] ?? null])]))
  return <Card className="scene-chart"><CardContent>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 28, bottom: 10, left: 0 }}>
        <CartesianGrid stroke="rgba(120,132,158,.24)" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: ink, fontSize: 13, opacity: 0.72 }} tickLine={false} axisLine={{ stroke: ink, strokeOpacity: 0.22 }} />
        <YAxis width={46} tick={{ fill: ink, fontSize: 12, opacity: 0.62 }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ stroke: ink, strokeOpacity: 0.2 }} contentStyle={{ background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.7)', borderRadius: 12, fontSize: 13 }} formatter={(value, seriesId) => {
          const series = chart.series.find((s, i) => (s.id || `series-${i}`) === seriesId)
          return [value, series?.label ?? String(seriesId ?? '')]
        }} />
        {chart.series.map((s, i) => { const key = s.id || `series-${i}`; return <Line key={key} name={s.label} type="monotone" dataKey={key} stroke={s.color || fallbackColors[i % fallbackColors.length]} strokeWidth={2.6} dot={{ r: 3.4, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={animate} animationDuration={700} animationBegin={i * 160} /> })}
      </LineChart>
    </ResponsiveContainer>
  </CardContent></Card>
}
