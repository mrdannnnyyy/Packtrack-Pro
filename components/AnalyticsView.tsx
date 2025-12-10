
import React, { useState, useMemo } from 'react';
import { PackageLog, User } from '../types';
import { formatDate, calculateShiftStats, formatDuration } from '../utils';
import { StatCard } from './StatCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Package, Clock, Calendar, Users, Award, CalendarDays, Filter } from 'lucide-react';

interface AnalyticsViewProps {
  logs: PackageLog[];
  users: User[];
}

type TimeRange = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ logs, users }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<TimeRange>('WEEK');

  // --- FILTERING LOGIC ---
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Calculate cutoff time based on range
    let cutoffTime = 0;
    if (timeRange === 'TODAY') {
      cutoffTime = startOfDay;
    } else if (timeRange === 'WEEK') {
      cutoffTime = startOfDay - (7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === 'MONTH') {
      cutoffTime = startOfDay - (30 * 24 * 60 * 60 * 1000);
    }
    // 'ALL' remains 0

    return logs.filter(log => {
      // 1. Check User
      const matchesUser = selectedUserId === 'ALL' || log.userId === selectedUserId;
      // 2. Check Date Range
      const matchesDate = log.startTime >= cutoffTime;
      return matchesUser && matchesDate;
    });
  }, [logs, selectedUserId, timeRange]);

  // --- AGGREGATION LOGIC ---

  // 1. Time Series Data (Daily Breakdown)
  const logsByDate: { [key: string]: PackageLog[] } = {};
  filteredLogs.forEach(log => {
    if (!logsByDate[log.dateStr]) logsByDate[log.dateStr] = [];
    logsByDate[log.dateStr].push(log);
  });

  const timeSeriesData = Object.keys(logsByDate).sort().map(dateStr => {
    const dayLogs = logsByDate[dateStr];
    const stats = calculateShiftStats(dayLogs);
    return {
      date: dateStr,
      displayDate: formatDate(dateStr),
      packages: stats.count,
      avgDurationMins: parseFloat((stats.avgDuration / 1000 / 60).toFixed(2)),
      shiftHours: parseFloat((stats.shiftDuration / 1000 / 60 / 60).toFixed(2)),
    };
  });

  // 2. User Comparison Data
  const userStats = users.map(user => {
    // Filter the ALREADY filtered logs to just this user
    // This ensures the leaderboard respects the selected time range
    const userLogs = filteredLogs.filter(l => l.userId === user.id);
    const stats = calculateShiftStats(userLogs);
    return {
      name: user.name,
      totalPackages: stats.count,
      avgDurationMins: parseFloat((stats.avgDuration / 1000 / 60).toFixed(2)),
      rawAvgDuration: stats.avgDuration
    };
  }).sort((a, b) => b.totalPackages - a.totalPackages);

  // --- KEY METRICS ---
  const totalPackages = filteredLogs.length;
  const completedLogs = filteredLogs.filter(l => l.endTime !== null);
  const globalAvgMs = completedLogs.length > 0 
    ? completedLogs.reduce((acc, l) => acc + ((l.endTime || 0) - l.startTime), 0) / completedLogs.length 
    : 0;
  
  // Calculate active days within the selected range
  const distinctDays = Object.keys(logsByDate).length;
  const efficiencyRate = distinctDays > 0 ? (totalPackages / distinctDays).toFixed(0) : 0;

  return (
    <div className="space-y-6">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Performance Analytics
          </h2>
          <p className="text-sm text-slate-500">
            Analyzing data for <span className="font-semibold text-slate-700">
              {timeRange === 'TODAY' ? 'Today' : 
               timeRange === 'WEEK' ? 'Last 7 Days' : 
               timeRange === 'MONTH' ? 'Last 30 Days' : 'All Time'}
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  timeRange === range 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {range === 'TODAY' ? 'Today' : 
                 range === 'WEEK' ? '7 Days' : 
                 range === 'MONTH' ? '30 Days' : 'All'}
              </button>
            ))}
          </div>

          {/* User Filter */}
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Users className="w-4 h-4 text-slate-400" />
             </div>
             <select 
              value={selectedUserId} 
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none h-full"
            >
              <option value="ALL">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total Packages" 
          value={totalPackages.toLocaleString()} 
          subValue={`In selected range`}
          icon={<Package className="w-6 h-6" />}
          color="blue"
        />
        <StatCard 
          label="Avg Time / Pkg" 
          value={formatDuration(globalAvgMs)} 
          subValue={selectedUserId === 'ALL' ? 'Team Average' : 'Personal Average'}
          icon={<Clock className="w-6 h-6" />}
          color="green"
        />
        <StatCard 
          label="Active Days" 
          value={distinctDays.toString()} 
          subValue="Days with data"
          icon={<Calendar className="w-6 h-6" />}
          color="purple"
        />
        <StatCard 
          label="Throughput" 
          value={`${efficiencyRate} pkg/day`} 
          subValue="Daily Average"
          icon={<Award className="w-6 h-6" />}
          color="orange"
        />
      </div>

      {/* LEADERBOARDS (Only visible if 'All Users' is selected) */}
      {selectedUserId === 'ALL' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-2">
                 <Award className="w-5 h-5 text-yellow-500" />
                 <h3 className="text-lg font-bold text-slate-800">Top Packers (Volume)</h3>
               </div>
               <span className="text-xs font-semibold bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">{timeRange}</span>
             </div>
             <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={userStats} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                   <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                   <Bar dataKey="totalPackages" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="Packages" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-2">
                 <Clock className="w-5 h-5 text-green-500" />
                 <h3 className="text-lg font-bold text-slate-800">Fastest Packers</h3>
               </div>
               <span className="text-xs font-semibold bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">{timeRange}</span>
             </div>
             <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart 
                    data={[...userStats].sort((a,b) => (a.rawAvgDuration || 99999999) - (b.rawAvgDuration || 99999999)).filter(u => u.totalPackages > 0)} 
                    layout="vertical" 
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                 >
                   <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                   <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                   <Bar dataKey="avgDurationMinutes" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} name="Avg Mins" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>
      )}

      {/* TREND CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
             <CalendarDays className="w-5 h-5 text-indigo-500" />
             <h3 className="text-lg font-bold text-slate-800">Volume Trend</h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="displayDate" tick={{fontSize: 11}} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  cursor={{fill: '#f1f5f9'}}
                />
                <Bar name="Packages" dataKey="packages" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
             <Clock className="w-5 h-5 text-rose-500" />
             <h3 className="text-lg font-bold text-slate-800">Speed Trend (Mins)</h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="displayDate" tick={{fontSize: 11}} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Line 
                  type="monotone" 
                  name="Avg Duration" 
                  dataKey="avgDurationMins" 
                  stroke="#f43f5e" 
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
