
import React, { useState } from 'react';
import { PackageLog } from '../types';
import { trackUPSPackage } from '../upsApi';
import { updateLogShipmentDetails } from '../firebase';
import { Truck, RefreshCw, ExternalLink, MapPin, Calendar, AlertCircle, Search, Server, CloudOff } from 'lucide-react';

interface ShipmentTrackingViewProps {
  logs: PackageLog[];
}

export const ShipmentTrackingView: React.FC<ShipmentTrackingViewProps> = ({ logs }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [connectionError, setConnectionError] = useState(false);

  // Filter out logs with short/invalid IDs
  const trackedLogs = logs.filter(log => log.trackingId && log.trackingId.length > 5);
  
  // Filter based on search text
  const filteredLogs = trackedLogs.filter(log => 
    log.trackingId.toLowerCase().includes(filterText.toLowerCase()) ||
    log.shipmentDetails?.status.toLowerCase().includes(filterText.toLowerCase())
  ).sort((a, b) => b.startTime - a.startTime);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    setConnectionError(false);
    setStatusMessage('Connecting to Backend Server...');

    try {
      let updatedCount = 0;
      let errorCount = 0;

      // Filter: Don't re-track delivered items to save API calls, unless user forces it
      const logsToUpdate = trackedLogs.filter(l => !l.shipmentDetails?.delivered);

      if (logsToUpdate.length === 0) {
        setStatusMessage('All active packages are already delivered.');
        setIsRefreshing(false);
        return;
      }

      setStatusMessage(`Processing ${logsToUpdate.length} packages...`);

      for (const log of logsToUpdate) {
        // Call our Backend Proxy
        const details = await trackUPSPackage(log.trackingId);
        
        // Save to Firestore
        await updateLogShipmentDetails(log.id, details);
        
        // Check if our backend is totally unreachable (fetch failed)
        if (details.error && details.error.includes("Failed to fetch")) {
            setConnectionError(true);
            setStatusMessage("Backend Unreachable: Check URL config.");
            break; // Stop loop if server is down
        }

        if (details.error) {
           errorCount++;
        } else {
           updatedCount++;
        }
        
        if (!connectionError) {
            setStatusMessage(`Updated: ${updatedCount} | Errors: ${errorCount} | Remaining: ${logsToUpdate.length - (updatedCount + errorCount)}`);
        }
      }

      if (!connectionError) {
          setStatusMessage(`Completed. ${updatedCount} updated, ${errorCount} failed.`);
      }
    } catch (error) {
      console.error(error);
      setStatusMessage('Critical Error: Could not complete updates.');
    } finally {
      setIsRefreshing(false);
      if (!connectionError) {
          setTimeout(() => setStatusMessage(''), 5000);
      }
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('delivered')) return 'bg-green-100 text-green-700 border-green-200';
    if (s.includes('transit') || s.includes('shipped') || s.includes('pickup')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (s.includes('exception') || s.includes('error') || s.includes('failed')) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Truck className="w-8 h-8 text-blue-600" />
              Shipment Tracking
            </h1>
            <p className="text-slate-500">Real-time status updates via UPS API Proxy.</p>
          </div>
          
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-200"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Updating...' : 'Update All Statuses'}
          </button>
        </div>

        {connectionError && (
             <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <CloudOff className="w-6 h-6 text-red-600 mt-1" />
                <div>
                    <h3 className="text-red-800 font-bold">Backend Connection Failed</h3>
                    <p className="text-red-600 text-sm mt-1">
                        The app could not reach the UPS Proxy Server. Please ensure:
                        <ul className="list-disc list-inside mt-2 ml-2">
                            <li>The backend is deployed and running (e.g., on Render).</li>
                            <li>The <code>BACKEND_URL</code> in <code>upsApi.ts</code> is correct.</li>
                        </ul>
                    </p>
                </div>
             </div>
        )}

        {statusMessage && !connectionError && (
          <div className="mb-4 p-3 bg-slate-800 text-blue-200 rounded-lg text-sm font-mono border border-slate-700 animate-in fade-in flex items-center gap-2">
            <Server className="w-4 h-4" />
            {statusMessage}
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Filter by Tracking ID or Status..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tracking ID</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Est. Arrival</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Last Checked</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No tracking information found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const details = log.shipmentDetails;
                  const hasDetails = !!details;
                  
                  // Highlight if error
                  const isError = details?.error;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className="font-bold text-slate-800 font-mono">{log.trackingId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {hasDetails ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(details.status)}`}>
                             {details.status}
                          </span>
                        ) : (
                           <span className="text-slate-400 text-xs italic">Pending Update</span>
                        )}
                        {details?.error && (
                          <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Update Failed
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                         {hasDetails && details.expectedDelivery !== '--' ? (
                           <div className="flex items-center gap-1">
                             <Calendar className="w-4 h-4 text-slate-400" />
                             {details.expectedDelivery}
                           </div>
                         ) : (
                           <span className="text-slate-400">-</span>
                         )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 max-w-xs truncate">
                         {hasDetails && details.location ? (
                           <div className="flex items-center gap-1" title={details.location}>
                             <MapPin className="w-4 h-4 text-slate-400" />
                             {details.location}
                           </div>
                         ) : (
                           <span className="text-slate-400">-</span>
                         )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                         {details?.lastUpdated ? new Date(details.lastUpdated).toLocaleTimeString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                         {hasDetails && details.trackingUrl ? (
                           <a 
                             href={details.trackingUrl} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1 hover:underline"
                           >
                             Track <ExternalLink className="w-3 h-3" />
                           </a>
                         ) : (
                           <span className="text-slate-300 cursor-not-allowed">Track</span>
                         )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
