
import { PackageLog } from './types';

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

export const formatDuration = (ms: number): string => {
  if (isNaN(ms) || ms < 0) return '0m 00s';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

export const formatDurationHours = (ms: number): string => {
  if (isNaN(ms) || ms < 0) return '0m';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const formatTime = (timestamp: number): string => {
  if (!timestamp) return '--:--';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return 'Unknown Date';
  try {
    // Manually parse YYYY-MM-DD to ensure it treats the date as local
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
};

export const getLocalDateStr = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDurationColor = (durationMs: number): string => {
  const minutes = durationMs / 1000 / 60;
  if (minutes <= 4) return 'bg-green-100 text-green-800 border-green-200';
  if (minutes <= 9) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
};

export const calculateShiftStats = (logs: PackageLog[]) => {
  if (!logs || logs.length === 0) return { shiftDuration: 0, avgDuration: 0, count: 0 };

  const finishedLogs = logs.filter(l => l.endTime !== null);
  const count = finishedLogs.length;

  // Average Duration of completed packages
  const totalPackageTime = finishedLogs.reduce((acc, log) => {
    return acc + ((log.endTime || 0) - log.startTime);
  }, 0);
  const avgDuration = count > 0 ? totalPackageTime / count : 0;

  // Shift Duration (Max End - Min Start)
  // If a log is active, use current time for Max End calculation logic
  const startTimes = logs.map(l => l.startTime).filter(t => !isNaN(t));
  const endTimes = logs.map(l => l.endTime || Date.now()).filter(t => !isNaN(t));
  
  if (startTimes.length === 0) return { shiftDuration: 0, avgDuration, count };

  const minStart = Math.min(...startTimes);
  const maxEnd = Math.max(...endTimes);
  
  const shiftDuration = maxEnd - minStart;

  return { shiftDuration, avgDuration, count };
};
