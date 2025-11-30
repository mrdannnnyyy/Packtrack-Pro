
import { ShipmentDetails } from './types';

// ==============================================================================
// ⚠️ IMPORTANT: REPLACE THIS URL WITH YOUR DEPLOYED BACKEND URL FROM RENDER.COM
// Example: 'https://packtrack-backend-xyz.onrender.com'
// ==============================================================================
const BACKEND_URL = 'https://packtrack-backend.onrender.com'; // Change this after deploying

export const trackUPSPackage = async (trackingNumber: string): Promise<ShipmentDetails> => {
  try {
    // 1. Validate Input
    if (!trackingNumber) throw new Error("No tracking number provided");

    // 2. Call Backend
    const response = await fetch(`${BACKEND_URL}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ trackingNumber })
    });

    // 3. Handle Network Errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server Error: ${response.status}`);
    }

    // 4. Parse Result
    const data = await response.json();

    return {
      status: data.status || "Unknown",
      carrier: "UPS",
      date: data.date || "--",
      location: data.location || "",
      delivered: data.delivered || false,
      trackingUrl: data.trackingUrl || "",
      expectedDelivery: data.expectedDelivery || "--",
      lastUpdated: Date.now(),
      error: data.error // Pass through specific API errors if any
    };

  } catch (error: any) {
    console.error(`Frontend Tracking Error for ${trackingNumber}:`, error);
    
    // Return a safe fallback object so the UI doesn't crash
    return {
      status: "Update Failed",
      carrier: "UPS",
      date: "--",
      location: "",
      delivered: false,
      trackingUrl: "",
      expectedDelivery: "--",
      lastUpdated: Date.now(),
      error: error.message || "Connection Failed"
    };
  }
};
