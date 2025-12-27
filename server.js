
const express = require('express');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// --- FIREBASE SETUP ---
try {
  const serviceAccount = require('./service-account.json');
  initializeApp({
    credential: cert(serviceAccount)
  });
  console.log("Firebase Admin initialized");
} catch (e) {
  try {
    initializeApp();
    console.log("Firebase Admin initialized via environment");
  } catch (e2) {
    console.error("Failed to initialize Firebase Admin.");
  }
}

const db = getFirestore();
const PORT = process.env.PORT || 8080;

// --- CONFIGURATION ---
const COLLECTION_NAME = 'shipstation_orders';
const META_COLLECTION = 'system_meta';
const SYNC_COOLDOWN_MS = 30 * 60 * 1000; // 30 Minutes

// --- HELPER FUNCTIONS ---

async function getPaginatedData(collectionName, page, limit, filterFn = null) {
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
 * Simple DB read. Does not trigger external API.
 */
app.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const result = await getPaginatedData(COLLECTION_NAME, page, limit);
    
    // Get last sync from meta
    const meta = await db.collection(META_COLLECTION).doc('shipstation').get();
    const lastSync = meta.exists ? meta.data().lastSync : 0;

    res.json({ ...result, lastSync });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /sync/orders
 * Implements revalidation logic for ShipStation sync.
 */
app.post('/sync/orders', async (req, res) => {
  try {
    const now = Date.now();
    const metaRef = db.collection(META_COLLECTION).doc('shipstation');
    const metaSnap = await metaRef.get();
    
    // 1. Check if we synced recently
    if (metaSnap.exists) {
      const { lastSync } = metaSnap.data();
      if (now - lastSync < SYNC_COOLDOWN_MS) {
        return res.json({ 
          success: true, 
          message: "Cache is fresh. Skipping external ShipStation fetch.",
          nextSyncIn: Math.ceil((SYNC_COOLDOWN_MS - (now - lastSync)) / 60000)
        });
      }
    }

    // 2. Perform external "Fetch" (Mocking ShipStation API)
    // In a real app, this is where axios.get('ssapi.shipstation.com/...') goes.
    const mockOrders = Array.from({ length: 5 }).map((_, i) => ({
      orderId: `SS-${now}-${i}`,
      orderNumber: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
      customerName: `Customer ${Math.floor(Math.random() * 1000)}`,
      customerEmail: `user${i}@example.com`,
      items: `Item ${String.fromCharCode(65+i)} x${i+1}`,
      shipDate: new Date().toISOString().split('T')[0],
      trackingNumber: `1Z${Math.random().toString(36).substring(7).toUpperCase()}`,
      carrierCode: 'ups',
      status: 'shipped',
      lastUpdated: now,
      upsStatus: 'Pending',
      delivered: false
    }));

    const batch = db.batch();
    mockOrders.forEach(order => {
      const docRef = db.collection(COLLECTION_NAME).doc(order.orderNumber);
      batch.set(docRef, order, { merge: true });
    });

    // Update global sync meta
    batch.set(metaRef, { lastSync: now }, { merge: true });
    
    await batch.commit();

    res.json({ success: true, count: mockOrders.length, message: "Successfully synced with ShipStation" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tracking
 * Simple DB read.
 */
app.get('/tracking', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const hasTracking = (item) => item.trackingNumber && item.trackingNumber !== 'No Tracking';
    const result = await getPaginatedData(COLLECTION_NAME, page, limit, hasTracking);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /tracking/single
 * Implements "Stale-While-Revalidate" logic for UPS.
 */
app.post('/tracking/single', async (req, res) => {
  const { trackingNumber } = req.body;
  if (!trackingNumber) return res.status(400).send("Missing trackingNumber");

  try {
    const now = Date.now();
    // 1. Check Firestore First
    const querySnap = await db.collection(COLLECTION_NAME).where('trackingNumber', '==', trackingNumber).get();
    
    if (!querySnap.empty) {
      const doc = querySnap.docs[0];
      const data = doc.data();

      // RULE: If Delivered, return immediately.
      if (data.delivered === true || (data.upsStatus && data.upsStatus.toLowerCase().includes('delivered'))) {
        console.log(`Cache Hit (Final): ${trackingNumber} is already delivered.`);
        return res.json(data);
      }

      // RULE: If lastUpdated < 30 minutes, return immediately.
      if (data.lastUpdated && (now - data.lastUpdated < SYNC_COOLDOWN_MS)) {
        console.log(`Cache Hit (Fresh): ${trackingNumber} was updated recently.`);
        return res.json(data);
      }
    }

    // 2. Data is missing or stale -> Proceed to external fetch (Mocking UPS API)
    console.log(`Cache Miss/Stale: Fetching fresh UPS data for ${trackingNumber}`);
    
    const statuses = ['In Transit', 'Out for Delivery', 'Delivered', 'Exception'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const isDelivered = randomStatus === 'Delivered';
    
    const updateData = {
      upsStatus: randomStatus,
      location: isDelivered ? 'Front Porch, Destination' : 'Local Sort Facility, KY',
      expectedDelivery: isDelivered ? 'Delivered' : new Date(now + 172800000).toLocaleDateString(),
      delivered: isDelivered,
      trackingUrl: `https://www.ups.com/track?tracknum=${trackingNumber}`,
      lastUpdated: now
    };

    // 3. Update Firestore with { merge: true }
    if (!querySnap.empty) {
      const batch = db.batch();
      querySnap.forEach(d => batch.update(d.ref, updateData));
      await batch.commit();
    }

    res.json(updateData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
