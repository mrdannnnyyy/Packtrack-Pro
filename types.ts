
export interface User {
  id: string;
  name: string;
  role: 'ADMIN' | 'USER';
  pin: string;
}

export interface ShipmentDetails {
  status: string;
  carrier: string; // 'UPS'
  date: string; // Formatted MM/DD/YYYY
  location: string;
  delivered: boolean;
  trackingUrl: string;
  expectedDelivery: string;
  lastUpdated: number;
  error?: string;
}

export interface PackageLog {
  id: string;
  trackingId: string;
  userId: string; 
  startTime: number; 
  endTime: number | null; 
  dateStr: string; 
  shipmentDetails?: ShipmentDetails;
}

export interface DaySummary {
  dateStr: string;
  totalPackages: number;
  avgDurationMinutes: number;
  totalShiftDuration: number; 
}

export enum Tab {
  TRACKER = 'TRACKER',
  HISTORY = 'HISTORY',
  ANALYTICS = 'ANALYTICS',
  SHIPMENT = 'SHIPMENT',
  CONFIGURATION = 'CONFIGURATION'
}
