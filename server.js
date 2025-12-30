
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

async function fetchLiveOrders() {
  // In a real scenario, this would call the ShipStation API:
  // const response = await axios.get('https://ssapi.shipstation.com/shipments', { auth: { ... } });
  // return response.data.shipments;
  
  // For this environment, we simulate the raw response from ShipStation
  const now = Date.now();
  return Array.from({ length: 5 }).map((_, i) => ({
    orderId: `SS-${now}-${i}`,
    orderNumber: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
    customerName: `Customer ${Math.floor(Math.random() * 1000)}`,
    customerEmail: `user${i}@example.com`,
    items: `Item ${String.fromCharCode(65+i)} x${i+1}`,
    shipDate: new Date().toISOString().split('T')[0],
    trackingNumber: `1Z${Math.random().toString(36).substring(7).toUpperCase()}`,
    carrierCode: 'ups',
    orderStatus: 'shipped',
    // These are the raw cost fields from ShipStation
    shipmentCost: Math.random() * 12 + 4,
    insuranceCost: Math.random() > 0.7 ? 2.50 : 0
  }));
}

function cleanData(s, now) {
  return {
    orderId: s.orderId,
    orderNumber: s.orderNumber,
    customerName: s.customerName,
    customerEmail: s.customerEmail,
    items: s.items,
    shipDate: s.shipDate,
    trackingNumber: s.trackingNumber,
    carrierCode: s.carrierCode,
    status: s.orderStatus,
    lastUpdated: now,
    upsStatus: 'Pending',
    delivered: false,
    flagged: false,
    // FIX: Summing shipmentCost and insuranceCost for accurate total label cost
    labelCost: (s.shipmentCost || 0) + (s.insuranceCost || 0)
  };
}

async function getPaginatedData(collectionName, page, limit, filterFn = null, sortFn = null) {
  // 1. Fetch all data (In-memory approach for this scale)
  // We default to lastUpdated desc, but allow re-sorting later
  const snapshot = await db.collection(collectionName).orderBy('lastUpdated', 'desc').get();
  let data = snapshot.docs.map(doc => doc.data());
  
  // 2. Filter
  if (filterFn) {
    data = data.filter(filterFn);
  }

  // 3. Custom Sort (e.g., Prioritize Flags)
  if (sortFn) {
    data.sort(sortFn);
  }

  // 4. Paginate
  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginatedData = data.slice(startIndex, startIndex + limit);
  
  return { data: paginatedData, total, page, totalPages };
}

async function getIssuesData(collectionName, page, limit) {
  // STRATEGY: Merged Query for Issues
  // 1. Fetch ALL Flagged items (Global) - Ensures we find old flagged items
  const flaggedSnap = await db.collection(collectionName).where('flagged', '==', true).get();
  const flaggedDocs = flaggedSnap.docs.map(d => d.data());

  // 2. Fetch Recent items (to catch system issues that aren't flagged yet)
  // We fetch a larger pool (e.g. 200) to find recent exceptions in the latest data
  const recentSnap = await db.collection(collectionName).orderBy('lastUpdated', 'desc').limit(200).get();
  const recentDocs = recentSnap.docs.map(d => d.data());

  // 3. Filter Recent items for "System Issues" (substring match)
  const systemIssues = recentDocs.filter(item => {
       const status = (item.upsStatus || item.status || item.orderStatus || "").toLowerCase();
       return status.includes('exception') || status.includes('error') || status.includes('issue') || status.includes('fail');
  });

  // 4. Merge & Deduplicate
  const merged = new Map();
  // Add flagged items (High Priority)
  flaggedDocs.forEach(d => merged.set(d.orderNumber, d));
  // Add system issues (Low Priority)
  systemIssues.forEach(d => {
      if (!merged.has(d.orderNumber)) merged.set(d.orderNumber, d);
  });

  let data = Array.from(merged.values());

  // 5. Sort: Flagged First, then Date
  data.sort((a, b) => {
      if (!!a.flagged !== !!b.flagged) return a.flagged ? -1 : 1;
      return (b.lastUpdated || 0) - (a.lastUpdated || 0);
  });

  // 6. Paginate
  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginatedData = data.slice(startIndex, startIndex + limit);

  return { data: paginatedData, total, page, totalPages };
}

// --- API ROUTES ---

app.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const statusFilter = req.query.status;
    const isIssuesMode = statusFilter === 'Issues' || statusFilter === 'Exception';

    let result;
    if (isIssuesMode) {
        result = await getIssuesData(COLLECTION_NAME, page, limit);
    } else {
        const filter = (item) => {
            if (!statusFilter) return true;
            const status = (item.upsStatus || item.status || item.orderStatus || "").toLowerCase();
            return status.includes(statusFilter.toLowerCase());
        };
        // Standard in-memory pagination for other views
        result = await getPaginatedData(COLLECTION_NAME, page, limit, filter);
    }
    
    const meta = await db.collection(META_COLLECTION).doc('shipstation').get();
    const lastSync = meta.exists ? meta.data().lastSync : 0;
    res.json({ ...result, lastSync });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/tracking', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const statusFilter = req.query.status;
    const isIssuesMode = statusFilter === 'Issues' || statusFilter === 'Exception';
    
    let result;
    if (isIssuesMode) {
        result = await getIssuesData(COLLECTION_NAME, page, limit);
    } else {
        const filter = (item) => {
            const validTracking = item.trackingNumber && item.trackingNumber !== 'No Tracking';
            if (!validTracking) return false;
            
            if (!statusFilter) return true;
            const status = (item.upsStatus || item.status || item.orderStatus || "").toLowerCase();
            return status.includes(statusFilter.toLowerCase());
        };
        result = await getPaginatedData(COLLECTION_NAME, page, limit, filter);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Persistent Flagging Endpoint
app.post('/flag', async (req, res) => {
  const { trackingNumber, orderNumber, flagged } = req.body;
  if (!orderNumber) return res.status(400).send("Missing orderNumber");

  try {
    const docRef = db.collection(COLLECTION_NAME).doc(orderNumber);
    await docRef.set({ 
      flagged: !!flagged,
      lastUpdated: Date.now() 
    }, { merge: true });
    
    res.json({ success: true, flagged: !!flagged });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/sync/orders', async (req, res) => {
  try {
    const now = Date.now();
    const metaRef = db.collection(META_COLLECTION).doc('shipstation');
    const metaSnap = await metaRef.get();
    
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

    // Call our refined helper functions
    const rawOrders = await fetchLiveOrders();
    const mockOrders = rawOrders.map(s => cleanData(s, now));

    const batch = db.batch();
    mockOrders.forEach(order => {
      const docRef = db.collection(COLLECTION_NAME).doc(order.orderNumber);
      batch.set(docRef, order, { merge: true });
    });

    batch.set(metaRef, { lastSync: now }, { merge: true });
    await batch.commit();
    res.json({ success: true, count: mockOrders.length, message: "Successfully synced with ShipStation" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/tracking/single', async (req, res) => {
  const { trackingNumber } = req.body;
  if (!trackingNumber) return res.status(400).send("Missing trackingNumber");

  try {
    const now = Date.now();
    const querySnap = await db.collection(COLLECTION_NAME).where('trackingNumber', '==', trackingNumber).get();
    
    if (!querySnap.empty) {
      const doc = querySnap.docs[0];
      const data = doc.data();
      if (data.delivered === true || (data.upsStatus && data.upsStatus.toLowerCase().includes('delivered'))) {
        return res.json(data);
      }
      if (data.lastUpdated && (now - data.lastUpdated < SYNC_COOLDOWN_MS)) {
        return res.json(data);
      }
    }

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
