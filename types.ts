
export interface User {
  id: string;
  name: string;
  role: 'ADMIN' | 'USER';
  pin: string;
}

export interface PackageLog {
  id: string;
  trackingId: string;
  userId: string; // New field for user attribution
  startTime: number; // Timestamp in ms
  endTime: number | null; // Timestamp in ms, null if active
  dateStr: string; // YYYY-MM-DD for grouping
}

export interface DaySummary {
  dateStr: string;
  totalPackages: number;
  avgDurationMinutes: number;
  totalShiftDuration: number; // ms
}

export enum Tab {
  TRACKER = 'TRACKER',
  HISTORY = 'HISTORY',
  ANALYTICS = 'ANALYTICS',
  CONFIGURATION = 'CONFIGURATION'
}
