
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TrackingRow, refreshSingleTracking, toggleOrderFlag } from '../upsApi';
import { subscribeToAnnotations, saveAnnotation, Annotation } from '../firebase';
import { 
  Truck, RefreshCw, ExternalLink, ChevronLeft, ChevronRight, CloudOff, 
  Search, Flag, AlertTriangle, FileText, X, Save, BoxSelect, 
  PackageCheck, Package, StickyNote, CheckCircle, Clock, Settings2, 
  Check, Calendar, Hash, Info, UserCircle, DollarSign
} from 'lucide-react';

interface PackageTrackingViewProps {
  apiRows: any[]; 
  loading: boolean;
  error: boolean;
  page: number;
  setPage: (page: number | ((prev: number) => number)) => void;
  totalPages: number;
  onRefresh: () => void;
  activeStatusFilter: string | null;
  onStatusFilterChange: (status: string | null) => void;
}

// 1. Available Columns Config
const AVAILABLE_COLUMNS = [
  { id: 'order', label: 'Order #', icon: <Hash className="w-3.5 h-3.5" /> },
  { id: 'customer', label: 'Customer', icon: <UserCircle className="w-3.5 h-3.5" /> },
  { id: 'tracking', label: 'Tracking #', icon: <Truck className="w-3.5 h-3.5" /> },
  { id: 'status', label: 'Status', icon: <Info className="w-3.5 h-3.5" /> },
  { id: 'items', label: 'Items', icon: <Package className="w-3.5 h-3.5" /> },
  { id: 'shipDate', label: 'Ship Date', icon: <Calendar className="w-3.5 h-3.5" /> },
  { id: 'carrier', label: 'Carrier', icon: <Truck className="w-3.5 h-3.5" /> },
  { id: 'labelCost', label: 'Label Cost', icon: <DollarSign className="w-3.5 h-3.5" /> },
  { id: 'location', label: 'Last Location', icon: <MapPinIcon className="w-3.5 h-3.5" /> },
  { id: 'eta', label: 'Est. Delivery', icon: <Clock className="w-3.5 h-3.5" /> },
];

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export const PackageTrackingView: React.FC<PackageTrackingViewProps> = ({
  apiRows,
  loading,
  error,
  page,
  setPage,
  totalPages,
  onRefresh,
  activeStatusFilter,
  onStatusFilterChange
}) => {
  const [annotations, setAnnotations] = useState<Record<string, Annotation>>({});
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const columnSelectorRef = useRef<HTMLDivElement>(null);

  // 2. Persistence & Visible Columns State
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('packtrack_column_prefs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return ['order', 'customer', 'tracking', 'status', 'labelCost', 'location', 'eta'];
      }
    }
    return ['order', 'customer', 'tracking', 'status', 'labelCost', 'location', 'eta'];
  });

  useEffect(() => {
    localStorage.setItem('packtrack_column_prefs', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Annotation Modal State
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [editNote, setEditNote] = useState('');
  const [isFlagged, setIsFlagged] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // Column Resizing State
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('packtrack_col_widths');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { 
      order: 140, 
      customer: 200,
      tracking: 180, 
      status: 160, 
      location: 200, 
      eta: 140, 
      items: 220,
      shipDate: 120,
      carrier: 100,
      labelCost: 110,
      actions: 100 
    };
  });

  useEffect(() => {
    localStorage.setItem('packtrack_col_widths', JSON.stringify(colWidths));
  }, [colWidths]);

  const resizeRef = useRef<{ col: string, startX: number, startWidth: number } | null>(null);

  const handleResizeStart = (e: React.MouseEvent, col: string) => {
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

  // Subscribe to Annotations (Firebase - for notes)
  useEffect(() => {
    const unsubscribe = subscribeToAnnotations((data) => {
      setAnnotations(data);
    });
    return () => unsubscribe();
  }, []);

  // --- ROBUST STATUS FINDER ---
  const getRealStatus = (row: any) => {
    const candidate = row.upsStatus || row.status || row.orderStatus || row.status_code || "";
    if (typeof candidate !== 'string') return "";
    const clean = candidate.trim();
    if (clean.toLowerCase() === 'label_created') return 'Label Created';
    return clean;
  };

  const mergedRows = useMemo(() => {
    return apiRows.map(row => {
      const ann = annotations[row.trackingNumber];
      return {
        ...row,
        flagged: row.flagged !== undefined ? row.flagged : (ann ? ann.flagged : false),
        notes: ann ? ann.notes : ''
      };
    });
  }, [apiRows, annotations]);

  const refreshRow = async (tn: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!tn || tn === 'No Tracking') return;
    setRefreshingId(tn);
    try {
      const update = await refreshSingleTracking(tn);
      if (update.isError) {
        alert("Could not refresh status from UPS.");
        return;
      }
      onRefresh(); 
    } catch (err) {
      console.error("Failed to refresh row:", err);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleEditClick = (row: any) => {
    setEditingRow(row);
    setEditNote(row.notes || '');
    setIsFlagged(row.flagged || false);
  };

  const handleSaveAnnotation = async () => {
    if (!editingRow) return;
    setSavingNote(true);
    try {
      await toggleOrderFlag(editingRow.trackingNumber, editingRow.orderNumber, isFlagged);
      await saveAnnotation(editingRow.trackingNumber, isFlagged, editNote);
      setEditingRow(null);
      onRefresh(); 
    } catch (e) {
      alert("Error saving data. Please check connection.");
      console.error(e);
    } finally {
      setSavingNote(false);
    }
  };

  const getStatusColor = (s: string | null) => {
    if (!s) return 'bg-slate-100 text-slate-500 border-slate-200';
    const sl = s.toLowerCase();
    if (sl.includes('delivered')) return 'bg-green-100 text-green-700 border-green-200';
    if (sl.includes('transit') || sl.includes('way') || sl.includes('arrived') || sl.includes('pickup') || sl.includes('shipped') || sl.includes('out') || sl.includes('departed') || sl.includes('ready')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (sl.includes('exception') || sl.includes('issue') || sl.includes('fail') || sl.includes('error') || sl.includes('return') || sl.includes('void')) return 'bg-red-100 text-red-700 border-red-200';
    if (sl.includes('label') || sl.includes('pending') || sl.includes('created')) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-slate-50 text-slate-400 border-slate-200';
  };

  const getStatusIcon = (s: string | null) => {
    if (!s) return <Clock className="w-3.5 h-3.5 mr-1.5" />;
    const sl = s.toLowerCase();
    if (sl.includes('delivered')) return <CheckCircle className="w-3.5 h-3.5 mr-1.5" />;
    if (sl.includes('exception') || sl.includes('issue') || sl.includes('fail') || sl.includes('error')) return <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />;
    if (sl.includes('transit') || sl.includes('way') || sl.includes('arrived') || sl.includes('out')) return <Truck className="w-3.5 h-3.5 mr-1.5" />;
    return <Clock className="w-3.5 h-3.5 mr-1.5" />;
  };

  const filteredRows = mergedRows.filter(r => {
    const currentStatus = getRealStatus(r);
    const s = filterText.toLowerCase();
    return (r.trackingNumber || '').toLowerCase().includes(s) || 
           (r.orderNumber || '').toLowerCase().includes(s) || 
           (r.customerName || '').toLowerCase().includes(s) ||
           currentStatus.toLowerCase().includes(s) || 
           (r.notes || '').toLowerCase().includes(s);
  });

  const toggleColumn = (colId: string) => {
    setVisibleColumns(prev => 
      prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
    );
  };

  // --- PAGINATION HANDLERS ---
  const handlePrevious = () => {
    if (page > 1) {
      setPage(prev => Math.max(prev - 1, 1));
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      setPage(prev => Math.min(prev + 1, totalPages));
    }
  };

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      {editingRow && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 border border-slate-200">
             <div className="flex justify-between items-start mb-4">
                <div><h3 className="text-xl font-bold text-slate-800">Order Notes</h3><p className="text-sm text-slate-500 font-mono mt-1">{editingRow.orderNumber}</p></div>
                <button onClick={() => setEditingRow(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition"><X className="w-5 h-5" /></button>
             </div>
             <div className="space-y-4">
                <div onClick={() => setIsFlagged(!isFlagged)} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${isFlagged ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                   <div className={`p-2.5 rounded-full ${isFlagged ? 'bg-red-200 text-red-700' : 'bg-slate-100 text-slate-400'}`}><Flag className="w-5 h-5 fill-current" /></div>
                   <div><p className={`font-bold ${isFlagged ? 'text-red-700' : 'text-slate-700'}`}>Flag as Issue</p><p className="text-xs text-slate-500">Moves to Issues tab permanently</p></div>
                </div>
                <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Internal Notes</label><textarea className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" placeholder="Details about damage, delays, or special instructions..." value={editNote} onChange={(e) => setEditNote(e.target.value)} autoFocus /></div>
                <div className="flex gap-3 pt-2">
                   <button onClick={() => setEditingRow(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors">Cancel</button>
                   <button onClick={handleSaveAnnotation} disabled={savingNote} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">{savingNote ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} Save Note</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-800">
          <CloudOff className="w-5 h-5 text-red-600" />
          <div><p className="font-bold">Backend Connection Failed</p><p className="text-sm">Could not fetch tracking list from the backend server.</p></div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex-shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
           <div><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Truck className="w-8 h-8 text-blue-600" /> Tracking Dashboard</h1><p className="text-slate-500">Monitor shipments and manage issues.</p></div>
           
           <div className="flex items-center gap-3">
             <div className="relative" ref={columnSelectorRef}>
               <button 
                 onClick={() => setShowColumnSelector(!showColumnSelector)}
                 className={`bg-white border text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${showColumnSelector ? 'border-blue-500 text-blue-600' : 'border-slate-200 hover:bg-slate-50'}`}
               >
                 <Settings2 className="w-4 h-4" /> Columns
               </button>
               
               {showColumnSelector && (
                 <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-[70] py-2 animate-in fade-in slide-in-from-top-2">
                   <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                     <span className="text-xs font-bold text-slate-500 uppercase">Visible Columns</span>
                     <button 
                      onClick={() => setVisibleColumns(AVAILABLE_COLUMNS.map(c => c.id))}
                      className="text-[10px] text-blue-600 hover:underline font-bold"
                     >
                       Show All
                     </button>
                   </div>
                   <div className="max-h-[300px] overflow-y-auto">
                     {AVAILABLE_COLUMNS.map(col => (
                       <button
                         key={col.id}
                         onClick={() => toggleColumn(col.id)}
                         className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                       >
                         <div className="flex items-center gap-3">
                           <div className={`p-1.5 rounded bg-slate-100 text-slate-500 group-hover:bg-slate-200`}>
                             {col.icon}
                           </div>
                           <span className="text-sm font-medium text-slate-700">{col.label}</span>
                         </div>
                         {visibleColumns.includes(col.id) && (
                           <Check className="w-4 h-4 text-blue-600" />
                         )}
                       </button>
                     ))}
                   </div>
                 </div>
               )}
             </div>

             <button onClick={onRefresh} className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-100 transition-colors">
               <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh List
             </button>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-end gap-4">
           <div className="flex bg-slate-100 p-1.5 rounded-xl w-full lg:w-auto overflow-x-auto">
              {[ 
                { id: 'Active', label: 'Active', icon: Truck, color: 'text-blue-600' }, 
                { id: 'Delivered', label: 'Delivered', icon: PackageCheck, color: 'text-green-600' }, 
                { id: 'Issues', label: 'Issues', icon: AlertTriangle, color: 'text-red-600' }, 
                { id: null, label: 'All Orders', icon: BoxSelect, color: 'text-slate-800' }, 
              ].map(tab => (
                <button 
                  key={tab.id || 'all'} 
                  onClick={() => onStatusFilterChange(tab.id)} 
                  className={`flex-1 lg:flex-none px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeStatusFilter === tab.id ? `bg-white ${tab.color} shadow-sm ring-1 ring-black/5` : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                   <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
           </div>
           <div className="relative w-full lg:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-400" /></div>
            <input type="text" className="block w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" placeholder="Search current view..." value={filterText} onChange={(e) => setFilterText(e.target.value)} />
           </div>
        </div>
      </div>

      {/* Main Table Container with Horizontal Scroll */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden min-h-[500px]">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <div className="min-w-max inline-block align-middle h-full">
            {/* Sticky Header Row */}
            <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
               {AVAILABLE_COLUMNS.filter(c => visibleColumns.includes(c.id)).map(col => (
                 <div 
                   key={col.id} 
                   className={`relative px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider flex-shrink-0 select-none bg-slate-50 border-r border-slate-100 last:border-0`} 
                   style={{ width: colWidths[col.id] }}
                 >
                   <div className="flex items-center gap-2 truncate">
                     {col.icon} <span>{col.label}</span>
                   </div>
                   <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-20" onMouseDown={(e) => handleResizeStart(e, col.id)} />
                 </div>
               ))}
               <div className="relative px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider flex-shrink-0 select-none bg-slate-50" style={{ width: colWidths.actions }}>
                  Actions
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-20" onMouseDown={(e) => handleResizeStart(e, 'actions')} />
               </div>
            </div>

            {/* Table Body Rows */}
            <div className="divide-y divide-slate-100">
              {loading && apiRows.length === 0 ? (
                 <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center w-full min-w-[1000px]">
                    <RefreshCw className="w-10 h-10 mb-4 animate-spin text-blue-500 opacity-50" /><p className="font-medium">Loading tracking data...</p>
                 </div>
              ) : filteredRows.length === 0 ? (
                 <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center w-full min-w-[1000px]">
                    <Package className="w-16 h-16 mb-4 opacity-10" /><p>No orders found in this category.</p>
                 </div>
              ) : (
                filteredRows.map((r, i) => {
                  const currentStatus = getRealStatus(r);
                  const isDelivered = currentStatus.toLowerCase().includes('delivered');
                  
                  return (
                    <div key={`${r.orderNumber}-${i}`} className={`flex hover:bg-blue-50/30 items-center transition-colors group ${r.flagged ? 'bg-red-50/40 hover:bg-red-50 border-l-4 border-l-red-500' : ''}`}>
                      {visibleColumns.includes('order') && (
                        <div className="px-6 py-4 flex-shrink-0 overflow-hidden border-r border-slate-50" style={{ width: colWidths.order }}>
                          <p className="text-sm font-bold text-slate-800 truncate" title={r.orderNumber}>{r.orderNumber}</p>
                          {r.flagged && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 uppercase mt-1">
                              <Flag className="w-2.5 h-2.5 fill-current" /> Issue
                            </span>
                          )}
                        </div>
                      )}

                      {visibleColumns.includes('customer') && (
                        <div className="px-6 py-4 flex-shrink-0 overflow-hidden border-r border-slate-50" style={{ width: colWidths.customer }}>
                          <p className="text-sm font-medium text-slate-700 truncate" title={r.customerName}>
                            {r.customerName || '-'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{r.customerEmail || ''}</p>
                        </div>
                      )}

                      {visibleColumns.includes('tracking') && (
                        <div className="px-6 py-4 flex-shrink-0 overflow-hidden border-r border-slate-50" style={{ width: colWidths.tracking }}>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-medium text-slate-600 truncate text-sm`} title={r.trackingNumber}>{r.trackingNumber}</span>
                            {r.trackingUrl && ( <a href={r.trackingUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a> )}
                          </div>
                        </div>
                      )}
                      
                      {visibleColumns.includes('status') && (
                        <div className="px-6 py-4 flex-shrink-0 overflow-hidden border-r border-slate-50" style={{ width: colWidths.status }}>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase border tracking-wide truncate max-w-full shadow-sm ${getStatusColor(currentStatus)}`} title={currentStatus}>
                            {getStatusIcon(currentStatus)}
                            <span className="truncate">{currentStatus ? currentStatus.toUpperCase() : "MISSING DATA"}</span>
                          </span>
                        </div>
                      )}

                      {visibleColumns.includes('items') && (
                        <div className="px-6 py-4 flex-shrink-0 overflow-hidden border-r border-slate-50" style={{ width: colWidths.items }}>
                           <p className="text-xs text-slate-600 truncate" title={r.items}>{r.items || '-'}</p>
                        </div>
                      )}

                      {visibleColumns.includes('shipDate') && (
                        <div className="px-6 py-4 flex-shrink-0 overflow-hidden border-r border-slate-50" style={{ width: colWidths.shipDate }}>
                           <p className="text-sm text-slate-600 truncate">{r.shipDate || '-'}</p>
                        </div>
                      )}

                      {visibleColumns.includes('carrier') && (
                        <div className="px-6 py-4 flex-shrink-0 overflow-hidden border-r border-slate-50" style={{ width: colWidths.carrier }}>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter truncate">{r.carrierCode || 'UPS'}</p>
                        </div>
                      )}

                      {visibleColumns.includes('labelCost') && (
                        <div className="px-6 py-4 flex-shrink-0 overflow-hidden border-r border-slate-50" style={{ width: colWidths.labelCost }}>
                           <p className="text-sm font-mono text-slate-700 truncate">
                             {r.labelCost !== undefined && r.labelCost !== null ? currencyFormatter.format(r.labelCost) : '$0.00'}
                           </p>
                        </div>
                      )}

                      {visibleColumns.includes('location') && (
                        <div className="px-6 py-4 flex-shrink-0 overflow-hidden border-r border-slate-50" style={{ width: colWidths.location }}>
                          <p className={`text-sm text-slate-600 truncate`} title={r.location}>{r.location || r.upsLocation || '-'}</p>
                        </div>
                      )}

                      {visibleColumns.includes('eta') && (
                        <div className="px-6 py-4 flex-shrink-0 overflow-hidden border-r border-slate-50" style={{ width: colWidths.eta }}>
                          <p className="text-sm font-medium text-slate-700 truncate">{r.expectedDelivery || r.eta || 'Pending'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{r.lastUpdated ? new Date(r.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</p>
                        </div>
                      )}

                      <div className="px-6 py-4 flex-shrink-0 flex items-center justify-end gap-2 bg-white/50 group-hover:bg-blue-50/10 backdrop-blur-sm" style={{ width: colWidths.actions }}>
                        <button onClick={() => handleEditClick(r)} className={`p-1.5 rounded-lg transition-colors border ${r.notes ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600'}`} title={r.notes ? "View/Edit Notes" : "Add Note / Flag"}>
                          {r.notes ? <StickyNote className="w-4 h-4 fill-current opacity-80" /> : <FileText className="w-4 h-4" />}
                        </button>
                        <button onClick={(e) => refreshRow(r.trackingNumber, e)} disabled={refreshingId === r.trackingNumber || r.trackingNumber === 'No Tracking' || isDelivered} className={`p-1.5 rounded-lg transition-colors border ${isDelivered ? 'bg-green-50 text-green-600 border-green-200 opacity-75 cursor-default' : 'bg-white text-blue-600 hover:bg-blue-50 border-slate-200 hover:border-blue-200 disabled:opacity-30'}`} title={isDelivered ? "Delivery Confirmed" : "Refresh from UPS"}>
                          {isDelivered ? <CheckCircle className="w-4 h-4" /> : <RefreshCw className={`w-4 h-4 ${refreshingId === r.trackingNumber ? 'animate-spin' : ''}`} />}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        
        {/* Pagination Toolbar */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-sm flex-shrink-0">
            <span className="text-slate-500">
              Page <span className="font-bold text-slate-700">{page}</span> of <span className="font-bold text-slate-700">{totalPages}</span>
            </span>
            <div className="flex gap-2">
                <button 
                  disabled={page <= 1 || loading} 
                  onClick={handlePrevious} 
                  className="p-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4"/>
                </button>
                <button 
                  disabled={page >= totalPages || loading} 
                  onClick={handleNext} 
                  className="p-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4"/>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
