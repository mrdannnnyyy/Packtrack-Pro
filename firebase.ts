
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  writeBatch,
  setDoc,
  getDoc
} from "firebase/firestore";
import { PackageLog, User, ShipmentDetails } from './types';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAKbvODxE_ULiag9XBXHnAJO4b-tGWSq0w",
  authDomain: "time-tracking-67712.firebaseapp.com",
  databaseURL: "https://time-tracking-67712-default-rtdb.firebaseio.com",
  projectId: "time-tracking-67712",
  storageBucket: "time-tracking-67712.firebasestorage.app",
  messagingSenderId: "829274875816",
  appId: "1:829274875816:web:ee9e8046d22a115e42df9d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// NOTE: Offline persistence disabled
// Collection References
const LOGS_COL = 'packtrack_logs';
const USERS_COL = 'packtrack_users';
const ANNOTATIONS_COL = 'packtrack_annotations'; // New collection for flags/notes

// --- LISTENERS (REAL-TIME SYNC) ---

export const subscribeToLogs = (
  onData: (logs: PackageLog[]) => void, 
  onError?: (error: any) => void
) => {
  const q = collection(db, LOGS_COL);
  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PackageLog[];
      onData(logs);
    }, 
    (error) => {
      console.error("Error fetching logs:", error);
      if (onError) onError(error);
    }
  );
};

export const subscribeToUsers = (
  onData: (users: User[]) => void, 
  onError?: (error: any) => void
) => {
  const q = collection(db, USERS_COL);
  return onSnapshot(
    q,
    (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as User[];
      onData(users);
    },
    (error) => {
      console.error("Error fetching users:", error);
      if (onError) onError(error);
    }
  );
};

// --- ANNOTATIONS (FLAGS & NOTES) ---

export interface Annotation {
  trackingNumber: string;
  flagged: boolean;
  notes: string;
  updatedAt: number;
}

export const subscribeToAnnotations = (
  onData: (annotations: Record<string, Annotation>) => void
) => {
  const q = collection(db, ANNOTATIONS_COL);
  return onSnapshot(q, (snapshot) => {
    const lookup: Record<string, Annotation> = {};
    snapshot.docs.forEach(doc => {
      lookup[doc.id] = doc.data() as Annotation;
    });
    onData(lookup);
  });
};

export const saveAnnotation = async (trackingNumber: string, flagged: boolean, notes: string) => {
  if (!trackingNumber) return;
  // Use trackingNumber as the document ID for easy lookup
  const docRef = doc(db, ANNOTATIONS_COL, trackingNumber);
  await setDoc(docRef, {
    trackingNumber,
    flagged,
    notes,
    updatedAt: Date.now()
  }, { merge: true });
};


// --- LOG OPERATIONS ---

export const addLogEntry = async (log: Omit<PackageLog, 'id'>) => {
  const logsRef = collection(db, LOGS_COL);
  
  // Attempt to clock out previous active logs for THIS USER
  try {
    const q = query(
      logsRef, 
      where("userId", "==", log.userId),
      where("endTime", "==", null)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      const now = Date.now();
      const MAX_DURATION = 3 * 60 * 60 * 1000; // 3 Hours
      const FALLBACK_DURATION = 15 * 60 * 1000; // 15 Minutes

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        let endTime = now;
        
        // If duration is > 3 hours, assume they forgot to clock out and set it to 15 mins
        if (data.startTime && (now - data.startTime > MAX_DURATION)) {
           endTime = data.startTime + FALLBACK_DURATION;
        }

        batch.update(docSnap.ref, { endTime });
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn("Auto-clock-out skipped (likely missing index or permission). Proceeding to add new log.", err);
  }

  // Always add the new log
  await addDoc(logsRef, log);
};

export const clockOutActiveLog = async (logId: string) => {
  const logRef = doc(db, LOGS_COL, logId);
  
  try {
    const snap = await getDoc(logRef);
    if (snap.exists()) {
       const data = snap.data();
       const now = Date.now();
       const MAX_DURATION = 3 * 60 * 60 * 1000; // 3 Hours
       const FALLBACK_DURATION = 15 * 60 * 1000; // 15 Minutes
       
       let endTime = now;
       // If duration is > 3 hours, cap at 15 mins
       if (data.startTime && (now - data.startTime > MAX_DURATION)) {
          endTime = data.startTime + FALLBACK_DURATION;
       }
       
       await updateDoc(logRef, { endTime });
    } else {
      // Fallback
      await updateDoc(logRef, { endTime: Date.now() });
    }
  } catch (e) {
    console.warn("Error clocking out:", e);
    await updateDoc(logRef, { endTime: Date.now() });
  }
};

export const autoTimeoutLog = async (logId: string, startTime: number) => {
  const logRef = doc(db, LOGS_COL, logId);
  const FALLBACK_DURATION = 15 * 60 * 1000; // 15 Minutes
  
  await updateDoc(logRef, {
    endTime: startTime + FALLBACK_DURATION
  });
};

export const updateLogShipmentDetails = async (logId: string, details: ShipmentDetails) => {
  const logRef = doc(db, LOGS_COL, logId);
  await updateDoc(logRef, {
    shipmentDetails: details
  });
};

export const deleteLogEntry = async (logId: string) => {
  const logRef = doc(db, LOGS_COL, logId);
  await deleteDoc(logRef);
};

export const clearAllSystemData = async () => {
  const batch = writeBatch(db);
  
  const logsSnap = await getDocs(collection(db, LOGS_COL));
  logsSnap.forEach(d => batch.delete(d.ref));
  
  const usersSnap = await getDocs(collection(db, USERS_COL));
  usersSnap.forEach(d => batch.delete(d.ref));
  
  const annSnap = await getDocs(collection(db, ANNOTATIONS_COL));
  annSnap.forEach(d => batch.delete(d.ref));
  
  await batch.commit();
};

// --- USER OPERATIONS ---

export const addUser = async (user: Omit<User, 'id'>) => {
  await addDoc(collection(db, USERS_COL), user);
};

export const updateUser = async (userId: string, data: Partial<User>) => {
  const userRef = doc(db, USERS_COL, userId);
  await updateDoc(userRef, data);
};

export const deleteUser = async (userId: string) => {
  const userRef = doc(db, USERS_COL, userId);
  await deleteDoc(userRef);
};
