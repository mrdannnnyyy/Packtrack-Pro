
import React, { useState } from 'react';
import { PackageLog, User } from '../types';
import { formatTime, formatDuration, formatDate, getDurationColor } from '../utils';
import { deleteLogEntry } from '../firebase';
import { UserCircle, Search, X, Download, Calendar, Filter, Trash2, ChevronDown, ChevronRight, ShoppingBag } from 'lucide-react';

interface HistoryViewProps {
  logs: PackageLog[];
  users: User[];
  requestConfirm: (message: string, onConfirm: () => void) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ logs, users, requestConfirm }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(''); // Empty string = All dates
  
  // State for collapsible dates. Using a set for efficient lookup.
  // By default (empty set), all are collapsed. 
  // If we want "Today" expanded by default, we'd need to init with today's date string.
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Toggle Collapse
  const toggleDate = (dateStr: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(dateStr)) {
      newExpanded.delete(dateStr);
    } else {
      newExpanded.add(dateStr);
    }
    setExpandedDates(newExpanded);
  };

  // Filter logs based on ALL criteria
  const filteredLogs = logs.filter(log => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      log.trackingId.toLowerCase().includes(searchLower) ||
      (log.matchedOrder?.orderNumber || '').toLowerCase().includes(searchLower) ||
      (log.matchedOrder?.customerName || '').toLowerCase().includes(searchLower);
      
    const matchesUser = selectedUserId === 'ALL' || log.userId === selectedUserId;
    const matchesDate = !selectedDate || log.dateStr === selectedDate;
    return matchesSearch && matchesUser && matchesDate;
  });

  // Group logs by date
  const logsByDate = filteredLogs.reduce((acc, log) => {
    if (!acc[log.dateStr]) acc[log.dateStr] = [];
    acc[log.dateStr].push(log);
    return acc;
  }, {} as { [key: string]: PackageLog[] });

  const sortedDates = Object.keys(logsByDate).sort().reverse();
  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';

  const handleExportCSV = () => {
    const headers = ['Date', 'Time (Start)', 'Time (End)', 'User', 'Tracking ID', 'Order #', 'Customer', 'Duration', 'Status'];
    
    const rows = filteredLogs.map(log => {
      const durationMs = log.endTime ? log.endTime - log.startTime : 0;
      const status = log.endTime ? 'Completed' : 'Active';

      return [
        log.dateStr,
        new Date(log.startTime).toLocaleTimeString(),
        log.endTime ? new Date(log.endTime).toLocaleTimeString() : '',
        getUserName(log.userId),
        `"${log.trackingId}"`,
        `"${log.matchedOrder?.orderNumber || ''}"`,
        `"${log.matchedOrder?.customerName || ''}"`,
        formatDuration(durationMs),
        status
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `packtrack_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteLog = (e: React.MouseEvent, logId: string) => {
    e.stopPropagation();
    requestConfirm("Are you sure you want to delete this log entry? This cannot be undone.", () => {
      deleteLogEntry(logId);
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedUserId('ALL');
    setSelectedDate('');
  };

  const hasFilters = searchQuery || selectedUserId !== 'ALL' || selectedDate;
  
  // Logic: If searching, force expand everything (ignore expandedDates state)
  const isSearchActive = searchQuery.length > 0;

  return (
    <div className="space-y-6">
      
      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
            placeholder="Search by Tracking ID, Order # or Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative min-w-[180px]">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="block w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
            >
              <option value="ALL">All Employees</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[160px]">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-600"
            />
          </div>

          {hasFilters && (
             <button
               onClick={clearFilters}
               className="flex items-center justify-center px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
             >
               <X className="w-4 h-4 mr-1" /> Reset
             </button>
          )}

          <div className="w-px bg-slate-200 mx-1 hidden sm:block"></div>

          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden lg:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Grouped Results List */}
      <div className="space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200 border-dashed">
            <Filter className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-slate-500 font-medium">No results found</p>
          </div>
        ) : (
          sortedDates.map(dateStr => {
            const isExpanded = isSearchActive || expandedDates.has(dateStr);
            const count = logsByDate[dateStr].length;

            return (
              <div key={dateStr} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header / Toggle */}
                <button 
                  onClick={() => toggleDate(dateStr)}
                  disabled={isSearchActive}
                  className={`w-full px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center transition-colors hover:bg-slate-100 focus:outline-none text-left
                    ${isSearchActive ? 'cursor-default' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-1.5 rounded-md border border-slate-200 shadow-sm text-slate-500">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{formatDate(dateStr)}</h3>
                      <p className="text-xs text-slate-500">{count} packages processed</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                     <Calendar className="w-5 h-5 text-slate-300" />
                  </div>
                </button>
                
                {/* Expandable Content */}
                {isExpanded && (
                  <div className="overflow-x-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-white">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">User</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Details</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Time Span</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Duration</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {logsByDate[dateStr].sort((a,b) => b.startTime - a.startTime).map(log => {
                          const duration = log.endTime ? log.endTime - log.startTime : 0;
                          return (
                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">
                                 <div className="flex items-center gap-2">
                                   <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                     <UserCircle className="w-4 h-4" />
                                   </div>
                                   <span className="font-medium">{getUserName(log.userId)}</span>
                                 </div>
                              </td>
                              <td className="px-6 py-3 text-sm">
                                <div className="flex flex-col">
                                   <span className="font-bold font-mono text-slate-800">{log.trackingId}</span>
                                   {log.matchedOrder && (
                                     <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                        <span className="flex items-center gap-0.5"><ShoppingBag className="w-3 h-3"/> {log.matchedOrder.orderNumber}</span>
                                        <span className="text-slate-300">|</span>
                                        <span>{log.matchedOrder.customerName}</span>
                                     </div>
                                   )}
                                </div>
                              </td>
                              <td className="px-6 py-3 text-sm text-slate-500 font-mono whitespace-nowrap">
                                {formatTime(log.startTime)} <span className="text-slate-300 mx-1">→</span> {log.endTime ? formatTime(log.endTime) : '...'}
                              </td>
                              <td className="px-6 py-3 text-sm font-mono whitespace-nowrap">
                                {log.endTime ? (
                                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getDurationColor(duration)}`}>
                                    {formatDuration(duration)}
                                  </span>
                                ) : (
                                  <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs font-medium animate-pulse border border-blue-100">
                                    Active
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-sm text-right whitespace-nowrap">
                                <button 
                                  type="button"
                                  onClick={(e) => handleDeleteLog(e, log.id)}
                                  className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
