import React, { useState } from 'react';
import { PackageLog, User } from '../types';
import { formatDate, calculateShiftStats, formatDuration } from '../utils';
import { StatCard } from './StatCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Package, Clock, Calendar, Users, Award } from 'lucide-react';

interface AnalyticsViewProps {
  logs: PackageLog[];
  users: User[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ logs, users }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');

  // Filter logs based on selection
  const filteredLogs = selectedUserId === 'ALL' 
    ? logs 
    : logs.filter(l => l.userId === selectedUserId);

  // --- CHART DATA GENERATION ---

  // Aggregate data by day (Time Series)
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

  // Aggregate data by User (Comparison)
  const userStats = users.map(user => {
    const userLogs = logs.filter(l => l.userId === user.id);
    const stats = calculateShiftStats(userLogs);
    return {
      name: user.name,
      totalPackages: stats.count,
      avgDurationMins: parseFloat((stats.avgDuration / 1000 / 60).toFixed(2)),
      rawAvgDuration: stats.avgDuration
    };
  }).sort((a, b) => b.totalPackages - a.totalPackages); // Default sort by volume

  // --- KEY METRICS CALCULATION ---

  const totalPackages = filteredLogs.length;
  const completedLogs = filteredLogs.filter(l => l.endTime !== null);
  const globalAvgMs = completedLogs.length > 0 
    ? completedLogs.reduce((acc, l) => acc + ((l.endTime || 0) - l.startTime), 0) / completedLogs.length 
    : 0;
  const distinctDays = Object.keys(logsByDate).length;

  return (
    <div className="space-y-8">
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
        <Users className="w-5 h-5 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Filter Stats:</span>
        <select 
          value={selectedUserId} 
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="ALL">All Users</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total Packages" 
          value={totalPackages.toLocaleString()} 
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
          icon={<Calendar className="w-6 h-6" />}
          color="purple"
        />
        <StatCard 
          label="Efficiency Rate" 
          value={`${timeSeriesData.length > 0 ? (totalPackages / distinctDays).toFixed(0) : 0} pkg`} 
          subValue="Daily Average"
          icon={<TrendingUp className="w-6 h-6" />}
          color="orange"
        />
      </div>

      {/* LEADERBOARD (Only show if ALL users selected) */}
      {selectedUserId === 'ALL' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="flex items-center gap-2 mb-4">
               <Award className="w-5 h-5 text-yellow-500" />
               <h3 className="text-lg font-bold text-slate-800">Top Packers (Volume)</h3>
             </div>
             <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={userStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                   <Tooltip cursor={{fill: '#f1f5f9'}} />
                   <Bar dataKey="totalPackages" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="Packages" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="flex items-center gap-2 mb-4">
               <Clock className="w-5 h-5 text-green-500" />
               <h3 className="text-lg font-bold text-slate-800">Fastest Packers (Avg Time)</h3>
             </div>
             <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart 
                    data={[...userStats].sort((a,b) => (a.rawAvgDuration || 99999999) - (b.rawAvgDuration || 99999999)).filter(u => u.totalPackages > 0)} 
                    layout="vertical" 
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                 >
                   <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                   <Tooltip cursor={{fill: '#f1f5f9'}} />
                   <Bar dataKey="avgDurationMinutes" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} name="Avg Mins" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>
      )}

      {/* Time Series Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Daily Volume Trend</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="displayDate" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  cursor={{fill: '#f1f5f9'}}
                />
                <Bar name="Packages Packed" dataKey="packages" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Speed Trend (Min/Pkg)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="displayDate" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Line 
                  type="monotone" 
                  name="Avg Duration (min)" 
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