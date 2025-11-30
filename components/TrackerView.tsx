
import React, { useState, useEffect, useRef } from 'react';
import { PackageLog, User, Tab } from '../types';
import { formatDuration, formatDurationHours, formatTime, getDurationColor, calculateShiftStats, formatDate, getLocalDateStr } from '../utils';
import { addLogEntry, clockOutActiveLog, autoTimeoutLog, deleteLogEntry } from '../firebase';
import { Play, Square, Clock, Package, User as UserIcon, Lock, ArrowRight, Trash2, Loader2 } from 'lucide-react';

interface TrackerViewProps {
  logs: PackageLog[];
  currentUser: User | null;
  users: User[];
  setActiveTab: (tab: Tab) => void;
  requestConfirm: (message: string, onConfirm: () => void) => void;
  loginTimestamp?: number;
}

export const TrackerView: React.FC<TrackerViewProps> = ({ 
  logs, 
  currentUser, 
  users, 
  setActiveTab,
  requestConfirm,
  loginTimestamp
}) => {
  const [inputValue, setInputValue] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-clock out limit: 30 Minutes in milliseconds
  const AUTO_TIMEOUT_MS = 30 * 60 * 1000;

  // Update timer every second for UI and check for timeouts
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);

      // Check for any active logs that have exceeded the 30-minute limit
      logs.forEach(l => {
        if (l.endTime === null && (now - l.startTime > AUTO_TIMEOUT_MS)) {
           // Call database to update this specific log
           autoTimeoutLog(l.id, l.startTime, AUTO_TIMEOUT_MS);
        }
      });

    }, 1000);
    return () => clearInterval(timer);
  }, [logs, AUTO_TIMEOUT_MS]);

  // Use getLocalDateStr helper to ensure we use local machine time, not UTC
  const todayStr = getLocalDateStr();
  
  // 1. Filter logs to show only those with today's date string
  // 2. AND check if the startTime is actually > midnight today local time to catch edge cases
  const startOfToday = new Date();
  startOfToday.setHours(0,0,0,0);
  
  const todaysLogs = logs
    .filter(l => l.startTime >= startOfToday.getTime())
    .sort((a, b) => b.startTime - a.startTime);
  
  // Calculate stats ONLY for the current user to show their personal daily progress
  const currentUserTodaysLogs = currentUser 
    ? todaysLogs.filter(l => l.userId === currentUser.id)
    : [];
    
  const userStats = calculateShiftStats(currentUserTodaysLogs);
  
  // Custom Shift Start Logic:
  // If no logs, shift hasn't started.
  // If logs exist, shift start is the EARLIER of (Login Time) or (First Scan Time)
  let adjustedShiftDuration = 0;
  if (currentUserTodaysLogs.length > 0) {
      const firstScanTime = Math.min(...currentUserTodaysLogs.map(l => l.startTime));
      const effectiveStartTime = loginTimestamp ? Math.min(loginTimestamp, firstScanTime) : firstScanTime;
      const lastActivityTime = Math.max(...currentUserTodaysLogs.map(l => l.endTime || currentTime));
      adjustedShiftDuration = lastActivityTime - effectiveStartTime;
  }

  // Find ANY active log (could be another user if they forgot to clock out)
  const activeLog = todaysLogs.find(l => l.endTime === null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !currentUser) return;

    setIsSaving(true);
    
    try {
      const now = Date.now();
      await addLogEntry({
        trackingId: inputValue.trim(),
        userId: currentUser.id,
        startTime: now,
        endTime: null,
        dateStr: todayStr
      });

      setInputValue('');
    } catch (error) {
      console.error("Error creating log:", error);
      alert("Failed to create log. Please try again.");
    } finally {
      setIsSaving(false);
      // Keep focus on input
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleClockOutAll = () => {
    if (!activeLog) return;
    
    requestConfirm("Are you sure you want to clock out the active package?", () => {
      clockOutActiveLog(activeLog.id);
    });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    requestConfirm("Are you sure you want to delete this log? This cannot be undone.", () => {
      deleteLogEntry(id);
    });
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 space-y-6">
        <div className="bg-slate-100 p-6 rounded-full">
          <Lock className="w-16 h-16 text-slate-400" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-bold text-slate-800">Tracker Locked</h2>
          <p className="text-slate-500">
            A user must be selected before you can start tracking packages. Please go to Configuration to select or create a user.
          </p>
        </div>
        <button 
          onClick={() => setActiveTab(Tab.CONFIGURATION)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
        >
          Go to Configuration
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar: Input and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Area */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Scan or Enter Tracking ID
          </label>
          <form onSubmit={handleScan} className="flex gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Package className="h-5 w-5 text-slate-400" />
              </div>
              <input
                ref={inputRef}
                autoFocus
                type="text"
                disabled={isSaving}
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-lg disabled:bg-slate-50"
                placeholder="Scanner ready..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </div>
            
            <button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-150 ease-in-out flex items-center gap-2 min-w-[120px] justify-center"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Start</span>
                </>
              )}
            </button>
          </form>
          
          <div className="mt-4 flex items-center justify-between">
             <div className="text-sm text-slate-500">
                Current Time: <span className="font-mono text-slate-700 font-medium">{new Date(currentTime).toLocaleTimeString()}</span>
             </div>
             {activeLog && (
               <button 
                 onClick={handleClockOutAll}
                 type="button"
                 className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition"
               >
                 <Square className="w-4 h-4 fill-current" />
                 Clock Out Active
               </button>
             )}
          </div>
        </div>

        {/* Daily Stats Summary for CURRENT USER */}
        <div className="bg-slate-800 text-white p-6 rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <UserIcon className="w-24 h-24" />
          </div>
          <div>
            <h3 className="text-slate-300 text-sm font-medium uppercase tracking-wider mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              {currentUser.name}'s Shift
            </h3>
            <p className="text-3xl font-bold font-mono">{formatDurationHours(adjustedShiftDuration)}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-600 grid grid-cols-2 gap-4 relative z-10">
            <div>
              <p className="text-slate-400 text-xs">Packages</p>
              <p className="text-xl font-semibold">{userStats.count}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Avg Time</p>
              <p className="text-xl font-semibold">{formatDuration(userStats.avgDuration)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Package Banner */}
      {activeLog && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between animate-pulse">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 text-white p-3 rounded-full">
              <Clock className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-bold uppercase tracking-wide">
                Currently Packing ({getUserName(activeLog.userId)})
              </p>
              <p className="text-xl font-bold text-slate-800 break-all">{activeLog.trackingId}</p>
              <p className="text-sm text-slate-500">Started at {formatTime(activeLog.startTime)}</p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 text-center sm:text-right">
             <p className="text-3xl font-mono font-bold text-blue-700">
               {formatDuration(currentTime - activeLog.startTime)}
             </p>
          </div>
        </div>
      )}

      {/* Recent Log Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="font-semibold text-slate-800">Station Log (Today)</h2>
          <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded-full">{todaysLogs.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tracking ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Start Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">End Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Status / Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {todaysLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    No packages tracked today.
                  </td>
                </tr>
              ) : (
                todaysLogs.map((log) => {
                  const isComplete = log.endTime !== null;
                  const duration = isComplete ? (log.endTime! - log.startTime) : (currentTime - log.startTime);
                  const isMyLog = log.userId === currentUser.id;
                  
                  return (
                    <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${isMyLog ? 'bg-blue-50/30' : ''}`}>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${isMyLog ? 'bg-blue-500' : 'bg-slate-300'}`} />
                         {getUserName(log.userId)}
                       </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDate(log.dateStr)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {log.trackingId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">{formatTime(log.startTime)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                        {log.endTime ? formatTime(log.endTime) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                        <span className={`px-3 py-1.5 rounded-md text-base font-bold border ${getDurationColor(duration)}`}>
                          {formatDurationHours(duration) === '0m' ? formatDuration(duration) : formatDurationHours(duration)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm flex justify-end gap-2 items-center">
                         {isComplete ? (
                           <span className="text-slate-500 text-xs font-medium bg-slate-100 px-2 py-1 rounded mr-2">
                             Done
                           </span>
                         ) : (
                           <span className="text-blue-600 text-xs font-medium animate-pulse mr-2 flex items-center gap-1">
                             <Clock className="w-3 h-3" /> Tracking
                           </span>
                         )}
                         
                         {currentUser?.role === 'ADMIN' && (
                           <button 
                             type="button"
                             onClick={(e) => handleDelete(e, log.id)}
                             className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-full transition-colors z-10 relative cursor-pointer"
                             title="Delete Log"
                           >
                             <Trash2 className="w-4 h-4 pointer-events-none" />
                           </button>
                         )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
