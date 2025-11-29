import { PackageLog } from './types';

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

export const getDurationColor = (durationMs: number): string => {
  const minutes = durationMs / 1000 / 60;
  if (minutes <= 4) return 'bg-green-100 text-green-800 border-green-200';
  if (minutes <= 9) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
};

export const calculateShiftStats = (logs: PackageLog[]) => {
  if (logs.length === 0) return { shiftDuration: 0, avgDuration: 0, count: 0 };

  const finishedLogs = logs.filter(l => l.endTime !== null);
  const count = finishedLogs.length;

  // Average Duration of completed packages
  const totalPackageTime = finishedLogs.reduce((acc, log) => {
    return acc + ((log.endTime || 0) - log.startTime);
  }, 0);
  const avgDuration = count > 0 ? totalPackageTime / count : 0;

  // Shift Duration (Max End - Min Start)
  // If a log is active, use current time for Max End calculation logic if we wanted "Live" shift time,
  // but strictly following the spreadsheet logic: MAX(End) - MIN(Start).
  // We will consider active logs as "Now" for the purpose of shift duration if they are the latest.
  const startTimes = logs.map(l => l.startTime);
  const endTimes = logs.map(l => l.endTime || Date.now());
  
  const minStart = Math.min(...startTimes);
  const maxEnd = Math.max(...endTimes);
  
  const shiftDuration = maxEnd - minStart;

  return { shiftDuration, avgDuration, count };
};