
import React, { useState, useEffect } from 'react';
import { TrackingRow, fetchTrackingList, refreshSingleTracking } from '../upsApi';
import { Truck, RefreshCw, ExternalLink, ChevronLeft, ChevronRight, CloudOff } from 'lucide-react';

export const PackageTrackingView: React.FC = () => {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetchTrackingList(page, pageSize);
      setRows(res.data || []);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      console.error(e);
      setError(true);
      setRows([]);
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

  const getStatusColor = (s: string) => {
    const sl = (s||'').toLowerCase();
    if (sl.includes('delivered')) return 'bg-green-100 text-green-700 border-green-200';
    if (sl.includes('transit') || sl.includes('out')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (sl.includes('exception') || sl.includes('fail')) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="space-y-6">
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-800">
          <CloudOff className="w-5 h-5 text-red-600" />
          <div>
            <p className="font-bold">Backend Error</p>
            <p className="text-sm">Unable to connect to service. Check internet or Cloud Run.</p>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Truck className="w-8 h-8 text-blue-600" /> Package Tracking
           </h1>
           <p className="text-slate-500">UPS Data is cached. Click refresh icon to fetch live status.</p>
        </div>
        <button onClick={load} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Reload Cache
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Order #</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Tracking #</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Cached Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">ETA</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && (rows || []).length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading Cache...</td></tr>
              ) : (rows || []).map((r, i) => (
                <tr key={`${r.orderNumber}-${i}`} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{r.orderNumber}</td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-600">{r.trackingNumber}</td>
                  <td className="px-6 py-4">
                     <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(r.upsStatus)}`}>
                       {r.upsStatus || 'Pending'}
                     </span>
                     <div className="text-[10px] text-slate-400 mt-1">
                       {r.lastUpdated ? new Date(r.lastUpdated).toLocaleTimeString() : 'Never'}
                     </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{r.location || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{r.expectedDelivery}</td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                     <button 
                       onClick={() => refreshRow(r.trackingNumber)} 
                       disabled={refreshingId === r.trackingNumber || r.trackingNumber === 'No Tracking'}
                       className="p-1.5 hover:bg-blue-50 text-blue-600 rounded disabled:opacity-30 transition-colors"
                       title="Fetch Live from UPS"
                     >
                       <RefreshCw className={`w-4 h-4 ${refreshingId === r.trackingNumber ? 'animate-spin' : ''}`} />
                     </button>
                     {r.trackingUrl && (
                       <a href={r.trackingUrl} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded transition-colors">
                         <ExternalLink className="w-4 h-4"/>
                       </a>
                     )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center">
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
                <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="p-2 border rounded hover:bg-white disabled:opacity-50"><ChevronLeft className="w-4 h-4"/></button>
                <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="p-2 border rounded hover:bg-white disabled:opacity-50"><ChevronRight className="w-4 h-4"/></button>
            </div>
        </div>
      </div>
    </div>
  );
};
