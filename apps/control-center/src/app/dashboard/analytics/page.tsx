'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import UserGrowthChart from '@/components/charts/UserGrowthChart';
import SourcePieChart from '@/components/charts/SourcePieChart';
import { useToast } from '@/components/ui/Toast';
import {
  fetchAnalyticsUserGrowth,
  fetchAnalyticsContributionTrend,
  fetchInsuranceFunnel,
  fetchGeographicDistribution,
  fetchSourceDistribution,
} from '@/lib/services';
import type { ChartDataPoint } from '@/types';

// Fallback data
const fallbackUserGrowth: ChartDataPoint[] = [
  { date: 'Jul 25', value: 15200 }, { date: 'Aug 25', value: 16400 },
  { date: 'Sep 25', value: 17300 }, { date: 'Oct 25', value: 18500 },
  { date: 'Nov 25', value: 19600 }, { date: 'Dec 25', value: 20200 },
  { date: 'Jan 26', value: 21100 }, { date: 'Feb 26', value: 22800 },
  { date: 'Mar 26', value: 24583 },
];

const fallbackContribTrend: ChartDataPoint[] = [
  { date: 'Jul 25', value: 24000000 }, { date: 'Aug 25', value: 27000000 },
  { date: 'Sep 25', value: 29000000 }, { date: 'Oct 25', value: 31000000 },
  { date: 'Nov 25', value: 28000000 }, { date: 'Dec 25', value: 33000000 },
  { date: 'Jan 26', value: 35000000 }, { date: 'Feb 26', value: 32000000 },
  { date: 'Mar 26', value: 34500000 },
];

const fallbackSourceData = [
  { name: 'Salary Deduction', value: 45000000 },
  { name: 'Self Contribution', value: 18000000 },
  { name: 'Employer Match', value: 25000000 },
  { name: 'Govt Subsidy', value: 8000000 },
];

const fallbackFunnel = [
  { label: 'Total Users', count: 24583, percent: 100 },
  { label: 'HSA Active', count: 18200, percent: 74 },
  { label: 'Insurance Enquiry', count: 12400, percent: 50 },
  { label: 'Quote Generated', count: 9800, percent: 40 },
  { label: 'Policy Purchased', count: 8742, percent: 36 },
];

const fallbackGeo = [
  { state: 'Maharashtra', users: 6420 }, { state: 'Karnataka', users: 4830 },
  { state: 'Tamil Nadu', users: 3920 }, { state: 'Delhi NCR', users: 3150 },
  { state: 'Gujarat', users: 2180 }, { state: 'Telangana', users: 1760 },
  { state: 'Rajasthan', users: 1230 }, { state: 'Others', users: 1093 },
];

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userGrowthData, setUserGrowthData] = useState<ChartDataPoint[]>(fallbackUserGrowth);
  const [contribTrend, setContribTrend] = useState<ChartDataPoint[]>(fallbackContribTrend);
  const [sourceData, setSourceData] = useState(fallbackSourceData);
  const [funnelStages, setFunnelStages] = useState(fallbackFunnel);
  const [geoData, setGeoData] = useState(fallbackGeo);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [growthRes, contribRes, sourceRes, funnelRes, geoRes] = await Promise.allSettled([
          fetchAnalyticsUserGrowth(dateFrom || undefined, dateTo || undefined),
          fetchAnalyticsContributionTrend(dateFrom || undefined, dateTo || undefined),
          fetchSourceDistribution(),
          fetchInsuranceFunnel(),
          fetchGeographicDistribution(),
        ]);
        if (!mounted) return;
        if (growthRes.status === 'fulfilled') setUserGrowthData(growthRes.value);
        if (contribRes.status === 'fulfilled') setContribTrend(contribRes.value);
        if (sourceRes.status === 'fulfilled') setSourceData(sourceRes.value);
        if (funnelRes.status === 'fulfilled') setFunnelStages(funnelRes.value);
        if (geoRes.status === 'fulfilled') setGeoData(geoRes.value);
      } catch {
        // keep fallback data
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, [dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="h-9 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-600 hover:bg-gray-50"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Charts Row 1: User Growth + Source Pie */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <UserGrowthChart data={userGrowthData} />
        <SourcePieChart data={sourceData} />
      </div>

      {/* Contribution Trend (Area Chart) */}
      <div className="card">
        <h3 className="section-title mb-4">Contribution Trend</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={contribTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                tickFormatter={(value: number) => `${(value / 10000000).toFixed(1)}Cr`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
                formatter={(value: number) => [
                  `Rs.${(value / 100).toLocaleString('en-IN')}`,
                  'Contributions',
                ]}
              />
              <defs>
                <linearGradient id="contribGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#contribGradient)"
                name="Contributions"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insurance Conversion Funnel */}
      <div className="card">
        <h3 className="section-title mb-6">Insurance Conversion Funnel</h3>
        <div className="space-y-3">
          {funnelStages.map((stage, index) => (
            <div key={stage.label} className="flex items-center gap-4">
              <div className="w-40 text-sm text-gray-600">{stage.label}</div>
              <div className="flex-1">
                <div className="h-8 overflow-hidden rounded-lg bg-gray-100">
                  <div
                    className="flex h-full items-center rounded-lg bg-primary px-3 transition-all duration-500"
                    style={{ width: `${stage.percent}%`, opacity: 1 - index * 0.15 }}
                  >
                    <span className="text-xs font-medium text-white">
                      {stage.count.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-12 text-right text-sm font-medium text-gray-500">
                {stage.percent}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Geographic Distribution (Bar Chart) */}
      <div className="card">
        <h3 className="section-title mb-4">Geographic Distribution</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={geoData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="state"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={60}
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
                formatter={(value: number) => [value.toLocaleString('en-IN'), 'Users']}
              />
              <Bar dataKey="users" fill="#2563EB" radius={[4, 4, 0, 0]} name="Users" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
