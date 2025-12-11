import { EnrichedOrder, PaginatedResponse } from './types';

// REPLACE THIS WITH YOUR CLOUD RUN URL AFTER DEPLOYMENT
const BACKEND_URL = "https://packtrack-ups-backend-214733779716.us-west1.run.app";

export interface TrackingRow {
  logId: string;
  dateStr: string;
  trackingNumber: string;
  upsStatus: string;
  location: string;
  delivered: boolean;
  expectedDelivery: string;
  lastUpdated: number;
  trackingUrl: string;
  isError: boolean;
  userId: string;
}

export interface TrackingResponse {
  data: TrackingRow[];
  total: number;
  page: number;
  totalPages: number;
}

export async function fetchTrackingList(page: number = 1, limit: number = 25): Promise<TrackingResponse> {
  const response = await fetch(`${BACKEND_URL}/tracking/list?page=${page}&limit=${limit}`);
  if (!response.ok) throw new Error("Failed to fetch tracking");
  return response.json();
}

export async function refreshSingleTracking(trackingNumber: string): Promise<Partial<TrackingRow>> {
  const response = await fetch(`${BACKEND_URL}/tracking/single`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingNumber })
  });
  if (!response.ok) return { upsStatus: 'Error' };
  return response.json();
}

export async function fetchEnrichedOrders(page: number = 1, limit: number = 25): Promise<PaginatedResponse> {
  const response = await fetch(`${BACKEND_URL}/orders/enriched?page=${page}&limit=${limit}`);
  if (!response.ok) throw new Error("Failed to fetch enriched orders");
  return response.json();
}

export async function trackSingleOrder(trackingNumber: string): Promise<Partial<EnrichedOrder>> {
  const response = await fetch(`${BACKEND_URL}/tracking/single`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingNumber })
  });

  if (!response.ok) return { status: 'Error' };

  const data = await response.json();
  
  // Map backend response (upsStatus) to EnrichedOrder format (status)
  return {
    status: data.upsStatus || data.status,
    location: data.location,
    delivered: data.delivered,
    expectedDelivery: data.expectedDelivery,
    lastUpdated: data.lastUpdated,
    trackingUrl: data.trackingUrl
  };
}