
// REPLACE THIS WITH YOUR CLOUD RUN URL
const BACKEND_URL = "https://packtrack-ups-backend-214733779716.us-west1.run.app";

export interface BasicOrder {
  orderId: string;
  orderNumber: string;
  shipDate: string;
  customerName: string;
  customerEmail: string;
  items: string;
  trackingNumber: string;
  carrierCode: string;
  orderTotal: string;
  orderStatus: string;
}

export interface OrderResponse {
  data: BasicOrder[];
  total: number;
  page: number;
  totalPages: number;
  lastSync: number;
}

export async function fetchOrders(page: number = 1, limit: number = 25, status?: string): Promise<OrderResponse> {
  try {
    const url = new URL(`${BACKEND_URL}/orders`);
    url.searchParams.append('page', page.toString());
    url.searchParams.append('limit', limit.toString());
    if (status) url.searchParams.append('status', status);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("Failed to fetch orders");
    return response.json();
  } catch (e) {
    console.error("API Connection Error:", e);
    throw e;
  }
}

export async function syncOrders(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/sync/orders`, { method: 'POST' });
  if (!response.ok) throw new Error("Sync failed");
}
