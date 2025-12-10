
import React, { useState, useEffect } from 'react';
import { BasicOrder, fetchBasicOrders } from '../shipstationApi';
import { ShoppingBag, RefreshCw, ChevronLeft, ChevronRight, Mail, ExternalLink, CloudOff } from 'lucide-react';

export const OrderDetailsView: React.FC = () => {
  const [orders, setOrders] = useState<BasicOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchBasicOrders(page, pageSize);
      setOrders(res.data);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (e: any) {
      console.error(e);
      setError("Failed to fetch orders from Google Cloud backend. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, pageSize]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <ShoppingBag className="w-8 h-8 text-blue-600" /> Order Details
           </h1>
           <p className="text-slate-500">Live feed from ShipStation (Orders Only)</p>
        </div>
        <button onClick={load} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <CloudOff className="w-6 h-6 text-red-600 mt-1" />
          <div>
              <h3 className="text-red-800 font-bold">Connection Error</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Order #</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Items</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Tracking #</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Carrier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading Orders...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No orders found.</td></tr>
              ) : orders.map((o) => (
                <tr key={o.orderId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{o.orderNumber}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{o.shipDate}</td>
                  <td className="px-6 py-4">
                     <div className="text-sm font-medium text-slate-800">{o.customerName}</div>
                     <div className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3"/> {o.customerEmail}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={o.items}>{o.items}</td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-600">
                    {o.trackingNumber !== 'No Tracking' ? (
                       <a 
                         href={`https://www.google.com/search?q=${o.trackingNumber}`} 
                         target="_blank" 
                         rel="noreferrer"
                         className="flex items-center gap-1 text-blue-600 hover:underline"
                       >
                         {o.trackingNumber}
                         <ExternalLink className="w-3 h-3" />
                       </a>
                    ) : (
                       <span className="text-slate-400">No Tracking</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 uppercase">{o.carrierCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Bar */}
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
