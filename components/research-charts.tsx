'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
} from 'recharts'
import type { ChartData } from '@/lib/stores/research-store'

const SENTIMENT_COLORS = ['#22c55e', '#94a3b8', '#ef4444']
const RADAR_FILL = '#2563eb'
const RADAR_STROKE = '#2563eb'

interface ResearchChartsProps {
  chartData: ChartData
}

export function ResearchCharts({ chartData }: ResearchChartsProps) {
  const pieData = [
    { name: '긍정', value: chartData.sentiment.positive, color: SENTIMENT_COLORS[0] },
    { name: '중립', value: chartData.sentiment.neutral, color: SENTIMENT_COLORS[1] },
    { name: '부정', value: chartData.sentiment.negative, color: SENTIMENT_COLORS[2] },
  ].filter((d) => d.value > 0)

  const radarData = chartData.impact.map((i) => ({
    subject: i.subject,
    score: i.score,
    fullMark: 10,
  }))

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4">감성 분석 (긍정 / 중립 / 부정)</h3>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`${value}%`, '비율']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4">분야별 영향력</h3>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: '#1a1a1a', fontSize: 12 }}
                tickLine={{ stroke: '#e5e7eb' }}
              />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Radar
                name="영향력"
                dataKey="score"
                stroke={RADAR_STROKE}
                fill={RADAR_FILL}
                fillOpacity={0.4}
                strokeWidth={2}
              />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        ※ 본 지표는 AI가 수집된 뉴스를 분석하여 생성한 추정치입니다.
      </p>
    </div>
  )
}
