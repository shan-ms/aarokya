'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  className?: string;
}

export default function StatCard({ icon, label, value, trend, trendLabel, className }: StatCardProps) {
  const trendDirection = trend === undefined || trend === 0 ? 'neutral' : trend > 0 ? 'up' : 'down';

  return (
    <div className={cn('card flex items-start justify-between', className)}>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend !== undefined && (
          <div className="flex items-center gap-1">
            {trendDirection === 'up' && <TrendingUp className="h-3.5 w-3.5 text-secondary" />}
            {trendDirection === 'down' && <TrendingDown className="h-3.5 w-3.5 text-danger" />}
            {trendDirection === 'neutral' && <Minus className="h-3.5 w-3.5 text-gray-400" />}
            <span
              className={cn(
                'text-xs font-medium',
                trendDirection === 'up' && 'text-secondary',
                trendDirection === 'down' && 'text-danger',
                trendDirection === 'neutral' && 'text-gray-400'
              )}
            >
              {trend > 0 ? '+' : ''}{trend}%
            </span>
            {trendLabel && <span className="text-xs text-gray-400">{trendLabel}</span>}
          </div>
        )}
      </div>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
        {icon}
      </div>
    </div>
  );
}
