'use client';

import UserGrowthChart from '@/components/charts/UserGrowthChart';
import ContributionChart from '@/components/charts/ContributionChart';
import SourcePieChart from '@/components/charts/SourcePieChart';
import type { ChartDataPoint } from '@/types';

const userGrowthData: ChartDataPoint[] = [
  { date: 'Jul 25', value: 15200 },
  { date: 'Aug 25', value: 16400 },
  { date: 'Sep 25', value: 17300 },
  { date: 'Oct 25', value: 18500 },
  { date: 'Nov 25', value: 19600 },
  { date: 'Dec 25', value: 20200 },
  { date: 'Jan 26', value: 21100 },
  { date: 'Feb 26', value: 22800 },
  { date: 'Mar 26', value: 24583 },
];

const contributionData: ChartDataPoint[] = [
  { date: 'Jul 25', value: 24000000 },
  { date: 'Aug 25', value: 27000000 },
  { date: 'Sep 25', value: 29000000 },
  { date: 'Oct 25', value: 31000000 },
  { date: 'Nov 25', value: 28000000 },
  { date: 'Dec 25', value: 33000000 },
  { date: 'Jan 26', value: 35000000 },
  { date: 'Feb 26', value: 32000000 },
  { date: 'Mar 26', value: 34500000 },
];

const sourceData = [
  { name: 'Salary Deduction', value: 45000000 },
  { name: 'Self Contribution', value: 18000000 },
  { name: 'Employer Match', value: 25000000 },
  { name: 'Govt Subsidy', value: 8000000 },
];

const funnelStages = [
  { label: 'Total Users', count: 24583, percent: 100 },
  { label: 'HSA Active', count: 18200, percent: 74 },
  { label: 'Insurance Enquiry', count: 12400, percent: 50 },
  { label: 'Quote Generated', count: 9800, percent: 40 },
  { label: 'Policy Purchased', count: 8742, percent: 36 },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <UserGrowthChart data={userGrowthData} />
        <SourcePieChart data={sourceData} />
      </div>

      {/* Contribution Trend */}
      <ContributionChart data={contributionData} />

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

      {/* Geographic Distribution */}
      <div className="card">
        <h3 className="section-title mb-4">Geographic Distribution</h3>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500">Map Visualization</p>
            <p className="mt-1 text-xs text-gray-400">
              Geographic distribution of users across India. Integration with mapping library pending.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { state: 'Maharashtra', users: 6420 },
            { state: 'Karnataka', users: 4830 },
            { state: 'Tamil Nadu', users: 3920 },
            { state: 'Delhi NCR', users: 3150 },
            { state: 'Gujarat', users: 2180 },
            { state: 'Telangana', users: 1760 },
            { state: 'Rajasthan', users: 1230 },
            { state: 'Others', users: 1093 },
          ].map((item) => (
            <div key={item.state} className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500">{item.state}</p>
              <p className="mt-0.5 text-lg font-semibold text-gray-900">{item.users.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
