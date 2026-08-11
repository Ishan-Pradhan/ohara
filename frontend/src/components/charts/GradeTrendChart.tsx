import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import type { GradeTrendPoint } from '../../features/trends/trends.schema.js';
import { Card } from '../ui/Card.js';
import { EmptyState } from '../ui/EmptyState.js';
import { BarChart3 } from 'lucide-react';

interface GradeTrendChartProps {
  data: GradeTrendPoint[];
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const formatTooltipDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const GradeTrendChart = ({ data }: GradeTrendChartProps) => {
  if (data.length === 0) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={BarChart3}
          title="No grades yet"
          description="Grade trends will appear here once assessments are graded."
        />
      </Card>
    );
  }

  // Transform data: compute percentage for each point
  const chartData = data.map((point) => ({
    date: point.date,
    dateLabel: formatDate(point.date),
    percentage: point.maxScore > 0 ? Math.round((point.score / point.maxScore) * 100) : 0,
    title: point.title,
    type: point.type,
    score: point.score,
    maxScore: point.maxScore,
  }));

  // Group by type for separate lines
  const assignmentData = chartData.filter((d) => d.type === 'assignment');
  const quizData = chartData.filter((d) => d.type === 'quiz');

  // Merge into a single timeline for the chart
  const allDates = [...new Set(chartData.map((d) => d.date))].sort();
  const mergedData = allDates.map((date) => {
    const assignment = assignmentData.find((d) => d.date === date);
    const quiz = quizData.find((d) => d.date === date);
    return {
      date,
      dateLabel: formatDate(date),
      assignment: assignment?.percentage ?? null,
      quiz: quiz?.percentage ?? null,
    };
  });

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number | null; dataKey: string; payload: { dateLabel: string } }>; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="rounded-card border border-border bg-surface px-3 py-2 text-xs shadow-md">
        <p className="mb-1 font-medium text-fg">{payload[0]?.payload.dateLabel}</p>
        {payload.map((entry) => (
          <p key={entry.dataKey} className="text-muted">
            {entry.dataKey === 'assignment' ? 'Assignments' : 'Quizzes'}:{' '}
            <span className="font-medium text-fg">{entry.value !== null ? `${entry.value}%` : '—'}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card padding="sm">
      <h2 className="mb-3 text-sm font-semibold text-fg">Grade Trends</h2>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={mergedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} className="text-muted" />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            className="text-muted"
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="assignment"
            name="Assignments"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="quiz"
            name="Quizzes"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};
