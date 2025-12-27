
import React, { useState, useRef, useEffect } from 'react';
import { EnrichedOrder } from '../types';
import { fetchEnrichedOrders, trackSingleOrder } from '../upsApi';
import { Truck, RefreshCw, MapPin, Calendar, AlertCircle, Search, Server, CloudOff, PackageCheck, PackageOpen, Filter, ShoppingBag, Mail, ExternalLink, ChevronLeft, ChevronRight, Hash } from 'lucide-react';

interface ShipmentTrackingViewProps {
  // No props needed, data is fetched internally
}

type TabStatus = 'ALL' | 'ACTIVE' | 'DELIVERED' | 'EXCEPTION';

export const ShipmentTrackingView: React.FC<ShipmentTrackingViewProps> = () => {
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [activeTab, setActiveTab] = useState<TabStatus>('ACTIVE');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [connectionError, setConnectionError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // State for tracking individual row updates
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Column Width State
  const [colWidths, setColWidths] = useState({
    order: 140,
    customer: 180,
    items: 200,
    tracking: 180,
    status: 160,
    loc: 200,
    eta: 120,
    last: 120,
    actions: 80
  });

  // Resizing Logic
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
      [resizeRef.current!.col]: Math.max(80, resizeRef.current!.startWidth + diff) // Min width 80px
    }));
  };

  const handleMouseUp = () => {
    resizeRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // --- DATA LOADING ---
  const loadData = async (page = currentPage, limit = pageSize) => {
    setIsRefreshing(true);
    setConnectionError(false);
    setStatusMessage(`Loading Page ${page}...`);
    
    try {
      const response = await fetchEnrichedOrders(page, limit);
      
      setOrders(response.data);
      setTotalOrders(response.total);
      setTotalPages(response.totalPages);
      setCurrentPage(response.page); // Sync server page
      
      setStatusMessage(`Loaded page ${page} of ${response.totalPages}.`);
    } catch (error: any) {
      console.error("Failed to load orders:", error);
      setConnectionError(true);
      setStatusMessage('Failed to connect to backend server.');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
      setTimeout(() => setStatusMessage(''), 5000);
    }
  };

  // Initial Load & When Page/Limit Changes
  useEffect(() => {
    loadData(currentPage, pageSize);
  }, [currentPage, pageSize]);

  const handleRefreshSingle = async (trackingNumber: string) => {
    if (!trackingNumber || trackingNumber === 'No Tracking') return;
    
    setRefreshingId(trackingNumber);
    try {
      const updatedData = await trackSingleOrder(trackingNumber);
      
      setOrders(prevOrders => prevOrders.map(o => {
        if (o.trackingNumber === trackingNumber) {
          return { ...o, ...updatedData };
        }
        return o;
      }));
    } catch (error) {
      console.error("Failed to update single order:", error);
    } finally {
      setRefreshingId(null);
    }
  };

  // --- FILTERING (Client side filtering of current page) ---
  const filteredOrders = orders.filter(order => {
    const statusLower = (order.status || '').toLowerCase(); // Safety check
    const isDelivered = order.delivered;
    const isException = statusLower.includes('exception') || statusLower.includes('error') || statusLower.includes('failed') || statusLower.includes('issue');
    
    // Tab Filter
    let matchesTab = false;
    if (activeTab === 'ALL') matchesTab = true;
    else if (activeTab === 'ACTIVE') matchesTab = !isDelivered; 
    else if (activeTab === 'DELIVERED') matchesTab = isDelivered;
    else if (activeTab === 'EXCEPTION') matchesTab = isException;

    // Text Filter
    const searchStr = filterText.toLowerCase();
    const matchesText = 
      (order.orderNumber || '').toLowerCase().includes(searchStr) ||
      (order.customerName || '').toLowerCase().includes(searchStr) ||
      (order.trackingNumber || '').toLowerCase().includes(searchStr) ||
      statusLower.includes(searchStr);

    return matchesTab && matchesText;
  });

  const getStatusColor = (status: string | null | undefined) => {
    const sl = (status || '').toLowerCase();
    
    if (sl.includes('delivered')) return 'bg-green-100 text-green-700 border-green-200';
    if (
      sl.includes('transit') || 
      sl.includes('way') || 
      sl.includes('arrived') || 
      sl.includes('pickup') || 
      sl.includes('shipped') || 
      sl.includes('out')
    ) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (sl.includes('exception') || sl.includes('error') || sl.includes('failed') || sl.includes('issue')) 
      return 'bg-red-100 text-red-700 border-red-200';
    
    return 'bg-slate-100 text-slate-500 border-slate-200';
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Truck className="w-8 h-8 text-blue-600" />
              Shipment Tracking
            </h1>
            <p className="text-slate-500">Live ShipStation orders matched with UPS tracking (Paginated).</p>
          </div>
          
          <button
            onClick={() => loadData(currentPage, pageSize)}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-200"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Updating Page...' : 'Update List Status'}
          </button>
        </div>

        {/* STATUS BAR */}
        {connectionError && (
             <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <CloudOff className="w-6 h-6 text-red-600 mt-1" />
                <div>
                    <h3 className="text-red-800 font-bold">Backend Connection Failed</h3>
                    <p className="text-red-600 text-sm mt-1">Check your Render deployment or internet connection.</p>
                </div>
             </div>
        )}

        {statusMessage && !connectionError && (
          <div className="mb-6 p-3 bg-slate-800 text-blue-200 rounded-lg text-sm font-mono border border-slate-700 animate-in fade-in flex items-center gap-2">
            <Server className="w-4 h-4" />
            {statusMessage}
          </div>
        )}

        {/* CONTROLS: TABS + SEARCH */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
           
           {/* TABS */}
           <div className="bg-slate-100 p-1 rounded-lg flex gap-1 overflow-x-auto max-w-full">
              <button 
                onClick={() => setActiveTab('ACTIVE')}
                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'ACTIVE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Truck className="w-4 h-4" /> Active
              </button>
              <button 
                onClick={() => setActiveTab('DELIVERED')}
                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'DELIVERED' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <PackageCheck className="w-4 h-4" /> Delivered
              </button>
              <button 
                onClick={() => setActiveTab('EXCEPTION')}
                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'EXCEPTION' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <AlertCircle className="w-4 h-4" /> Issues
              </button>
              <div className="w-px bg-slate-300 mx-1 my-2"></div>
              <button 
                onClick={() => setActiveTab('ALL')}
                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
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
              className="block w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search current page..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto flex flex-col">
          <div className="min-w-full inline-block align-middle flex-1">
            <div className="border-b border-slate-200 bg-slate-50">
               {/* CUSTOM HEADER WITH RESIZERS */}
               <div className="flex select-none">
                  {[
                    { key: 'order', label: 'Order #', icon: <ShoppingBag className="w-3 h-3" /> },
                    { key: 'customer', label: 'Customer', icon: null },
                    { key: 'items', label: 'Items', icon: null },
                    { key: 'tracking', label: 'Tracking #', icon: null },
                    { key: 'status', label: 'UPS Status', icon: <Filter className="w-3 h-3" /> },
                    { key: 'loc', label: 'Location', icon: <MapPin className="w-3 h-3" /> },
                    { key: 'eta', label: 'Est. Delivery', icon: <Calendar className="w-3 h-3" /> },
                    { key: 'last', label: 'Checked', icon: null },
                    { key: 'actions', label: 'Actions', icon: null }
                  ].map((col) => (
                    <div 
                      key={col.key} 
                      className="relative px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 border-r border-transparent hover:bg-slate-100 transition-colors"
                      style={{ width: colWidths[col.key as keyof typeof colWidths], flexShrink: 0 }}
                    >
                      {col.icon} {col.label}
                      
                      {/* DRAG HANDLE */}
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-10"
                        onMouseDown={(e) => handleResizeStart(e, col.key as keyof typeof colWidths)}
                      />
                    </div>
                  ))}
               </div>
            </div>

            <div className="divide-y divide-slate-200 bg-white">
              {isLoading && filteredOrders.length === 0 ? (
                 <div className="px-6 py-12 text-center text-slate-400 w-full flex flex-col items-center">
                    <RefreshCw className="w-8 h-8 mb-2 animate-spin text-blue-500" />
                    Loading orders...
                 </div>
              ) : filteredOrders.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-400 w-full flex flex-col items-center">
                   <PackageOpen className="w-12 h-12 mb-2 opacity-20" />
                   No orders found on this page matching filters.
                </div>
              ) : (
                filteredOrders.map((order, idx) => {
                  return (
                    <div key={`${order.orderNumber}-${idx}`} className="flex hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 items-center">
                      
                      {/* ORDER # */}
                      <div className="px-6 py-4 whitespace-nowrap flex-shrink-0" style={{ width: colWidths.order }}>
                         <p className="font-bold text-slate-800 text-sm">{order.orderNumber || 'Manual'}</p>
                         <p className="text-xs text-slate-400 mt-0.5">{order.shipDate}</p>
                      </div>

                      {/* CUSTOMER */}
                      <div className="px-6 py-4 whitespace-nowrap flex-shrink-0" style={{ width: colWidths.customer }}>
                         <p className="text-sm font-medium text-slate-700 truncate" title={order.customerName}>{order.customerName}</p>
                         <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5 truncate" title={order.customerEmail}>
                            <Mail className="w-3 h-3" /> {order.customerEmail || 'No Email'}
                         </div>
                      </div>

                      {/* ITEMS */}
                      <div className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 truncate flex-shrink-0" style={{ width: colWidths.items }} title={order.items}>
                         {order.items}
                      </div>

                      {/* TRACKING */}
                      <div className="px-6 py-4 whitespace-nowrap flex-shrink-0" style={{ width: colWidths.tracking }}>
                         <p className="text-sm font-mono text-slate-600 truncate" title={order.trackingNumber}>
                            {order.trackingNumber}
                         </p>
                         <p className="text-xs text-slate-400 mt-0.5 uppercase">{order.carrierCode}</p>
                      </div>

                      {/* STATUS */}
                      <div className="px-6 py-4 whitespace-nowrap flex-shrink-0" style={{ width: colWidths.status }}>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                             {order.status || 'N/A'}
                          </span>
                      </div>

                      {/* LOCATION */}
                      <div className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 truncate flex-shrink-0" style={{ width: colWidths.loc }} title={order.location}>
                         {order.location || <span className="text-slate-300">-</span>}
                      </div>

                      {/* ETA */}
                      <div className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 flex-shrink-0" style={{ width: colWidths.eta }}>
                         {order.expectedDelivery && order.expectedDelivery !== '--' ? (
                           <span className="font-mono font-medium">{order.expectedDelivery}</span>
                         ) : (
                           <span className="text-slate-300">-</span>
                         )}
                      </div>

                      {/* LAST CHECKED */}
                      <div className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 flex-shrink-0" style={{ width: colWidths.last }}>
                         {order.lastUpdated ? new Date(order.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                      </div>
                      
                      {/* ACTIONS */}
                      <div className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 flex-shrink-0 flex items-center gap-2" style={{ width: colWidths.actions }}>
                         <button
                           onClick={() => handleRefreshSingle(order.trackingNumber)}
                           disabled={refreshingId === order.trackingNumber || !order.trackingNumber || order.trackingNumber === 'No Tracking'}
                           className="p-1.5 hover:bg-slate-200 rounded-full text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                           title="Refresh Tracking"
                         >
                           <RefreshCw className={`w-4 h-4 ${refreshingId === order.trackingNumber ? 'animate-spin' : ''}`} />
                         </button>
                         {order.trackingUrl && (
                           <a 
                             href={order.trackingUrl} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 hover:text-blue-600 transition-colors"
                             title="View on UPS.com"
                           >
                             <ExternalLink className="w-4 h-4" />
                           </a>
                         )}
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          {/* PAGINATION TOOLBAR */}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-slate-500">
                  Showing page <span className="font-bold text-slate-700">{currentPage}</span> of <span className="font-bold text-slate-700">{totalPages}</span> ({totalOrders} total)
              </div>
              
              <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                     <span className="text-sm text-slate-500">Rows:</span>
                     <select 
                        value={pageSize} 
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="border border-slate-300 rounded-md text-sm px-2 py-1 focus:ring-2 focus:ring-blue-500 bg-white"
                        disabled={isRefreshing}
                     >
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                     </select>
                  </div>

                  <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden shadow-sm">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || isRefreshing}
                        className="px-3 py-2 border-r border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 text-slate-600 transition-colors"
                      >
                         <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || isRefreshing}
                        className="px-3 py-2 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 text-slate-600 transition-colors"
                      >
                         <ChevronRight className="w-5 h-5" />
                      </button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
