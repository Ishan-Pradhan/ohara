import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import type { AttendanceTrendPoint } from '../../features/trends/trends.schema.js';
import { Card } from '../ui/Card.js';
import { EmptyState } from '../ui/EmptyState.js';
import { CalendarCheck } from 'lucide-react';

interface AttendanceTrendChartProps {
  data: AttendanceTrendPoint[];
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export const AttendanceTrendChart = ({ data }: AttendanceTrendChartProps) => {
  if (data.length === 0) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={CalendarCheck}
          title="No attendance sessions"
          description="Attendance trends will appear here once sessions are recorded."
        />
      </Card>
    );
  }

  const chartData = data.map((point) => ({
    date: point.date,
    dateLabel: formatDate(point.date),
    Present: point.present,
    Late: point.late,
    Absent: point.absent,
  }));

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="rounded-card border border-border bg-surface px-3 py-2 text-xs shadow-md">
        <p className="mb-1 font-medium text-fg">{label}</p>
        {payload.map((entry) => (
          <p key={entry.dataKey} className="text-muted">
            {entry.dataKey}: <span className="font-medium text-fg">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card padding="sm">
      <h2 className="mb-3 text-sm font-semibold text-fg">Attendance Trends</h2>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} className="text-muted" />
          <YAxis tick={{ fontSize: 12 }} className="text-muted" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="Present" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Late" stackId="a" fill="#d97706" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Absent" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
