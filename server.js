/**
 * PackTrack Pro Server
 * 
 * Dependencies:
 * npm install express cors firebase-admin axios
 * 
 * Usage:
 * 1. Go to Firebase Console > Project Settings > Service Accounts.
 * 2. Generate a new private key and save it as 'service-account.json' in this folder.
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS env var or uncomment the serviceAccount code below.
 * 4. Run: node server.js
 */

const express = require('express');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// --- FIREBASE SETUP ---

// OPTION 1: Auto-detection (Cloud Run / Functions / Env Var)
// initializeApp();

// OPTION 2: Local File (Uncomment for local development)
try {
  const serviceAccount = require('./service-account.json');
  initializeApp({
    credential: cert(serviceAccount)
  });
  console.log("Firebase Admin initialized with service-account.json");
} catch (e) {
  console.log("Could not find service-account.json, attempting default credentials...");
  try {
    initializeApp();
  } catch (e2) {
    console.error("Failed to initialize Firebase Admin. Please provide credentials.");
  }
}

const db = getFirestore();
const PORT = process.env.PORT || 8080;

// --- CONFIGURATION ---
const COLLECTION_NAME = 'shipstation_orders';

// --- HELPER FUNCTIONS ---
async function getPaginatedData(collectionName, page, limit, filterFn = null) {
  // Simple offset-based pagination. 
  // For production with large datasets, consider cursor-based pagination.
  const snapshot = await db.collection(collectionName).orderBy('lastUpdated', 'desc').get();
  
  let data = snapshot.docs.map(doc => doc.data());

  if (filterFn) {
    data = data.filter(filterFn);
  }

  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginatedData = data.slice(startIndex, startIndex + limit);

  return { data: paginatedData, total, page, totalPages };
}

// --- API ROUTES ---

/**
 * GET /orders
 * Fetches cached ShipStation orders from Firestore.
 */
app.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    
    const result = await getPaginatedData(COLLECTION_NAME, page, limit);
    
    res.json({
      ...result,
      lastSync: Date.now() // Ideally retrieve this from a metadata doc
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /sync/orders
 * Fetches new orders from ShipStation API and saves them to Firestore.
 * NOTE: This implementation currently uses MOCK data for demonstration.
 */
app.post('/sync/orders', async (req, res) => {
  try {
    // --- REAL IMPLEMENTATION EXAMPLE ---
    /*
    const apiKey = process.env.SS_API_KEY;
    const apiSecret = process.env.SS_API_SECRET;
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    const response = await axios.get('https://ssapi.shipstation.com/orders?orderStatus=shipped', {
      headers: { Authorization: `Basic ${auth}` }
    });
    const orders = response.data.orders;
    */

    // --- MOCK IMPLEMENTATION ---
    const mockOrders = Array.from({ length: 5 }).map((_, i) => ({
      orderId: `MOCK-${Date.now()}-${i}`,
      orderNumber: `ORD-${Math.floor(Math.random() * 100000)}`,
      customerName: `Customer ${Math.floor(Math.random() * 500)}`,
      customerEmail: `customer${i}@example.com`,
      items: `Item Type ${String.fromCharCode(65 + i)} x${Math.ceil(Math.random() * 3)}`,
      shipDate: new Date().toISOString().split('T')[0],
      trackingNumber: Math.random() > 0.2 ? `1Z${Math.random().toString(36).substring(7).toUpperCase()}03${Math.floor(Math.random()*1000)}` : 'No Tracking',
      carrierCode: 'ups',
      status: 'shipped', // ShipStation status
      lastUpdated: Date.now(),
      // Fields for UPS enrichment
      upsStatus: 'Pending',
      delivered: false
    }));

    const batch = db.batch();
    
    mockOrders.forEach(order => {
      // Use orderNumber as document ID for easy lookup
      const docRef = db.collection(COLLECTION_NAME).doc(order.orderNumber);
      batch.set(docRef, order, { merge: true });
    });

    await batch.commit();

    res.json({ success: true, count: mockOrders.length, message: "Synced mock orders to Firestore" });
  } catch (error) {
    console.error('Error syncing orders:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tracking
 * Returns orders with UPS enrichment data.
 */
app.get('/tracking', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;

    // Only show orders that have a tracking number
    const hasTracking = (item) => item.trackingNumber && item.trackingNumber !== 'No Tracking';

    const result = await getPaginatedData(COLLECTION_NAME, page, limit, hasTracking);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching tracking:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /tracking/single
 * Refreshes the UPS status for a single tracking number.
 * NOTE: This implementation currently uses MOCK logic.
 */
app.post('/tracking/single', async (req, res) => {
  const { trackingNumber } = req.body;
  if (!trackingNumber) {
    return res.status(400).send("Missing trackingNumber");
  }

  try {
    // --- REAL IMPLEMENTATION EXAMPLE ---
    /*
    const upsLicense = process.env.UPS_LICENSE_KEY;
    const response = await axios.get(`https://onlinetools.ups.com/track/v1/details/${trackingNumber}`, {
        headers: { AccessLicenseNumber: upsLicense }
    });
    const status = response.data.trackResponse.shipment[0].package[0].activity[0].status.description;
    */

    // --- MOCK IMPLEMENTATION ---
    const statuses = ['In Transit', 'Out for Delivery', 'Delivered', 'Exception', 'Label Created'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const isDelivered = randomStatus === 'Delivered';
    
    // Create update payload
    const updateData = {
      upsStatus: randomStatus,
      location: 'Louisville, KY, US',
      expectedDelivery: isDelivered ? 'Delivered' : new Date(Date.now() + 86400000 * 2).toLocaleDateString(),
      delivered: isDelivered,
      trackingUrl: `https://www.ups.com/track?tracknum=${trackingNumber}`,
      lastUpdated: Date.now()
    };

    // Update in Firestore
    const snapshot = await db.collection(COLLECTION_NAME).where('trackingNumber', '==', trackingNumber).get();
    
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.update(doc.ref, updateData);
      });
      await batch.commit();
    }

    // Return the data even if not found in DB (for ad-hoc requests)
    res.json(updateData);
  } catch (error) {
    console.error('Error updating tracking:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
