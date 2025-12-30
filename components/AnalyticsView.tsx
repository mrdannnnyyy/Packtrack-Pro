
import React, { useState, useMemo, useEffect } from 'react';
import { PackageLog, User, CostSettings, BoxType } from '../types';
import { formatDate, calculateShiftStats, formatDuration, getLocalDateStr } from '../utils';
import { StatCard } from './StatCard';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { 
  TrendingUp, Package, Clock, Calendar, Users, 
  DollarSign, Calculator, Info, Wallet, Filter, 
  PieChart as PieIcon, ArrowRight, Activity
} from 'lucide-react';

const BACKEND_URL = "https://packtrack-ups-backend-214733779716.us-west1.run.app";

interface AnalyticsViewProps {
  logs: PackageLog[];
  users: User[];
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const PIE_COLORS = ['#3b82f6', '#10b981'];

type PresetType = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ logs, users }) => {
  // --- STATE ---
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');
  const [activePreset, setActivePreset] = useState<PresetType>('MONTH');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => getLocalDateStr());
  
  const [costSettings, setCostSettings] = useState<CostSettings | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string>('');

  // --- FETCH COST SETTINGS ---
  useEffect(() => {
    const fetchCosts = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/settings/costs`);
        if (response.ok) {
          const data: CostSettings = await response.json();
          setCostSettings(data);
          if (data.boxes && data.boxes.length > 0) {
            setSelectedBoxId(data.boxes[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to fetch cost settings", e);
      }
    };
    fetchCosts();
  }, []);

  // --- PRESET LOGIC ---
  const applyPreset = (preset: Exclude<PresetType, 'CUSTOM'>) => {
    const end = getLocalDateStr();
    let start = '';
    
    if (preset === 'TODAY') {
      start = end;
    } else if (preset === 'WEEK') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
    } else if (preset === 'MONTH') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = d.toISOString().split('T')[0];
    } else if (preset === 'ALL') {
      start = '2024-01-01'; // Historical start
    }
    
    setStartDate(start);
    setEndDate(end);
    setActivePreset(preset);
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') setStartDate(value);
    else setEndDate(value);
    setActivePreset('CUSTOM');
  };

  // --- FILTERING LOGIC ---
  const filteredLogs = useMemo(() => {
    // FIX: Parse strings as local time to avoid UTC off-by-one errors
    const parseLocal = (dateStr: string, endOfDay: boolean) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      if (endOfDay) {
        d.setHours(23, 59, 59, 999);
      } else {
        d.setHours(0, 0, 0, 0);
      }
      return d;
    };

    const start = parseLocal(startDate, false);
    const end = parseLocal(endDate, true);

    return (logs || []).filter(log => {
      const logDate = new Date(log.startTime);
      const matchesUser = selectedUserId === 'ALL' || log.userId === selectedUserId;
      const matchesDate = logDate >= start && logDate <= end;
      return matchesUser && matchesDate;
    });
  }, [logs, startDate, endDate, selectedUserId]);

  const selectedBox = useMemo(() => 
    costSettings?.boxes.find(b => b.id === selectedBoxId), 
    [costSettings, selectedBoxId]
  );

  // --- AGGREGATION & DATA PREP ---
  const { timeSeriesData, totalLaborCost, totalPackagingCost, totalVolume } = useMemo(() => {
    const logsByDate: Record<string, PackageLog[]> = {};
    filteredLogs.forEach(log => {
      if (!logsByDate[log.dateStr]) logsByDate[log.dateStr] = [];
      logsByDate[log.dateStr].push(log);
    });

    let cumLabor = 0;
    let cumPackaging = 0;
    let cumVolume = 0;

    const hourlyRate = costSettings?.hourlyRate || 0;
    const materialCost = costSettings?.materialCost || 0;
    const boxCost = selectedBox?.cost || 0;
    const packagingCostPerUnit = boxCost + materialCost;

    const series = Object.keys(logsByDate).sort().map(dateStr => {
      const dayLogs = logsByDate[dateStr];
      const stats = calculateShiftStats(dayLogs);
      
      const avgMins = stats.avgDuration / 1000 / 60;
      const laborCostPerUnit = (avgMins / 60) * hourlyRate;
      
      const dayLaborTotal = laborCostPerUnit * stats.count;
      const dayPackagingTotal = packagingCostPerUnit * stats.count;

      cumLabor += dayLaborTotal;
      cumPackaging += dayPackagingTotal;
      cumVolume += stats.count;

      // FIX: Ensure display labels are forced to local time interpretation
      const [year, month, day] = dateStr.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      const displayLabel = localDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        weekday: 'short' 
      });

      return {
        date: dateStr,
        displayDate: displayLabel,
        labor: parseFloat(dayLaborTotal.toFixed(2)),
        packaging: parseFloat(dayPackagingTotal.toFixed(2)),
        avgDurationMins: parseFloat(avgMins.toFixed(2)),
        volume: stats.count
      };
    });

    return { 
      timeSeriesData: series, 
      totalLaborCost: cumLabor, 
      totalPackagingCost: cumPackaging, 
      totalVolume: cumVolume 
    };
  }, [filteredLogs, costSettings, selectedBox]);

  // --- KPI CALCS ---
  const avgLaborPerUnit = totalVolume > 0 ? totalLaborCost / totalVolume : 0;
  const avgMaterialPerUnit = totalVolume > 0 ? totalPackagingCost / totalVolume : 0;
  const totalFulfillmentPerUnit = avgLaborPerUnit + avgMaterialPerUnit;

  const pieData = [
    { name: 'Labor', value: totalLaborCost },
    { name: 'Packaging', value: totalPackagingCost }
  ];

  // Packer Performance Table Data
  const packerData = users.map(user => {
    const userLogs = filteredLogs.filter(l => l.userId === user.id);
    const stats = calculateShiftStats(userLogs);
    const avgMins = stats.avgDuration / 1000 / 60;
    const laborCostPerPkg = costSettings ? (avgMins / 60) * costSettings.hourlyRate : 0;
    
    return {
      id: user.id,
      name: user.name,
      totalPackages: stats.count,
      avgMins: parseFloat(avgMins.toFixed(2)),
      laborCost: laborCostPerPkg
    };
  }).sort((a, b) => b.totalPackages - a.totalPackages);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* ROW 1: UNIFIED TOOLBAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        {/* Presets */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activePreset === preset 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {preset.charAt(0) + preset.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Custom Range */}
        <div className="flex flex-1 min-w-[320px] items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">From</span>
            <input 
              type="date" 
              className="px-2 py-1 border border-slate-300 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={startDate}
              onChange={(e) => handleDateChange('start', e.target.value)}
            />
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">To</span>
            <input 
              type="date" 
              className="px-2 py-1 border border-slate-300 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={endDate}
              onChange={(e) => handleDateChange('end', e.target.value)}
            />
          </div>
        </div>

        {/* Employee Filter */}
        <div className="min-w-[180px]">
          <select 
            value={selectedUserId} 
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">All Employees</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ROW 2: KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Avg Labor / Unit" 
          value={currencyFormatter.format(avgLaborPerUnit)} 
          subValue={`Based on ${totalVolume} units`} 
          icon={<Clock className="w-6 h-6" />} 
          color="blue" 
        />
        <StatCard 
          label="Avg Material / Unit" 
          value={currencyFormatter.format(avgMaterialPerUnit)} 
          subValue={`Box + Misc Material`} 
          icon={<Package className="w-6 h-6" />} 
          color="green" 
        />
        <StatCard 
          label="Total Fulfillment / Unit" 
          value={currencyFormatter.format(totalFulfillmentPerUnit)} 
          subValue="Internal Operational Cost" 
          icon={<Wallet className="w-6 h-6" />} 
          color="blue" 
        />
      </div>

      {/* ROW 3: COST CHARTS (SIDE-BY-SIDE BARS + PIE) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Cost Side-by-Side */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-slate-800">Daily Fulfillment Comparison</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Labor</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Packaging</span>
              </div>
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="displayDate" 
                  tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis 
                  tick={{fontSize: 10, fill: '#94a3b8'}} 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: number) => [currencyFormatter.format(value), '']}
                />
                <Bar dataKey="labor" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="packaging" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Simulator & Distribution */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-slate-900 text-white p-5 rounded-xl shadow-lg border border-slate-800">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm">Scenario Simulator</h3>
            </div>
            <select 
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={selectedBoxId}
              onChange={(e) => setSelectedBoxId(e.target.value)}
            >
              <option value="">No Box Selected</option>
              {costSettings?.boxes.map(box => (
                <option key={box.id} value={box.id}>{box.name} ({currencyFormatter.format(box.cost)})</option>
              ))}
            </select>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-slate-800">Cost Distribution</h3>
            </div>
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => currencyFormatter.format(value)} />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 4: SPEED TREND ANALYSIS (LINE CHART) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
         <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
               <Activity className="w-6 h-6 text-red-500" />
               <h3 className="text-lg font-bold text-slate-800">Speed Trend Analysis</h3>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-3 h-0.5 bg-red-500"></div>
               <span className="text-[10px] font-bold text-slate-500 uppercase">Avg Pack Time (Minutes)</span>
            </div>
         </div>
         
         <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    tick={{fontSize: 10, fill: '#ef4444'}} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(val) => `${val}m`}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgDurationMins" 
                    stroke="#ef4444" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#ef4444' }} 
                    activeDot={{ r: 6 }} 
                  />
               </LineChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* ROW 5: PERFORMANCE TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Packer Financial Performance
          </h3>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {filteredLogs.length} Samples in Range
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Packer</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Time</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Labor / Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {packerData.filter(p => p.totalPackages > 0).map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold text-slate-700">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-mono font-medium text-slate-600">{p.totalPackages}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${
                      p.avgMins <= 5 ? 'bg-green-50 text-green-700 border-green-100' : 
                      p.avgMins <= 10 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 
                      'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      {p.avgMins}m
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className="text-sm font-bold text-slate-800 font-mono">
                      {currencyFormatter.format(p.laborCost)}
                    </span>
                  </td>
                </tr>
              ))}
              {packerData.every(p => p.totalPackages === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                    No data found for the selected range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER NOTE */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 mt-0.5" />
        <p className="text-xs leading-relaxed text-blue-700">
          <strong>Operational Note:</strong> This view provides internal fulfillment costs. Labor is calculated as (Avg Pack Time / 60) × Hourly Rate. 
          Packaging is Selected Box + Material Surcharge. Change the Box scenario to see its impact on historical data.
        </p>
      </div>

    </div>
  );
};
