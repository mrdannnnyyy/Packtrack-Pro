// REPLACE THIS WITH YOUR CLOUD RUN URL AFTER DEPLOYMENT
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

export interface BasicOrderResponse {
  data: BasicOrder[];
  total: number;
  page: number;
  totalPages: number;
}

export async function fetchBasicOrders(page: number = 1, limit: number = 25): Promise<BasicOrderResponse> {
  const response = await fetch(`${BACKEND_URL}/orders/basic?page=${page}&limit=${limit}`);
  if (!response.ok) throw new Error("Failed to fetch orders");
  return response.json();
}