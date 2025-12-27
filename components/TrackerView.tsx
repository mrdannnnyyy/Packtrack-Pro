
import React, { useState, useEffect, useRef } from 'react';
import { PackageLog, User, Tab } from '../types';
import { formatDuration, formatDurationHours, formatTime, getDurationColor, calculateShiftStats, getLocalDateStr } from '../utils';
import { addLogEntry, clockOutActiveLog, autoTimeoutLog, deleteLogEntry } from '../firebase';
import { fetchOrders } from '../shipstationApi'; 
import { Play, Square, Clock, Package, User as UserIcon, Lock, ArrowRight, Trash2, Loader2, CheckCircle2, ShoppingBag, UserCircle } from 'lucide-react';

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

  // Auto-timeout threshold set to 3 hours
  const AUTO_TIMEOUT_MS = 3 * 60 * 60 * 1000;

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      logs.forEach(l => {
        // If > 3 hours have passed, force close the log (backend sets duration to 15m)
        if (l.endTime === null && (now - l.startTime > AUTO_TIMEOUT_MS)) {
           autoTimeoutLog(l.id, l.startTime);
        }
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [logs, AUTO_TIMEOUT_MS]);

  const todayStr = getLocalDateStr();
  const startOfToday = new Date();
  startOfToday.setHours(0,0,0,0);
  
  const userLogs = logs
    .filter(l => 
      l.startTime >= startOfToday.getTime() && 
      currentUser && 
      l.userId === currentUser.id
    )
    .sort((a, b) => b.startTime - a.startTime);
  
  const userStats = calculateShiftStats(userLogs);
  
  let adjustedShiftDuration = 0;
  if (userLogs.length > 0) {
      const firstScanTime = Math.min(...userLogs.map(l => l.startTime));
      const effectiveStartTime = loginTimestamp ? Math.min(loginTimestamp, firstScanTime) : firstScanTime;
      const lastActivityTime = Math.max(...userLogs.map(l => l.endTime || currentTime));
      adjustedShiftDuration = lastActivityTime - effectiveStartTime;
  }

  const activeLog = userLogs.find(l => l.endTime === null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !currentUser) return;
    const trackingId = inputValue.trim();

    setIsSaving(true);
    
    try {
      let matchedOrderData = undefined;
      try {
        const recentOrders = await fetchOrders(1, 100);
        const match = recentOrders.data.find(o => 
          o.trackingNumber.toLowerCase() === trackingId.toLowerCase()
        );

        if (match) {
          matchedOrderData = {
            orderNumber: match.orderNumber,
            customerName: match.customerName,
            items: match.items
          };
        }
      } catch (err) {
        console.warn("Auto-population failed, proceeding with basic log", err);
      }

      const now = Date.now();
      await addLogEntry({
        trackingId: trackingId,
        userId: currentUser.id,
        startTime: now,
        endTime: null,
        dateStr: todayStr,
        matchedOrder: matchedOrderData || null 
      });

      setInputValue('');
    } catch (error: any) {
      console.error("Error creating log:", error);
      alert(`Failed to create log. Error: ${error.message || 'Unknown'}. Please check your database rules.`);
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 10);
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

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 space-y-6">
        <div className="bg-slate-100 p-6 rounded-full">
          <Lock className="w-16 h-16 text-slate-400" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-bold text-slate-800">Tracker Locked</h2>
          <p className="text-slate-500">
            A user must be selected before you can start tracking packages.
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        <div className="bg-slate-800 text-white p-6 rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <UserIcon className="w-24 h-24" />
          </div>
          <div>
            <h3 className="text-slate-300 text-sm font-medium uppercase tracking-wider mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              My Shift
            </h3>
            <p className="text-3xl font-bold font-mono">{formatDurationHours(adjustedShiftDuration)}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-600 grid grid-cols-2 gap-4 relative z-10">
            <div>
              <p className="text-slate-400 text-xs">My Packages</p>
              <p className="text-xl font-semibold">{userStats.count}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">My Avg Time</p>
              <p className="text-xl font-semibold">{formatDuration(userStats.avgDuration)}</p>
            </div>
          </div>
        </div>
      </div>

      {activeLog && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col items-start justify-between animate-pulse">
          <div className="w-full flex items-center justify-between mb-4">
             <div className="flex items-center gap-4">
                <div className="bg-blue-600 text-white p-3 rounded-full">
                  <Clock className="w-6 h-6 animate-spin-slow" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-bold uppercase tracking-wide flex items-center gap-2">
                    Currently Packing
                    {activeLog.matchedOrder && (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border border-green-200">
                        <CheckCircle2 className="w-3 h-3" /> Order Found
                      </span>
                    )}
                  </p>
                  <p className="text-xl font-bold text-slate-800 break-all">{activeLog.trackingId}</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-3xl font-mono font-bold text-blue-700">
                   {formatDuration(currentTime - activeLog.startTime)}
                </p>
             </div>
          </div>
              
          {activeLog.matchedOrder ? (
              <div className="w-full bg-white/60 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between text-sm text-slate-500 mb-1 border-b border-slate-200/50 pb-2">
                    <span className="font-semibold text-slate-600">Order #{activeLog.matchedOrder.orderNumber}</span>
                    <div className="flex items-center gap-2">
                        <UserCircle className="w-5 h-5 text-blue-600"/> 
                        <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{activeLog.matchedOrder.customerName}</span>
                    </div>
                </div>
                <div className="mt-2">
                   <span className="text-slate-900 font-extrabold text-2xl italic leading-tight block whitespace-normal">
                     {activeLog.matchedOrder.items}
                   </span>
                </div>
              </div>
          ) : (
              <p className="text-sm text-slate-500 ml-16">Started at {formatTime(activeLog.startTime)}</p>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="font-semibold text-slate-800">My Station Log (Today)</h2>
          <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded-full">{userLogs.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tracking ID / Order Info</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {userLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    No packages tracked by you today.
                  </td>
                </tr>
              ) : (
                userLogs.map((log) => {
                  const isComplete = log.endTime !== null;
                  const duration = isComplete ? (log.endTime! - log.startTime) : (currentTime - log.startTime);
                  
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono align-top">
                         {formatTime(log.startTime)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 align-top">
                        <div className="flex flex-col gap-1">
                           <span className="font-bold font-mono">{log.trackingId}</span>
                           {log.matchedOrder ? (
                             <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-200 flex items-center gap-1">
                                      <ShoppingBag className="w-3 h-3" /> {log.matchedOrder.orderNumber}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <UserCircle className="w-4 h-4 text-slate-400" /> 
                                      <span className="text-lg font-bold text-slate-800">{log.matchedOrder.customerName}</span>
                                    </span>
                                </div>
                                <span className="text-slate-800 font-bold italic block whitespace-normal text-base leading-snug">
                                  {log.matchedOrder.items}
                                </span>
                             </div>
                           ) : (
                             <span className="text-xs text-slate-400 mt-1 block">Manual Entry / No Order Match</span>
                           )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono align-top">
                         {isComplete ? (
                           <span className={`px-2.5 py-1 rounded-md text-sm font-bold border ${getDurationColor(duration)}`}>
                             {formatDuration(duration)}
                           </span>
                         ) : (
                           <span className="text-blue-600 text-sm font-bold animate-pulse flex items-center gap-1">
                             <Clock className="w-3 h-3" /> Tracking...
                           </span>
                         )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm align-top">
                         <button 
                           type="button"
                           onClick={(e) => handleDelete(e, log.id)}
                           className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"
                           title="Delete Log"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
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
