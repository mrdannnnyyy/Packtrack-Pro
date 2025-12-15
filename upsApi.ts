
import { EnrichedOrder, PaginatedResponse } from './types';

// Reverting to the live Cloud Run backend for Tracking Data
const BACKEND_URL = "https://packtrack-ups-backend-214733779716.us-west1.run.app";

export interface TrackingRow {
  orderNumber: string;
  trackingNumber: string;
  upsStatus: string;
  location: string;
  delivered: boolean;
  expectedDelivery: string;
  lastUpdated: number;
  trackingUrl: string;
  isError: boolean;
  // Fields merged from Firebase
  flagged?: boolean;
  notes?: string;
}

export interface TrackingResponse {
  data: TrackingRow[];
  total: number;
  page: number;
  totalPages: number;
}

export async function fetchTrackingList(page: number = 1, limit: number = 25): Promise<TrackingResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/tracking?page=${page}&limit=${limit}`);
    if (!response.ok) throw new Error("Failed to fetch tracking");
    return response.json();
  } catch (e) {
    console.error("API Connection Error:", e);
    throw e;
  }
}

export async function refreshSingleTracking(trackingNumber: string): Promise<Partial<TrackingRow>> {
  try {
    const response = await fetch(`${BACKEND_URL}/tracking/single`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingNumber })
    });
    if (!response.ok) return { upsStatus: 'Error', isError: true };
    return response.json();
  } catch (e) {
    console.error("API Error:", e);
    return { upsStatus: 'Error', isError: true };
  }
}

export async function fetchEnrichedOrders(page: number = 1, limit: number = 25): Promise<PaginatedResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/tracking?page=${page}&limit=${limit}`);
    if (!response.ok) throw new Error("Failed to fetch enriched orders");
    return response.json();
  } catch (e) {
    console.error("API Connection Error:", e);
    throw e;
  }
}

export async function trackSingleOrder(trackingNumber: string): Promise<Partial<EnrichedOrder>> {
  try {
    const response = await fetch(`${BACKEND_URL}/tracking/single`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingNumber })
    });
    if (!response.ok) return { status: 'Error' };
    return response.json();
  } catch (e) {
    return { status: 'Error' };
  }
}
