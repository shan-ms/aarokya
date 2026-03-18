'use client';

import { useEffect, useState } from 'react';
import { Users, Wallet, ArrowDownToLine, ShieldCheck } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import UserGrowthChart from '@/components/charts/UserGrowthChart';
import ContributionChart from '@/components/charts/ContributionChart';
import SourcePieChart from '@/components/charts/SourcePieChart';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { formatCurrencyCompact, formatDateTime } from '@/lib/utils';
import {
  fetchDashboardStats,
  fetchUserGrowthChart,
  fetchContributionChart,
  fetchSourceDistribution,
  fetchRecentActivity,
} from '@/lib/services';
import type { DashboardStats, ChartDataPoint } from '@/types';

// Fallback mock data for when API is unavailable
const fallbackStats: DashboardStats = {
  total_users: 24583,
  total_hsa_value_paise: 1875000000,
  daily_contributions_paise: 34500000,
  active_policies: 8742,
  user_growth_percent: 12.5,
  hsa_growth_percent: 8.3,
  contribution_growth_percent: 15.2,
  policy_growth_percent: 6.8,
};

const fallbackUserGrowth: ChartDataPoint[] = [
  { date: 'Jan', value: 18200 },
  { date: 'Feb', value: 19100 },
  { date: 'Mar', value: 19800 },
  { date: 'Apr', value: 20500 },
  { date: 'May', value: 21400 },
  { date: 'Jun', value: 22100 },
  { date: 'Jul', value: 22800 },
  { date: 'Aug', value: 23200 },
  { date: 'Sep', value: 23600 },
  { date: 'Oct', value: 23900 },
  { date: 'Nov', value: 24200 },
  { date: 'Dec', value: 24583 },
];

const fallbackContributions: ChartDataPoint[] = [
  { date: 'Jan', value: 28000000 },
  { date: 'Feb', value: 31000000 },
  { date: 'Mar', value: 29500000 },
  { date: 'Apr', value: 32000000 },
  { date: 'May', value: 30500000 },
  { date: 'Jun', value: 33000000 },
  { date: 'Jul', value: 34500000 },
  { date: 'Aug', value: 31000000 },
  { date: 'Sep', value: 35000000 },
  { date: 'Oct', value: 33500000 },
  { date: 'Nov', value: 36000000 },
  { date: 'Dec', value: 34500000 },
];

const fallbackSources = [
  { name: 'Salary Deduction', value: 45000000 },
  { name: 'Self Contribution', value: 18000000 },
  { name: 'Employer Match', value: 25000000 },
  { name: 'Govt Subsidy', value: 8000000 },
];

const fallbackActivity = [
  { id: '1', action: 'New user registration', user: 'Priya Sharma', time: '2026-03-18T10:30:00Z', type: 'user' },
  { id: '2', action: 'Claim submitted', user: 'Rajesh Kumar', time: '2026-03-18T10:15:00Z', type: 'claim' },
  { id: '3', action: 'HSA contribution', user: 'Meena Devi', time: '2026-03-18T09:45:00Z', type: 'contribution' },
  { id: '4', action: 'Policy activated', user: 'Amit Patel', time: '2026-03-18T09:30:00Z', type: 'policy' },
  { id: '5', action: 'Claim approved', user: 'Sunita Rao', time: '2026-03-18T09:00:00Z', type: 'claim' },
];

const activityBadge: Record<string, 'info' | 'warning' | 'success'> = {
  user: 'info',
  claim: 'warning',
  contribution: 'success',
  policy: 'info',
};

export default function DashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>(fallbackStats);
  const [userGrowthData, setUserGrowthData] = useState<ChartDataPoint[]>(fallbackUserGrowth);
  const [contributionData, setContributionData] = useState<ChartDataPoint[]>(fallbackContributions);
  const [sourceData, setSourceData] = useState<{ name: string; value: number }[]>(fallbackSources);
  const [activity, setActivity] = useState(fallbackActivity);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadDashboard() {
      try {
        const [statsRes, growthRes, contribRes, sourceRes, activityRes] = await Promise.allSettled([
          fetchDashboardStats(),
          fetchUserGrowthChart(),
          fetchContributionChart(),
          fetchSourceDistribution(),
          fetchRecentActivity(),
        ]);
        if (!mounted) return;
        if (statsRes.status === 'fulfilled') setStats(statsRes.value);
        if (growthRes.status === 'fulfilled') setUserGrowthData(growthRes.value);
        if (contribRes.status === 'fulfilled') setContributionData(contribRes.value);
        if (sourceRes.status === 'fulfilled') setSourceData(sourceRes.value);
        if (activityRes.status === 'fulfilled') setActivity(activityRes.value);
      } catch {
        toast('warning', 'Using cached data', 'Could not reach server. Showing sample data.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadDashboard();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Total Users"
          value={stats.total_users.toLocaleString('en-IN')}
          trend={stats.user_growth_percent}
          trendLabel="vs last month"
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total HSA Value"
          value={formatCurrencyCompact(stats.total_hsa_value_paise)}
          trend={stats.hsa_growth_percent}
          trendLabel="vs last month"
        />
        <StatCard
          icon={<ArrowDownToLine className="h-5 w-5" />}
          label="Daily Contributions"
          value={formatCurrencyCompact(stats.daily_contributions_paise)}
          trend={stats.contribution_growth_percent}
          trendLabel="vs yesterday"
        />
        <StatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Active Policies"
          value={stats.active_policies.toLocaleString('en-IN')}
          trend={stats.policy_growth_percent}
          trendLabel="vs last month"
        />
      </div>

      {/* Charts Row 1: User Growth + Contributions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <UserGrowthChart data={userGrowthData} />
        <ContributionChart data={contributionData} />
      </div>

      {/* Charts Row 2: Source Pie */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SourcePieChart data={sourceData} />

        {/* Recent Activity */}
        <div className="card">
          <h3 className="section-title mb-4">Recent Activity</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">User</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Loading...
                      </div>
                    </td>
                  </tr>
                ) : (
                  activity.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-3 text-gray-700">{item.action}</td>
                      <td className="py-3 font-medium text-gray-900">{item.user}</td>
                      <td className="py-3">
                        <Badge variant={activityBadge[item.type] || 'neutral'}>{item.type}</Badge>
                      </td>
                      <td className="py-3 text-gray-500">{formatDateTime(item.time)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
