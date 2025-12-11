
import React, { useState, useEffect } from 'react';
import { BasicOrder, fetchOrders, syncOrders } from '../shipstationApi';
import { ShoppingBag, RefreshCw, ChevronLeft, ChevronRight, Mail, ExternalLink, CloudDownload, AlertCircle } from 'lucide-react';

export const OrderDetailsView: React.FC = () => {
  const [orders, setOrders] = useState<BasicOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastSync, setLastSync] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOrders(page, pageSize);
      setOrders(res.data || []);
      setTotalPages(res.totalPages || 1);
      setTotal(res.total || 0);
      setLastSync(res.lastSync || 0);
    } catch (e: any) {
      console.error(e);
      setError("Failed to connect to backend service.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncOrders();
      await load(); 
    } catch (e) {
      alert("Sync failed. Please check backend logs.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { load(); }, [page, pageSize]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <p className="font-bold">Connection Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <ShoppingBag className="w-8 h-8 text-blue-600" /> Order Database
           </h1>
           <p className="text-slate-500">
             Local Cache. Last Sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never'}
           </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleSync} 
            disabled={syncing}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-900 disabled:opacity-50 transition-colors"
          >
            <CloudDownload className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} /> 
            {syncing ? 'Syncing...' : 'Sync ShipStation'}
          </button>
          <button onClick={load} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Order #</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Items</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Tracking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && (orders || []).length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">Loading Database...</td></tr>
              ) : (orders || []).map((o, i) => (
                <tr key={`${o.orderId}-${i}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{o.orderNumber}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{o.shipDate}</td>
                  <td className="px-6 py-4">
                     <div className="text-sm font-medium text-slate-800">{o.customerName}</div>
                     <div className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3"/> {o.customerEmail}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={o.items}>{o.items}</td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-600">
                    {o.trackingNumber !== 'No Tracking' ? (
                       <a href={`https://www.google.com/search?q=${o.trackingNumber}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                         {o.trackingNumber} <ExternalLink className="w-3 h-3" />
                       </a>
                    ) : <span className="text-slate-400">No Tracking</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center">
            <span className="text-sm text-slate-500">Page {page} of {totalPages} ({total} orders)</span>
            <div className="flex gap-2">
                <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="p-2 border rounded hover:bg-white disabled:opacity-50"><ChevronLeft className="w-4 h-4"/></button>
                <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="p-2 border rounded hover:bg-white disabled:opacity-50"><ChevronRight className="w-4 h-4"/></button>
            </div>
        </div>
      </div>
    </div>
  );
};
