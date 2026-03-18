'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartDataPoint } from '@/types';

interface ContributionChartProps {
  data: ChartDataPoint[];
}

export default function ContributionChart({ data }: ContributionChartProps) {
  return (
    <div className="card">
      <h3 className="section-title mb-4">Contribution Trend</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
              formatter={(value: number) => [
                `₹${(value / 100).toLocaleString('en-IN')}`,
                'Contributions',
              ]}
            />
            <Bar
              dataKey="value"
              fill="#10B981"
              radius={[4, 4, 0, 0]}
              name="Contributions"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
