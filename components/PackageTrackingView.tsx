
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TrackingRow, refreshSingleTracking } from '../upsApi';
import { subscribeToAnnotations, saveAnnotation, Annotation } from '../firebase';
import { Truck, RefreshCw, ExternalLink, ChevronLeft, ChevronRight, CloudOff, Search, Flag, AlertTriangle, FileText, X, Save, BoxSelect, PackageCheck, Package, StickyNote, CheckCircle } from 'lucide-react';

type TrackingTab = 'ACTIVE' | 'DELIVERED' | 'ISSUE' | 'ALL';

interface PackageTrackingViewProps {
  apiRows: TrackingRow[];
  loading: boolean;
  error: boolean;
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  onRefresh: () => void;
}

export const PackageTrackingView: React.FC<PackageTrackingViewProps> = ({
  apiRows,
  loading,
  error,
  page,
  setPage,
  totalPages,
  onRefresh
}) => {
  const [annotations, setAnnotations] = useState<Record<string, Annotation>>({});
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [activeTab, setActiveTab] = useState<TrackingTab>('ACTIVE');

  // Annotation Modal State
  const [editingRow, setEditingRow] = useState<TrackingRow | null>(null);
  const [editNote, setEditNote] = useState('');
  const [isFlagged, setIsFlagged] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // Column Resizing State
  const [colWidths, setColWidths] = useState({ order: 140, tracking: 180, status: 150, loc: 180, eta: 130, actions: 100 });

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

  // Subscribe to Annotations (Firebase)
  useEffect(() => {
    const unsubscribe = subscribeToAnnotations((data) => {
      setAnnotations(data);
    });
    return () => unsubscribe();
  }, []);

  // Merge API Data with Firebase Annotations
  const mergedRows = useMemo(() => {
    return apiRows.map(row => {
      const ann = annotations[row.trackingNumber];
      return {
        ...row,
        flagged: ann ? ann.flagged : false,
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
      onRefresh(); // Trigger global refresh to pull in the new data
    } catch (err) {
      console.error("Failed to refresh row:", err);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleEditClick = (row: TrackingRow) => {
    setEditingRow(row);
    setEditNote(row.notes || '');
    setIsFlagged(row.flagged || false);
  };

  const handleSaveAnnotation = async () => {
    if (!editingRow) return;
    setSavingNote(true);
    try {
      await saveAnnotation(editingRow.trackingNumber, isFlagged, editNote);
      setEditingRow(null);
    } catch (e) {
      alert("Error saving note to database.");
      console.error(e);
    } finally {
      setSavingNote(false);
    }
  };

  // REFACTORED STATUS COLOR MAPPING
  const getStatusColor = (s: string) => {
    const sl = (s || '').toLowerCase();
    
    // 1. DELIVERED (Green)
    if (sl.includes('delivered')) return 'bg-green-100 text-green-700 border-green-200';
    
    // 2. ACTIVE SHIPMENTS (Blue)
    if (
      sl.includes('transit') || 
      sl.includes('way') || 
      sl.includes('arrived') || 
      sl.includes('pickup') || 
      sl.includes('shipped') || 
      sl.includes('out') ||
      sl.includes('ready')
    ) return 'bg-blue-100 text-blue-700 border-blue-200';
    
    // 3. ISSUES (Red)
    if (
      sl.includes('exception') || 
      sl.includes('issue') || 
      sl.includes('fail') || 
      sl.includes('error') || 
      sl.includes('return') ||
      sl.includes('void')
    ) return 'bg-red-100 text-red-700 border-red-200';
    
    // 4. PRE-SHIPPING / INITIAL (Slate/Gray)
    if (sl.includes('label') || sl.includes('pending') || sl.includes('created'))
      return 'bg-slate-100 text-slate-500 border-slate-200';
    
    // Default Fallback
    return 'bg-slate-50 text-slate-400 border-slate-200';
  };

  const filteredRows = mergedRows.filter(r => {
    const s = filterText.toLowerCase();
    const matchesText = (r.trackingNumber || '').toLowerCase().includes(s) || (r.orderNumber || '').toLowerCase().includes(s) || (r.upsStatus || '').toLowerCase().includes(s) || (r.notes || '').toLowerCase().includes(s);
    if (!matchesText) return false;

    const statusLower = (r.upsStatus || '').toLowerCase();
    const isDelivered = statusLower.includes('delivered');
    const isException = statusLower.includes('exception') || statusLower.includes('error') || statusLower.includes('fail') || statusLower.includes('issue');
    const isFlaggedItem = r.flagged === true;

    switch (activeTab) {
      case 'ACTIVE': return !isDelivered && !isException && !isFlaggedItem;
      case 'DELIVERED': return isDelivered;
      case 'ISSUE': return isException || isFlaggedItem;
      case 'ALL': default: return true;
    }
  });

  const getDynamicTextClass = (text: string, maxLen = 20) => {
    if (!text) return 'text-sm';
    if (text.length > maxLen * 1.5) return 'text-[10px] leading-tight';
    if (text.length > maxLen) return 'text-xs leading-tight';
    return 'text-sm';
  };

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 border border-slate-200">
             <div className="flex justify-between items-start mb-4">
                <div><h3 className="text-xl font-bold text-slate-800">Order Notes</h3><p className="text-sm text-slate-500 font-mono mt-1">{editingRow.orderNumber}</p></div>
                <button onClick={() => setEditingRow(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition"><X className="w-5 h-5" /></button>
             </div>
             <div className="space-y-4">
                <div onClick={() => setIsFlagged(!isFlagged)} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${isFlagged ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                   <div className={`p-2.5 rounded-full ${isFlagged ? 'bg-red-200 text-red-700' : 'bg-slate-100 text-slate-400'}`}><Flag className="w-5 h-5 fill-current" /></div>
                   <div><p className={`font-bold ${isFlagged ? 'text-red-700' : 'text-slate-700'}`}>Flag as Issue</p><p className="text-xs text-slate-500">Moves to Issues tab for attention</p></div>
                </div>
                <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Internal Notes</label><textarea className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" placeholder="Details about damage, delays, or special instructions..." value={editNote} onChange={(e) => setEditNote(e.target.value)} autoFocus /></div>
                <div className="flex gap-3 pt-2">
                   <button onClick={() => setEditingRow(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors">Cancel</button>
                   <button onClick={handleSaveAnnotation} disabled={savingNote} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">{savingNote ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} Save Note</button>
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
           <button onClick={onRefresh} className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-100 transition-colors">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh List
           </button>
        </div>
        <div className="flex flex-col lg:flex-row justify-between items-end gap-4">
           <div className="flex bg-slate-100 p-1.5 rounded-xl w-full lg:w-auto overflow-x-auto">
              {[ { id: 'ACTIVE', label: 'Active', icon: Truck, color: 'text-blue-600' }, { id: 'DELIVERED', label: 'Delivered', icon: PackageCheck, color: 'text-green-600' }, { id: 'ISSUE', label: 'Issues', icon: AlertTriangle, color: 'text-red-600' }, { id: 'ALL', label: 'All Orders', icon: BoxSelect, color: 'text-slate-800' }, ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as TrackingTab)} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id ? `bg-white ${tab.color} shadow-sm ring-1 ring-black/5` : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                   <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
           </div>
           <div className="relative w-full lg:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-400" /></div>
            <input type="text" className="block w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" placeholder="Search..." value={filterText} onChange={(e) => setFilterText(e.target.value)} />
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden min-h-[500px]">
        <div className="overflow-x-auto flex-1">
          <div className="min-w-full inline-block align-middle h-full">
            <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
               {[ { key: 'order', label: 'Order Info' }, { key: 'tracking', label: 'Tracking #' }, { key: 'status', label: 'Current Status' }, { key: 'loc', label: 'Last Location' }, { key: 'eta', label: 'Est. Delivery' }, { key: 'actions', label: '' } ].map(col => (
                 <div key={col.key} className="relative px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider flex-shrink-0 select-none bg-slate-50" style={{ width: colWidths[col.key as keyof typeof colWidths] }}>
                   {col.label}
                   {col.label && ( <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-20" onMouseDown={(e) => handleResizeStart(e, col.key as keyof typeof colWidths)} /> )}
                 </div>
               ))}
            </div>
            <div className="divide-y divide-slate-100">
              {loading && apiRows.length === 0 ? (
                 <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center">
                    <RefreshCw className="w-10 h-10 mb-4 animate-spin text-blue-500 opacity-50" /><p className="font-medium">Loading tracking data...</p>
                 </div>
              ) : filteredRows.length === 0 ? (
                 <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center">
                    <Package className="w-16 h-16 mb-4 opacity-10" /><p>No orders found in {activeTab.toLowerCase()} view.</p>
                 </div>
              ) : (
                filteredRows.map((r, i) => {
                  const isDelivered = r.upsStatus?.toLowerCase().includes('delivered');
                  return (
                    <div key={`${r.orderNumber}-${i}`} className={`flex hover:bg-blue-50/30 items-center transition-colors group ${r.flagged ? 'bg-red-50/40 hover:bg-red-50' : ''}`}>
                      <div className="px-6 py-3 flex-shrink-0" style={{ width: colWidths.order }}>
                        <p className="text-sm font-bold text-slate-800">{r.orderNumber}</p>
                        {r.flagged && ( <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wide"><Flag className="w-3 h-3 fill-current" /> Flagged</div> )}
                      </div>
                      <div className="px-6 py-3 flex-shrink-0 overflow-hidden" style={{ width: colWidths.tracking }}>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-medium text-slate-600 truncate ${getDynamicTextClass(r.trackingNumber, 20)}`} title={r.trackingNumber}>{r.trackingNumber}</span>
                          {r.trackingUrl && ( <a href={r.trackingUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink className="w-3 h-3" /></a> )}
                        </div>
                      </div>
                      <div className="px-6 py-3 flex-shrink-0 overflow-hidden" style={{ width: colWidths.status }}>
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border tracking-wide truncate max-w-full ${getStatusColor(r.upsStatus)}`} title={r.upsStatus}>
                          {r.upsStatus || 'N/A'}
                        </span>
                      </div>
                      <div className="px-6 py-3 flex-shrink-0 overflow-hidden" style={{ width: colWidths.loc }}><p className={`text-slate-600 truncate ${getDynamicTextClass(r.location || '', 25)}`} title={r.location}>{r.location || '-'}</p></div>
                      <div className="px-6 py-3 flex-shrink-0 overflow-hidden" style={{ width: colWidths.eta }}><p className="text-sm font-medium text-slate-700 truncate">{r.expectedDelivery}</p><p className="text-[10px] text-slate-400 mt-0.5">{r.lastUpdated ? new Date(r.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</p></div>
                      <div className="px-6 py-3 flex-shrink-0 flex items-center justify-end gap-2" style={{ width: colWidths.actions }}>
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
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-sm flex-shrink-0">
            <span className="text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
                <button disabled={page===1} onClick={()=>setPage(page-1)} className="p-1.5 border rounded-md hover:bg-white disabled:opacity-50"><ChevronLeft className="w-4 h-4"/></button>
                <button disabled={page===totalPages} onClick={()=>setPage(page+1)} className="p-1.5 border rounded-md hover:bg-white disabled:opacity-50"><ChevronRight className="w-4 h-4"/></button>
            </div>
        </div>
      </div>
    </div>
  );
};
