'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartDataPoint } from '@/types';

interface UserGrowthChartProps {
  data: ChartDataPoint[];
}

export default function UserGrowthChart({ data }: UserGrowthChartProps) {
  return (
    <div className="card">
      <h3 className="section-title mb-4">User Growth</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563EB"
              strokeWidth={2}
              dot={{ fill: '#2563EB', r: 4 }}
              activeDot={{ r: 6 }}
              name="Users"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
