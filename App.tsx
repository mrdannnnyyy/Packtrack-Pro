
import React, { useState, useEffect, useCallback } from 'react';
import { PackageLog, Tab, User, EnrichedOrder } from './types';
import { TrackerView } from './components/TrackerView';
import { AnalyticsView } from './components/AnalyticsView';
import { HistoryView } from './components/HistoryView';
import { ConfigurationView } from './components/ConfigurationView';
import { LoginView } from './components/LoginView';
import { OrderDetailsView } from './components/OrderDetailsView';
import { PackageTrackingView } from './components/PackageTrackingView';
import { subscribeToLogs, subscribeToUsers, clearAllSystemData } from './firebase'; 
import { fetchOrders } from './shipstationApi';
import { fetchTrackingList } from './upsApi';
import { Box, BarChart3, History, LayoutDashboard, Settings, LogOut, X, PanelLeftClose, PanelLeftOpen, AlertTriangle, Lock, Truck, ShoppingBag } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.TRACKER);
  const [logs, setLogs] = useState<PackageLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginTimestamp, setLoginTimestamp] = useState<number | undefined>(undefined);
  
  // --- REMOTE DATA STATE ---
  const [remoteData, setRemoteData] = useState<any[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remotePage, setRemotePage] = useState(1);
  const [remoteTotalPages, setRemoteTotalPages] = useState(1);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [lastSync, setLastSync] = useState(0);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  // Default status for Tracking tab is "Active"
  const [remoteStatus, setRemoteStatus] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; onConfirm: () => void } | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  // --- DYNAMIC FETCHING LOGIC ---
  const fetchRemoteData = useCallback(async (pageNum: number, status?: string | null) => {
    if (activeTab !== Tab.ORDERS && activeTab !== Tab.TRACKING) return;
    
    setRemoteLoading(true);
    setRemoteError(null);
    try {
      let res;
      // Determine effective status: passed param takes precedence over state
      const effectiveStatus = status !== undefined ? status : remoteStatus;
      
      // Map Tab to specific endpoint and use provided status filters
      if (activeTab === Tab.TRACKING) {
        // Fetch from /tracking with optional status=Active|Delivered|Issues
        res = await fetchTrackingList(
          pageNum, 
          effectiveStatus === 'Delivered' ? 50 : 25, 
          effectiveStatus || undefined
        );
      } else {
        // Fetch from /orders with optional status=Active|Delivered|Issues
        res = await fetchOrders(
          pageNum, 
          effectiveStatus === 'Delivered' ? 50 : 25, 
          effectiveStatus || undefined
        );
      }
      
      setRemoteData(res.data || []);
      setRemoteTotalPages(res.totalPages || 1);
      setRemoteTotal(res.total || 0);
      if ('lastSync' in res) setLastSync(res.lastSync);
    } catch (e: any) {
      console.error("Fetch error:", e);
      setRemoteError("Failed to fetch data from backend server.");
    } finally {
      setRemoteLoading(false);
    }
  }, [activeTab, remoteStatus]);

  // Handle Main Sidebar Tab Changes
  useEffect(() => {
    if (activeTab === Tab.ORDERS || activeTab === Tab.TRACKING) {
      setRemotePage(1);
      // Reset status to "Active" by default for Tracking, null for Orders (All)
      const defaultStatus = activeTab === Tab.TRACKING ? 'Active' : null;
      setRemoteStatus(defaultStatus);
      fetchRemoteData(1, defaultStatus);
    }
  }, [activeTab]);

  // Handle Sub-Status Changes (e.g. from PackageTrackingView tabs)
  const handleStatusChange = (status: string | null) => {
    setRemoteStatus(status);
    setRemotePage(1);
    fetchRemoteData(1, status);
  };

  // Handle Page Changes
  useEffect(() => {
    if (remotePage > 1) {
       fetchRemoteData(remotePage, remoteStatus);
    }
  }, [remotePage]);

  // APP INITIALIZATION: Firestore Subscriptions
  useEffect(() => {
    const unsubscribeUsers = subscribeToUsers(
      (fetchedUsers) => {
        setUsers(fetchedUsers);
        setIsLoaded(true);
        setDbError(null);
        if (currentUser) {
          const updatedMe = fetchedUsers.find(u => u.id === currentUser.id);
          if (updatedMe) setCurrentUser(updatedMe);
        }
      },
      (error) => {
        setDbError(error?.code === 'permission-denied' ? 'permission-denied' : (error?.message || 'Unknown database error'));
      }
    );

    const unsubscribeLogs = subscribeToLogs(
      (fetchedLogs) => {
        setLogs(fetchedLogs);
        setDbError(null);
      },
      (error) => {
        if (error?.code === 'permission-denied') setDbError('permission-denied');
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
    };
  }, [currentUser?.id]);

  const requestConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, message, onConfirm });
  };

  const handleConfirmAction = () => {
    if (confirmModal) {
      confirmModal.onConfirm();
      setConfirmModal(null);
    }
  };

  const handleNavClick = (tab: Tab) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setLoginTimestamp(Date.now());
    setIsAuthenticated(true);
    setActiveTab(Tab.TRACKER); 
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setLoginTimestamp(undefined);
    setIsSidebarOpen(true); 
  };

  const isAdmin = currentUser?.role === 'ADMIN';
  const isSupport = currentUser?.role === 'SUPPORT';
  const hasAdminPrivileges = isAdmin || isSupport;

  if (dbError === 'permission-denied') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl p-8 border border-red-200 text-center">
          <Lock className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Database Access Denied</h1>
          <p className="text-slate-500 mt-2">Check your Firestore security rules.</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-medium tracking-widest animate-pulse">CONNECTING...</div>;

  if (!isAuthenticated) return <LoginView users={users} onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex overflow-hidden">
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <div className="flex flex-col items-center text-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600 mb-2" />
              <p className="text-slate-600 font-medium">{confirmModal.message}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 text-slate-700 font-semibold bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleConfirmAction} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Box className="text-white w-6 h-6 bg-blue-600 p-1 rounded" />
            <h1 className="text-xl font-bold text-white tracking-tight">PackTrack Pro</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-800/50">
           <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${isAdmin ? 'bg-purple-600' : isSupport ? 'bg-emerald-600' : 'bg-blue-600'} text-white`}>
                {currentUser?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{currentUser?.role}</p>
                <p className="text-sm font-bold text-white truncate">{currentUser?.name}</p>
              </div>
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => handleNavClick(Tab.TRACKER)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === Tab.TRACKER ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'hover:bg-slate-800'}`}>
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Tracker</span>
          </button>

          {isAdmin && (
            <button onClick={() => handleNavClick(Tab.ANALYTICS)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === Tab.ANALYTICS ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
              <BarChart3 className="w-5 h-5" />
              <span className="font-medium">Analytics</span>
            </button>
          )}

          {hasAdminPrivileges && (
            <>
              <button onClick={() => handleNavClick(Tab.HISTORY)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === Tab.HISTORY ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
                <History className="w-5 h-5" />
                <span className="font-medium">Log History</span>
              </button>
              <button onClick={() => handleNavClick(Tab.ORDERS)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === Tab.ORDERS ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
                <ShoppingBag className="w-5 h-5" />
                <span className="font-medium">Orders</span>
              </button>
              <button onClick={() => handleNavClick(Tab.TRACKING)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === Tab.TRACKING ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
                <Truck className="w-5 h-5" />
                <span className="font-medium">Tracking</span>
              </button>
            </>
          )}

          {isAdmin && (
            <button onClick={() => handleNavClick(Tab.CONFIGURATION)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === Tab.CONFIGURATION ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
              <Settings className="w-5 h-5" />
              <span className="font-medium">Configuration</span>
            </button>
          )}
        </nav>

        <div className="p-6 border-t border-slate-800">
           <button onClick={handleLogout} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
             <LogOut className="w-4 h-4" /> Log Out
           </button>
        </div>
      </aside>

      <main className={`flex-1 min-h-screen transition-all duration-300 flex flex-col ${isSidebarOpen ? 'md:ml-72' : 'md:ml-0'}`}>
        <header className="bg-white shadow-sm border-b border-slate-200 px-4 md:px-6 py-4 sticky top-0 z-20 flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-500 hover:bg-slate-100 p-2 rounded-lg">
            {isSidebarOpen ? <PanelLeftClose className="w-6 h-6" /> : <PanelLeftOpen className="w-6 h-6" />}
          </button>
          <div className="flex-1 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">
              {activeTab === Tab.TRACKER && "Daily Tracker"}
              {activeTab === Tab.ANALYTICS && "Performance Analytics"}
              {activeTab === Tab.HISTORY && "Detailed History"}
              {activeTab === Tab.ORDERS && "ShipStation Orders"}
              {activeTab === Tab.TRACKING && "Package Tracking"}
              {activeTab === Tab.CONFIGURATION && "Configuration"}
            </h2>
          </div>
        </header>

        <div className="p-4 md:p-8 w-full flex-1 overflow-y-auto">
          {activeTab === Tab.TRACKER && <TrackerView logs={logs} currentUser={currentUser} users={users} setActiveTab={setActiveTab} requestConfirm={requestConfirm} loginTimestamp={loginTimestamp} />}
          {activeTab === Tab.ANALYTICS && isAdmin && <AnalyticsView logs={logs} users={users} />}
          {activeTab === Tab.HISTORY && hasAdminPrivileges && <HistoryView logs={logs} users={users} requestConfirm={requestConfirm} />}
          
          {activeTab === Tab.ORDERS && hasAdminPrivileges && (
            <OrderDetailsView 
               orders={remoteData} 
               loading={remoteLoading} 
               error={remoteError} 
               page={remotePage} 
               setPage={setRemotePage} 
               totalPages={remoteTotalPages} 
               total={remoteTotal} 
               lastSync={lastSync}
               onRefresh={() => fetchRemoteData(remotePage)}
            />
          )}

          {activeTab === Tab.TRACKING && hasAdminPrivileges && (
            <PackageTrackingView 
              apiRows={remoteData} 
              loading={remoteLoading} 
              error={remoteError !== null} 
              page={remotePage} 
              setPage={setRemotePage} 
              totalPages={remoteTotalPages}
              onRefresh={() => fetchRemoteData(remotePage)}
              activeStatusFilter={remoteStatus}
              onStatusFilterChange={handleStatusChange}
            />
          )}

          {activeTab === Tab.CONFIGURATION && isAdmin && <ConfigurationView users={users} currentUser={currentUser} setCurrentUser={setCurrentUser} setActiveTab={setActiveTab} requestConfirm={requestConfirm} />}
        </div>
      </main>
    </div>
  );
};

export default App;
