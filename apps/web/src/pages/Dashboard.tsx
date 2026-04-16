import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  FileText, TrendingUp, DollarSign, Bell, Calendar, Trophy,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';

const STATUS_CLASSES: Record<string, string> = {
  won: 'badge-success',
  lost: 'badge-danger',
  pending: 'badge-warning',
  no_response: 'badge-gray',
};

const STATUS_LABELS: Record<string, string> = {
  won: 'Won',
  lost: 'Lost',
  pending: 'Pending',
  no_response: 'No Response',
};

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: analyticsApi.getDashboard,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['analytics', 'timeline'],
    queryFn: () => analyticsApi.getTimeline(30),
  });

  const statCards = [
    {
      label: 'Total Proposals',
      value: stats?.totalProposals ?? 0,
      icon: FileText,
      color: 'text-primary bg-primary/10',
    },
    {
      label: 'Won',
      value: stats?.wonProposals ?? 0,
      icon: Trophy,
      color: 'text-success bg-success/10',
    },
    {
      label: 'Win Rate',
      value: `${stats?.winRate ?? 0}%`,
      icon: TrendingUp,
      color: 'text-accent bg-accent/10',
    },
    {
      label: 'Avg Bid',
      value: `$${stats?.avgBidAmount ?? 0}`,
      icon: DollarSign,
      color: 'text-warning bg-warning/10',
    },
    {
      label: 'This Week',
      value: stats?.proposalsThisWeek ?? 0,
      icon: Calendar,
      color: 'text-primary bg-primary/10',
    },
    {
      label: 'Active Alerts',
      value: stats?.activeAlerts ?? 0,
      icon: Bell,
      color: 'text-danger bg-danger/10',
    },
  ];

  const chartData = timeline.map((d: { date: string; proposals: number; won: number }) => ({
    ...d,
    date: format(parseISO(d.date), 'MMM d'),
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark">
          Good {getGreeting()}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-slate-500 mt-0.5">Here's your freelance activity overview</p>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="w-8 h-8 bg-slate-100 rounded-lg mb-3" />
              <div className="h-6 bg-slate-100 rounded mb-1 w-12" />
              <div className="h-3 bg-slate-100 rounded w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4">
              <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center mb-3', color)}>
                <Icon size={18} />
              </div>
              <p className="text-xl font-bold text-dark">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-dark mb-4">Proposals — Last 30 Days</h2>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              No proposal data yet. Start sending proposals to see trends.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc', fontSize: 12 }}
                  cursor={{ stroke: '#1A56DB', strokeWidth: 1, strokeDasharray: '4 2' }}
                />
                <Line type="monotone" dataKey="proposals" stroke="#1A56DB" strokeWidth={2} dot={false} name="Proposals" />
                <Line type="monotone" dataKey="won" stroke="#10B981" strokeWidth={2} dot={false} name="Won" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Proposals */}
        <div className="card p-5">
          <h2 className="font-semibold text-dark mb-4">Recent Proposals</h2>
          {!stats?.recentProposals?.length ? (
            <p className="text-slate-400 text-sm">No proposals yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentProposals.map((p: {
                id: string;
                projectTitle: string;
                status: string;
                bidAmount: number;
                platform: string;
                createdAt: string;
              }) => (
                <div key={p.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-dark truncate">{p.projectTitle}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {p.platform} · ${p.bidAmount}
                    </p>
                  </div>
                  <span className={clsx('badge flex-shrink-0', STATUS_CLASSES[p.status])}>
                    {STATUS_LABELS[p.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
