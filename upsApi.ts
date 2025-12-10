import { EnrichedOrder, PaginatedResponse } from './types';

// YOUR GOOGLE CLOUD RUN URL
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
  try {
    const response = await fetch(`${BACKEND_URL}/tracking/list?page=${page}&limit=${limit}`);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Tracking API Error: ${response.status} - ${text}`);
    }
    return response.json();
  } catch (error) {
      console.error("Fetch Tracking List Error:", error);
      throw error;
  }
}

export async function refreshSingleTracking(trackingNumber: string): Promise<Partial<TrackingRow>> {
  try {
    const response = await fetch(`${BACKEND_URL}/tracking/single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber })
    });
    if (!response.ok) return { upsStatus: 'Error' };
    return response.json();
  } catch (error) {
      console.error("Refresh Single Error:", error);
      return { upsStatus: 'Connection Fail' };
  }
}

export async function fetchEnrichedOrders(page: number = 1, limit: number = 25): Promise<PaginatedResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/orders/enriched?page=${page}&limit=${limit}`);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Enriched Orders API Error: ${response.status} - ${text}`);
    }
    return response.json();
  } catch (error) {
      console.error("Fetch Enriched Orders Error:", error);
      throw error;
  }
}

export async function trackSingleOrder(trackingNumber: string): Promise<Partial<EnrichedOrder>> {
  // Use existing logic for refreshing tracking, but map to EnrichedOrder format
  const trackingData = await refreshSingleTracking(trackingNumber);
  
  // Map TrackingRow partial to EnrichedOrder partial
  return {
    status: trackingData.upsStatus,
    location: trackingData.location,
    delivered: trackingData.delivered,
    expectedDelivery: trackingData.expectedDelivery,
    lastUpdated: trackingData.lastUpdated,
    trackingUrl: trackingData.trackingUrl
  };
}