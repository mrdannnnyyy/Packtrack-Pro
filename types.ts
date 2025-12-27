
export interface User {
  id: string;
  name: string;
  role: 'ADMIN' | 'USER' | 'SUPPORT';
  pin: string; // Used for Packers (USER)
  password?: string; // Used for ADMIN and SUPPORT
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
  // New field for auto-populated data
  matchedOrder?: {
    orderNumber: string;
    customerName: string;
    items: string;
  };
}

export interface EnrichedOrder {
  orderId: number | null;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  items?: string;
  shipDate?: string;
  trackingNumber: string;
  carrierCode?: string;
  status: string;
  location: string;
  expectedDelivery: string;
  lastUpdated: number;
  delivered: boolean;
  trackingUrl: string;
  logDate?: string | null;
  labelCost?: number; // Added labelCost field
}

export interface PaginatedResponse {
  data: EnrichedOrder[];
  total: number;
  page: number;
  totalPages: number;
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
  ORDERS = 'ORDERS',
  TRACKING = 'TRACKING',
  CONFIGURATION = 'CONFIGURATION'
}
