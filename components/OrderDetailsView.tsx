
import React, { useState, useEffect, useRef } from 'react';
import { BasicOrder, fetchOrders, syncOrders } from '../shipstationApi';
import { ShoppingBag, RefreshCw, ChevronLeft, ChevronRight, Mail, ExternalLink, CloudDownload, AlertCircle, Search } from 'lucide-react';

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
  
  // Search State
  const [filterText, setFilterText] = useState('');

  // Column Resizing State
  const [colWidths, setColWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('packtrack_order_cols');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load saved column widths", e);
    }
    return {
      order: 150,
      date: 120,
      customer: 250,
      items: 300,
      tracking: 180
    };
  });

  // Persist column widths when they change
  useEffect(() => {
    localStorage.setItem('packtrack_order_cols', JSON.stringify(colWidths));
  }, [colWidths]);

  const resizeRef = useRef<{ col: keyof typeof colWidths, startX: number, startWidth: number } | null>(null);

  const handleResizeStart = (e: React.MouseEvent, col: keyof typeof colWidths) => {
    resizeRef.current = { col, startX: e.clientX, startWidth: colWidths[col] };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizeRef.current) return;
    const diff = e.clientX - resizeRef.current.startX;
    setColWidths(prev => ({
      ...prev,
      [resizeRef.current!.col]: Math.max(80, resizeRef.current!.startWidth + diff)
    }));
  };

  const handleMouseUp = () => {
    resizeRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

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

  // Client-Side Filter
  const filteredOrders = orders.filter(o => {
    const s = filterText.toLowerCase();
    return (
      (o.orderNumber || '').toLowerCase().includes(s) ||
      (o.customerName || '').toLowerCase().includes(s) ||
      (o.customerEmail || '').toLowerCase().includes(s) ||
      (o.items || '').toLowerCase().includes(s) ||
      (o.trackingNumber || '').toLowerCase().includes(s)
    );
  });

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

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-4">
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
      
      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input 
            type="text"
            className="block w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Search Order #, Customer, Items or Tracking..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <div className="min-w-full inline-block align-middle">
          {/* Custom Resizable Header */}
          <div className="flex border-b border-slate-200 bg-slate-50">
             {[
               { key: 'order', label: 'Order #' },
               { key: 'date', label: 'Date' },
               { key: 'customer', label: 'Customer' },
               { key: 'items', label: 'Items' },
               { key: 'tracking', label: 'Tracking' }
             ].map(col => (
               <div
                 key={col.key}
                 className="relative px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase flex-shrink-0 select-none hover:bg-slate-100"
                 style={{ width: colWidths[col.key as keyof typeof colWidths] }}
               >
                 {col.label}
                 <div 
                   className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-10"
                   onMouseDown={(e) => handleResizeStart(e, col.key as keyof typeof colWidths)}
                 />
               </div>
             ))}
          </div>

          <div className="divide-y divide-slate-200">
            {loading && orders.length === 0 ? (
               <div className="p-12 text-center text-slate-400">Loading Database...</div>
            ) : filteredOrders.length === 0 ? (
               <div className="p-12 text-center text-slate-400">No matching orders found.</div>
            ) : (
              filteredOrders.map((o, i) => (
                <div key={`${o.orderId}-${i}`} className="flex hover:bg-slate-50 transition-colors items-center">
                  <div className="px-6 py-4 text-sm font-bold text-slate-800 flex-shrink-0 truncate" style={{ width: colWidths.order }}>
                    {o.orderNumber}
                  </div>
                  <div className="px-6 py-4 text-sm text-slate-600 flex-shrink-0 truncate" style={{ width: colWidths.date }}>
                    {o.shipDate}
                  </div>
                  <div className="px-6 py-4 flex-shrink-0 truncate" style={{ width: colWidths.customer }}>
                     <div className="text-sm font-medium text-slate-800 truncate" title={o.customerName}>{o.customerName}</div>
                     <div className="text-xs text-slate-400 flex items-center gap-1 truncate" title={o.customerEmail}><Mail className="w-3 h-3"/> {o.customerEmail}</div>
                  </div>
                  <div className="px-6 py-4 text-sm text-slate-600 flex-shrink-0 truncate" title={o.items} style={{ width: colWidths.items }}>
                    {o.items}
                  </div>
                  <div className="px-6 py-4 text-sm font-mono text-slate-600 flex-shrink-0 truncate" style={{ width: colWidths.tracking }}>
                    {o.trackingNumber !== 'No Tracking' ? (
                       <a href={`https://www.google.com/search?q=${o.trackingNumber}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                         {o.trackingNumber} <ExternalLink className="w-3 h-3" />
                       </a>
                    ) : <span className="text-slate-400">No Tracking</span>}
                  </div>
                </div>
              ))
            )}
          </div>
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
