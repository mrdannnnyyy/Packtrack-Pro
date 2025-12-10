
import React, { useState, useEffect } from 'react';
import { PackageLog, Tab, User } from './types';
import { TrackerView } from './components/TrackerView';
import { AnalyticsView } from './components/AnalyticsView';
import { HistoryView } from './components/HistoryView';
import { ConfigurationView } from './components/ConfigurationView';
import { LoginView } from './components/LoginView';
import { OrderDetailsView } from './components/OrderDetailsView';
import { PackageTrackingView } from './components/PackageTrackingView';
import { subscribeToLogs, subscribeToUsers, clearAllSystemData } from './firebase'; 
import { Box, BarChart3, History, LayoutDashboard, Settings, LogOut, X, PanelLeftClose, PanelLeftOpen, Shield, AlertTriangle, Database, Lock, Truck, ShoppingBag } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.TRACKER);
  const [logs, setLogs] = useState<PackageLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginTimestamp, setLoginTimestamp] = useState<number | undefined>(undefined);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; onConfirm: () => void } | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

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
        if (error?.code === 'permission-denied') {
          setDbError('permission-denied');
        } else {
          setDbError(error?.message || 'Unknown database error');
        }
      }
    );

    const unsubscribeLogs = subscribeToLogs(
      (fetchedLogs) => {
        setLogs(fetchedLogs);
        setDbError(null);
      },
      (error) => {
        if (error?.code === 'permission-denied') {
          setDbError('permission-denied');
        }
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

  const clearData = () => {
    requestConfirm("DANGER: This will delete ALL data history and users from the CLOUD database permanently. Are you sure?", () => {
      clearAllSystemData().then(() => {
         setCurrentUser(null);
         setIsAuthenticated(false);
      });
    });
  };

  const handleNavClick = (tab: Tab) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
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

  if (dbError === 'permission-denied') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl p-8 border border-red-200">
          <div className="text-center mb-8">
            <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Lock className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800">Database Access Denied</h1>
            <p className="text-slate-500 mt-2 text-lg">The application cannot read or write data to Google Firestore.</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              How to Fix (Required)
            </h3>
            <ol className="list-decimal list-inside space-y-3 text-slate-600">
              <li>Go to your <strong>Firebase Console</strong> ({'>'} Build {'>'} Firestore Database).</li>
              <li>Click on the <strong>Rules</strong> tab at the top.</li>
              <li>Replace the existing code with the following "Test Mode" rules:</li>
            </ol>
            <div className="bg-slate-800 text-slate-300 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}</pre>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-200"
          >
            I Updated the Rules, Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-medium">Connecting to Cloud Database...</div>;

  if (!isAuthenticated) {
    return (
      <LoginView 
        users={users} 
        onLogin={handleLogin} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex overflow-hidden">
      
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100 border border-slate-200">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-red-100 p-3 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Please Confirm</h3>
              <p className="text-slate-600">{confirmModal.message}</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-3 text-slate-700 font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmAction}
                className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Box className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">PackTrack</h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-800/50">
           <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${currentUser?.role === 'ADMIN' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'}`}>
                {currentUser?.name.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                   {currentUser?.role === 'ADMIN' && <Shield className="w-3 h-3" />}
                   {currentUser?.role}
                </p>
                <p className="text-sm font-bold text-white truncate">
                  {currentUser?.name}
                </p>
              </div>
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => handleNavClick(Tab.TRACKER)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === Tab.TRACKER ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Tracker</span>
          </button>

          {currentUser?.role === 'ADMIN' && (
            <>
              <button
                onClick={() => handleNavClick(Tab.ANALYTICS)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === Tab.ANALYTICS ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="font-medium">Analytics</span>
              </button>

              <button
                onClick={() => handleNavClick(Tab.HISTORY)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === Tab.HISTORY ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1'
                }`}
              >
                <History className="w-5 h-5" />
                <span className="font-medium">Log History</span>
              </button>

              <button
                onClick={() => handleNavClick(Tab.ORDERS)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === Tab.ORDERS ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1'
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="font-medium">Orders</span>
              </button>

              <button
                onClick={() => handleNavClick(Tab.TRACKING)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === Tab.TRACKING ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1'
                }`}
              >
                <Truck className="w-5 h-5" />
                <span className="font-medium">Tracking</span>
              </button>

              <button
                onClick={() => handleNavClick(Tab.CONFIGURATION)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === Tab.CONFIGURATION ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span className="font-medium">Configuration</span>
              </button>
            </>
          )}
        </nav>

        <div className="p-6 border-t border-slate-800">
           {currentUser?.role === 'ADMIN' && (
             <button 
               type="button"
               onClick={clearData} 
               className="w-full text-xs text-red-400 hover:text-red-300 hover:underline mb-4 text-left"
             >
               Reset System Data
             </button>
           )}
           <button 
             onClick={handleLogout}
             className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
           >
             <LogOut className="w-4 h-4" />
             Log Out
           </button>
        </div>
      </aside>

      <main 
        className={`flex-1 min-h-screen transition-all duration-300 flex flex-col
          ${isSidebarOpen ? 'md:ml-72' : 'md:ml-0'}`}
      >
        <header className="bg-white shadow-sm border-b border-slate-200 px-4 md:px-6 py-4 sticky top-0 z-20 flex items-center gap-4">
          <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
             className="text-slate-500 hover:bg-slate-100 p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
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
            
            <button 
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-colors"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1 overflow-y-auto">
          {activeTab === Tab.TRACKER && (
            <TrackerView 
              logs={logs} 
              currentUser={currentUser} 
              users={users} 
              setActiveTab={setActiveTab}
              requestConfirm={requestConfirm}
              loginTimestamp={loginTimestamp}
            />
          )}
          {activeTab === Tab.ANALYTICS && currentUser?.role === 'ADMIN' && (
            <AnalyticsView logs={logs} users={users} />
          )}
          {activeTab === Tab.HISTORY && currentUser?.role === 'ADMIN' && (
            <HistoryView 
              logs={logs} 
              users={users} 
              requestConfirm={requestConfirm} 
            />
          )}
          {activeTab === Tab.ORDERS && currentUser?.role === 'ADMIN' && (
             <OrderDetailsView />
          )}
          {activeTab === Tab.TRACKING && currentUser?.role === 'ADMIN' && (
             <PackageTrackingView />
          )}
          {activeTab === Tab.CONFIGURATION && currentUser?.role === 'ADMIN' && (
            <ConfigurationView 
              users={users} 
              currentUser={currentUser} 
              setCurrentUser={setCurrentUser} 
              setActiveTab={setActiveTab} 
              requestConfirm={requestConfirm}
            />
          )}
          
          {(activeTab !== Tab.TRACKER && currentUser?.role !== 'ADMIN') && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Shield className="w-16 h-16 mb-4 opacity-20" />
              <p>Access Restricted</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
