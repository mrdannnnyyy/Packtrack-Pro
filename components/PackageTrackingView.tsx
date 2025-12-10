
import React, { useState, useEffect } from 'react';
import { TrackingRow, fetchTrackingList, refreshSingleTracking } from '../upsApi';
import { Truck, RefreshCw, ExternalLink, ChevronLeft, ChevronRight, Search, PackageCheck, AlertCircle, PackageOpen, Calendar, CloudOff } from 'lucide-react';

export const PackageTrackingView: React.FC = () => {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'DELIVERED' | 'EXCEPTION'>('ACTIVE');
  const [filterText, setFilterText] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTrackingList(page, pageSize);
      setRows(res.data);
      setTotalPages(res.totalPages);
      setTotalItems(res.total);
    } catch (e: any) {
      console.error(e);
      setError("Failed to connect to Google Cloud backend. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, pageSize]);

  const refreshRow = async (tn: string) => {
    if(!tn || tn === 'No Tracking') return;
    setRefreshingId(tn);
    try {
      const update = await refreshSingleTracking(tn);
      setRows(prev => prev.map(r => r.trackingNumber === tn ? { ...r, ...update } : r));
    } finally {
      setRefreshingId(null);
    }
  };

  // --- CLIENT SIDE FILTERING ---
  const filteredRows = rows.filter(row => {
    const statusLower = (row.upsStatus || '').toLowerCase();
    const isDelivered = row.delivered;
    const isException = statusLower.includes('exception') || statusLower.includes('fail') || statusLower.includes('error');
    
    // Tab Logic
    if (activeTab === 'ACTIVE' && isDelivered) return false;
    if (activeTab === 'DELIVERED' && !isDelivered) return false;
    if (activeTab === 'EXCEPTION' && !isException) return false;

    // Search Logic
    if (filterText) {
      const search = filterText.toLowerCase();
      const match = 
        row.trackingNumber.toLowerCase().includes(search) ||
        statusLower.includes(search);
      if (!match) return false;
    }
    return true;
  });

  const getStatusColor = (s: string) => {
    const sl = (s||'').toLowerCase();
    if (sl.includes('delivered')) return 'bg-green-100 text-green-700 border-green-200';
    if (sl.includes('transit') || sl.includes('out') || sl.includes('shipped')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (sl.includes('exception') || sl.includes('fail') || sl.includes('error')) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div>
             <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <Truck className="w-8 h-8 text-blue-600" /> Package Tracking
             </h1>
             <p className="text-slate-500">Live status for packages scanned in Tracker (Logs).</p>
          </div>
          <button onClick={load} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Update Statuses
          </button>
        </div>

        {error && (
             <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <CloudOff className="w-6 h-6 text-red-600 mt-1" />
                <div>
                    <h3 className="text-red-800 font-bold">Connection Error</h3>
                    <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
             </div>
        )}

        {/* FILTERS TOOLBAR */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
           {/* TABS */}
           <div className="bg-slate-100 p-1 rounded-lg flex gap-1 overflow-x-auto w-full lg:w-auto">
              <button onClick={() => setActiveTab('ACTIVE')} className={`flex-1 lg:flex-none px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab==='ACTIVE'?'bg-white text-blue-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                <Truck className="w-4 h-4" /> Active
              </button>
              <button onClick={() => setActiveTab('DELIVERED')} className={`flex-1 lg:flex-none px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab==='DELIVERED'?'bg-white text-green-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                <PackageCheck className="w-4 h-4" /> Delivered
              </button>
              <button onClick={() => setActiveTab('EXCEPTION')} className={`flex-1 lg:flex-none px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab==='EXCEPTION'?'bg-white text-red-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                <AlertCircle className="w-4 h-4" /> Issues
              </button>
              <div className="w-px bg-slate-300 mx-1 my-1"></div>
              <button onClick={() => setActiveTab('ALL')} className={`flex-1 lg:flex-none px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab==='ALL'?'bg-white text-slate-800 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                <PackageOpen className="w-4 h-4" /> All
              </button>
           </div>
           
           {/* SEARCH */}
           <div className="relative w-full lg:w-72">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <Search className="h-4 w-4 text-slate-400" />
             </div>
             <input
               type="text"
               className="block w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
               placeholder="Search tracking #..."
               value={filterText}
               onChange={(e) => setFilterText(e.target.value)}
             />
           </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Tracking #</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">ETA</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading Tracking Info...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No matching packages found on this page.</td></tr>
              ) : (
                filteredRows.map((r, idx) => (
                  <tr key={`${r.trackingNumber}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600 flex items-center gap-2 whitespace-nowrap">
                       <Calendar className="w-3 h-3 text-slate-400" />
                       {r.dateStr || '--'}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-800 font-bold whitespace-nowrap">{r.trackingNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${getStatusColor(r.upsStatus)}`}>
                         {r.upsStatus}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[200px]" title={r.location}>{r.location || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium whitespace-nowrap">{r.expectedDelivery}</td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                       <button 
                         onClick={() => refreshRow(r.trackingNumber)} 
                         disabled={refreshingId === r.trackingNumber}
                         className="p-1.5 hover:bg-blue-50 text-blue-600 rounded disabled:opacity-30 transition-colors"
                         title="Refresh from UPS"
                       >
                         <RefreshCw className={`w-4 h-4 ${refreshingId === r.trackingNumber ? 'animate-spin' : ''}`} />
                       </button>
                       {r.trackingUrl && (
                         <a href={r.trackingUrl} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded transition-colors" title="Open UPS Website">
                           <ExternalLink className="w-4 h-4"/>
                         </a>
                       )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* PAGINATION */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center">
            <span className="text-sm text-slate-500">Page {page} of {totalPages} ({totalItems} Scans)</span>
            <div className="flex gap-2">
                <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="p-2 border rounded hover:bg-white disabled:opacity-50"><ChevronLeft className="w-4 h-4"/></button>
                <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="p-2 border rounded hover:bg-white disabled:opacity-50"><ChevronRight className="w-4 h-4"/></button>
            </div>
        </div>
      </div>
    </div>
  );
};
